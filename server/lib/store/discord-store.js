const rolesFile = require('./discord-roles');

let guildRolesCache = { at: 0, roles: [] };
const GUILD_ROLES_TTL_MS = 60_000;

function getClientId() {
  return process.env.DISCORD_CLIENT_ID || rolesFile.clientId;
}

function parseRoleList(raw) {
  if (!raw) return [];
  return String(raw)
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function getAdminRoleTokens() {
  const defaults = [...(rolesFile.beheerRoleIds || [])];
  const merged = new Set(defaults);

  const fromStore = process.env.DISCORD_STORE_ADMIN_ROLES;
  if (fromStore != null && String(fromStore).trim()) {
    parseRoleList(fromStore).forEach((t) => merged.add(t));
  }

  const fromBeheer = process.env.DISCORD_STAFF_BEHEER_ROLES;
  if (fromBeheer != null && String(fromBeheer).trim()) {
    parseRoleList(fromBeheer).forEach((t) => merged.add(t));
  }

  return [...merged];
}

/** Backwards compatible export */
function getAdminRoleIds() {
  return getAdminRoleTokens();
}

function normalizeRoleToken(token) {
  let s = String(token).trim();
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1).trim();
  }
  const mention = s.match(/^<@&(\d{17,20})>$/);
  if (mention) return { kind: 'id', value: mention[1] };
  if (/^\d{17,20}$/.test(s)) return { kind: 'id', value: s };
  return { kind: 'name', value: s };
}

function getBotHeaders() {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) throw new Error('DISCORD_BOT_TOKEN ontbreekt in Vercel.');
  return { Authorization: `Bot ${token}` };
}

function getGuildId() {
  let guildId = String(process.env.DISCORD_GUILD_ID || '').trim();
  if (
    (guildId.startsWith('"') && guildId.endsWith('"')) ||
    (guildId.startsWith("'") && guildId.endsWith("'"))
  ) {
    guildId = guildId.slice(1, -1).trim();
  }
  if (!guildId) throw new Error('DISCORD_GUILD_ID ontbreekt in Vercel.');
  return guildId;
}

function getAdminDiscordIds() {
  const raw = process.env.STORE_ADMIN_DISCORD_IDS || process.env.DISCORD_STORE_ADMIN_USER_IDS;
  if (!raw || !String(raw).trim()) return [];
  return parseRoleList(raw);
}

function isAdminDiscordUser(discordId) {
  const ids = getAdminDiscordIds().map(String);
  if (!ids.length || !discordId) return false;
  return ids.includes(String(discordId));
}

async function getGuildRoles(force = false) {
  const now = Date.now();
  if (!force && guildRolesCache.roles.length && now - guildRolesCache.at < GUILD_ROLES_TTL_MS) {
    return guildRolesCache.roles;
  }

  const guildId = getGuildId();
  const res = await fetch(`https://discord.com/api/v10/guilds/${guildId}/roles`, {
    headers: getBotHeaders(),
  });

  if (!res.ok) {
    throw new Error('Bot kan serverrollen niet ophalen — controleer DISCORD_GUILD_ID en bot-rechten.');
  }

  const roles = await res.json();
  guildRolesCache = { at: now, roles: roles || [] };
  return guildRolesCache.roles;
}

function buildRoleLookup(guildRoles) {
  const byId = new Map();
  const byName = new Map();

  (guildRoles || []).forEach((role) => {
    byId.set(String(role.id), role.name);
    byName.set(String(role.name).trim().toLowerCase(), String(role.id));
  });

  (rolesFile.ranks || []).forEach((rank) => {
    if (rank.discordRoleId && rank.naam) {
      byName.set(String(rank.naam).trim().toLowerCase(), String(rank.discordRoleId));
    }
  });

  return { byId, byName };
}

async function resolveAdminRoleIds() {
  const tokens = getAdminRoleTokens().map(normalizeRoleToken);
  const guildRoles = await getGuildRoles();
  const { byName } = buildRoleLookup(guildRoles);

  const resolved = [];
  const unresolved = [];

  tokens.forEach((token) => {
    if (token.kind === 'id') {
      resolved.push(token.value);
      return;
    }
    const id = byName.get(token.value.toLowerCase());
    if (id) resolved.push(id);
    else unresolved.push(token.value);
  });

  return {
    roleIds: [...new Set(resolved.map(String))],
    unresolved,
    tokens: getAdminRoleTokens(),
  };
}

function roleSummaries(roleIds, byId) {
  return (roleIds || []).map((id) => ({
    id: String(id),
    name: byId.get(String(id)) || null,
  }));
}

function isAdminWithResolvedIds(memberRoles, adminRoleIds) {
  const adminIds = (adminRoleIds || []).map(String);
  if (!adminIds.length || !memberRoles?.length) return false;
  const roles = memberRoles.map(String);
  return adminIds.some((id) => roles.includes(id));
}

async function exchangeCode(code, redirectUri) {
  const clientId = getClientId();
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  if (!clientSecret) {
    throw new Error('DISCORD_CLIENT_SECRET ontbreekt in Vercel.');
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
  });

  const res = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error_description || data.error || 'Discord login mislukt');
  }
  return data.access_token;
}

async function getGuildMember(userId) {
  const guildId = getGuildId();
  const res = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${userId}`, {
    headers: getBotHeaders(),
  });

  if (res.status === 404) {
    throw new Error('Je zit niet op de URP Discord server (of DISCORD_GUILD_ID klopt niet).');
  }
  if (!res.ok) {
    throw new Error('Bot kan je Discord-lidmaatschap niet ophalen — controleer bot-token en rechten.');
  }
  return res.json();
}

function avatarUrlFromUser(user) {
  if (!user?.id) return null;
  if (user.avatar) {
    return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`;
  }
  const disc = Number((BigInt(user.id) >> 22n) % 6n);
  return `https://cdn.discordapp.com/embed/avatars/${disc}.png`;
}

async function buildMemberAuthPayload(discordId, profile = {}) {
  const guildRoles = await getGuildRoles();
  const { byId } = buildRoleLookup(guildRoles);
  const admin = await resolveAdminRoleIds();

  if (isAdminDiscordUser(discordId)) {
    return {
      username: profile.username || profile.discordUsername || 'Beheerder',
      discordUsername: profile.discordUsername || null,
      discordId: String(discordId),
      avatarUrl: profile.avatarUrl || null,
      isAdmin: true,
      memberRoleIds: [],
      memberRoles: [],
      requiredRoleIds: admin.roleIds,
      requiredRoles: roleSummaries(admin.roleIds, byId),
      configuredRoleTokens: admin.tokens,
      unresolvedRoleTokens: admin.unresolved,
      guildIdSuffix: getGuildId().slice(-6),
      adminViaUserAllowlist: true,
    };
  }

  let member;
  try {
    member = await getGuildMember(discordId);
  } catch (err) {
    return {
      username: profile.username || profile.discordUsername || 'Gebruiker',
      discordUsername: profile.discordUsername || null,
      discordId: String(discordId),
      avatarUrl: profile.avatarUrl || null,
      isAdmin: false,
      memberRoleIds: [],
      memberRoles: [],
      requiredRoleIds: admin.roleIds,
      requiredRoles: roleSummaries(admin.roleIds, byId),
      configuredRoleTokens: admin.tokens,
      unresolvedRoleTokens: admin.unresolved,
      guildIdSuffix: getGuildId().slice(-6),
      error: err.message,
    };
  }

  const memberRoles = member.roles || [];
  const isAdmin = isAdminWithResolvedIds(memberRoles, admin.roleIds);
  const matchedAdminRoleIds = admin.roleIds.filter((id) => memberRoles.map(String).includes(String(id)));

  return {
    username: profile.username || member.nick || profile.discordUsername || 'Gebruiker',
    discordUsername: profile.discordUsername || null,
    discordId: String(discordId),
    avatarUrl: profile.avatarUrl || null,
    isAdmin,
    memberRoleIds: memberRoles.map(String),
    memberRoles: roleSummaries(memberRoles, byId),
    requiredRoleIds: admin.roleIds,
    requiredRoles: roleSummaries(admin.roleIds, byId),
    matchedAdminRoleIds,
    configuredRoleTokens: admin.tokens,
    unresolvedRoleTokens: admin.unresolved,
    guildIdSuffix: getGuildId().slice(-6),
  };
}

async function verifyStoreMemberByDiscordId(discordId, profile = {}) {
  return buildMemberAuthPayload(discordId, profile);
}

async function verifyStoreMember(accessToken) {
  const userRes = await fetch('https://discord.com/api/v10/users/@me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!userRes.ok) throw new Error('Discord sessie verlopen. Log opnieuw in.');
  const user = await userRes.json();

  const payload = await buildMemberAuthPayload(user.id, {
    username: user.global_name || user.username,
    discordUsername: user.username,
    avatarUrl: avatarUrlFromUser(user),
  });

  return {
    ...payload,
    username: payload.username || user.global_name || user.username,
    accessToken,
  };
}

function createLinkCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

module.exports = {
  getClientId,
  exchangeCode,
  verifyStoreMember,
  verifyStoreMemberByDiscordId,
  createLinkCode,
  getAdminRoleIds,
  getAdminRoleTokens,
  resolveAdminRoleIds,
};
