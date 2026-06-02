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
  let guildId = String(process.env.DISCORD_GUILD_ID || rolesFile.guildId || '').trim();
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
  const merged = new Set((rolesFile.adminDiscordIds || []).map(String));

  const raw = process.env.STORE_ADMIN_DISCORD_IDS || process.env.DISCORD_STORE_ADMIN_USER_IDS;
  if (raw != null && String(raw).trim()) {
    parseRoleList(raw).forEach((id) => merged.add(String(id)));
  }

  return [...merged];
}

function isAdminDiscordUser(discordId) {
  if (!discordId) return false;
  const ids = getAdminDiscordIds().map(String);
  if (!ids.length) return false;
  return ids.includes(String(discordId));
}

/** Waarschuwing: rol-ID per ongeluk in STORE_ADMIN_DISCORD_IDS gezet */
function getMisconfiguredAllowlistRoleIds() {
  const allowlist = getAdminDiscordIds().map(String);
  if (!allowlist.length) return [];

  const roleIdSet = new Set();
  getAdminRoleTokens().forEach((token) => {
    const normalized = normalizeRoleToken(token);
    if (normalized.kind === 'id') roleIdSet.add(normalized.value);
  });
  (rolesFile.ranks || []).forEach((rank) => {
    if (rank.discordRoleId) roleIdSet.add(String(rank.discordRoleId));
  });

  return allowlist.filter((id) => roleIdSet.has(String(id)));
}

async function getMemberRolesViaOAuth(accessToken, userId) {
  if (!accessToken || !userId) return { roles: [], error: 'no_oauth_token' };

  let guildId;
  try {
    guildId = getGuildId();
  } catch (err) {
    return { roles: [], error: err.message };
  }

  const res = await fetch(`https://discord.com/api/v10/users/@me/guilds/${guildId}/member`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (res.status === 404) {
    return { roles: [], error: 'Je zit niet op de URP Discord (OAuth guild check).' };
  }
  if (!res.ok) {
    return {
      roles: [],
      error:
        'OAuth kan je Discord-rollen niet lezen — log opnieuw in (scope guilds.members.read) of fix de bot.',
    };
  }

  const data = await res.json();
  if (String(data.user?.id || '') !== String(userId)) {
    return { roles: [], error: 'Discord OAuth sessie hoort niet bij dit account.' };
  }

  return { roles: (data.roles || []).map(String), error: null };
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
  const resolved = [];
  const unresolved = [];

  tokens.forEach((token) => {
    if (token.kind === 'id') {
      resolved.push(token.value);
      return;
    }
    unresolved.push(token.value);
  });

  if (unresolved.length) {
    try {
      const guildRoles = await getGuildRoles();
      const { byName } = buildRoleLookup(guildRoles);
      unresolved.forEach((name) => {
        const id = byName.get(name.toLowerCase());
        if (id) resolved.push(id);
      });
    } catch {
      /* rol-namen niet opgelost — numerieke IDs uit config werken nog steeds */
    }
  }

  return {
    roleIds: [...new Set(resolved.map(String))],
    unresolved,
    tokens: getAdminRoleTokens(),
  };
}

async function loadRoleNameLookup() {
  try {
    const guildRoles = await getGuildRoles();
    return buildRoleLookup(guildRoles).byId;
  } catch {
    return new Map();
  }
}

function buildAdminAuthPayload(discordId, profile, admin, extras = {}) {
  const byId = extras.byId || new Map();
  let guildIdSuffix = '??????';
  try {
    guildIdSuffix = getGuildId().slice(-6);
  } catch {
    /* ok */
  }
  return {
    username: profile.username || profile.discordUsername || 'Gebruiker',
    discordUsername: profile.discordUsername || null,
    discordId: String(discordId),
    avatarUrl: profile.avatarUrl || null,
    isAdmin: Boolean(extras.isAdmin),
    memberRoleIds: extras.memberRoleIds || [],
    memberRoles: roleSummaries(extras.memberRoleIds || [], byId),
    requiredRoleIds: admin.roleIds,
    requiredRoles: roleSummaries(admin.roleIds, byId),
    matchedAdminRoleIds: extras.matchedAdminRoleIds || [],
    configuredRoleTokens: admin.tokens,
    unresolvedRoleTokens: admin.unresolved,
    guildIdSuffix,
    adminViaUserAllowlist: extras.adminViaUserAllowlist || false,
    misconfiguredAllowlistRoleIds: extras.misconfiguredAllowlistRoleIds || [],
    allowlistCount: extras.allowlistCount || 0,
    roleSource: extras.roleSource || null,
    error: extras.error || null,
  };
}

async function buildMemberAuthPayload(discordId, profile = {}, options = {}) {
  const id = String(discordId);
  const misconfiguredAllowlistRoleIds = getMisconfiguredAllowlistRoleIds();

  if (isAdminDiscordUser(id)) {
    const admin = await resolveAdminRoleIds();
    const byId = await loadRoleNameLookup();
    return buildAdminAuthPayload(id, profile, admin, {
      isAdmin: true,
      adminViaUserAllowlist: true,
      byId,
      misconfiguredAllowlistRoleIds,
      allowlistCount: getAdminDiscordIds().length,
    });
  }

  const admin = await resolveAdminRoleIds();
  const byId = await loadRoleNameLookup();

  let memberRoles = [];
  let displayName = profile.username || profile.discordUsername;
  let guildError = null;
  let roleSource = null;

  try {
    const member = await getGuildMember(id);
    memberRoles = member.roles || [];
    displayName = member.nick || displayName;
    roleSource = 'bot';
  } catch (err) {
    guildError = err.message;

    if (options.accessToken) {
      const oauthMember = await getMemberRolesViaOAuth(options.accessToken, id);
      if (oauthMember.roles.length) {
        memberRoles = oauthMember.roles;
        guildError = null;
        roleSource = 'oauth';
      } else if (oauthMember.error && !guildError.includes('Discord server')) {
        guildError = guildError + ' | OAuth: ' + oauthMember.error;
      }
    }
  }

  const isAdmin = isAdminWithResolvedIds(memberRoles, admin.roleIds);
  const matchedAdminRoleIds = admin.roleIds.filter((roleId) =>
    memberRoles.map(String).includes(String(roleId))
  );

  return buildAdminAuthPayload(
    id,
    { ...profile, username: displayName || profile.username },
    admin,
    {
      isAdmin,
      memberRoleIds: memberRoles.map(String),
      matchedAdminRoleIds,
      byId,
      error: guildError,
      roleSource,
      misconfiguredAllowlistRoleIds,
      allowlistCount: getAdminDiscordIds().length,
    }
  );
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

async function verifyStoreMemberByDiscordId(discordId, profile = {}, options = {}) {
  return buildMemberAuthPayload(discordId, profile, options);
}

async function verifyStoreMember(accessToken) {
  const userRes = await fetch('https://discord.com/api/v10/users/@me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!userRes.ok) throw new Error('Discord sessie verlopen. Log opnieuw in.');
  const user = await userRes.json();

  const payload = await buildMemberAuthPayload(
    user.id,
    {
      username: user.global_name || user.username,
      discordUsername: user.username,
      avatarUrl: avatarUrlFromUser(user),
    },
    { accessToken }
  );

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

function getAdminDiagnostics() {
  let guildIdSuffix = '??????';
  let guildIdSet = false;
  try {
    const guildId = getGuildId();
    guildIdSet = true;
    guildIdSuffix = guildId.slice(-6);
  } catch {
    /* ok */
  }

  return {
    guildIdSuffix,
    guildIdSet,
    botTokenSet: Boolean(process.env.DISCORD_BOT_TOKEN),
    clientSecretSet: Boolean(process.env.DISCORD_CLIENT_SECRET),
    configuredRoleIds: getAdminRoleTokens(),
    allowlistCount: getAdminDiscordIds().length,
    misconfiguredAllowlistRoleIds: getMisconfiguredAllowlistRoleIds(),
  };
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
  getAdminDiagnostics,
  getAdminDiscordIds,
};
