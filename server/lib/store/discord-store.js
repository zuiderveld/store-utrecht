const rolesFile = require('./discord-roles');

function getClientId() {
  return process.env.DISCORD_CLIENT_ID || rolesFile.clientId;
}

function getAdminRoleIds() {
  const fromStore = process.env.DISCORD_STORE_ADMIN_ROLES;
  if (fromStore) return fromStore.split(',').map((s) => s.trim()).filter(Boolean);
  const fromBeheer = process.env.DISCORD_STAFF_BEHEER_ROLES;
  if (fromBeheer) return fromBeheer.split(',').map((s) => s.trim()).filter(Boolean);
  return rolesFile.beheerRoleIds || [];
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
  const token = process.env.DISCORD_BOT_TOKEN;
  const guildId = process.env.DISCORD_GUILD_ID;
  if (!token || !guildId) {
    throw new Error('DISCORD_BOT_TOKEN en DISCORD_GUILD_ID zijn verplicht.');
  }

  const res = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${userId}`, {
    headers: { Authorization: `Bot ${token}` },
  });

  if (!res.ok) {
    throw new Error('Je zit niet op de URP Discord server, of de bot mist rechten.');
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

function isAdmin(memberRoles) {
  const adminIds = getAdminRoleIds().map(String);
  if (!adminIds.length || !memberRoles?.length) return false;
  const roles = memberRoles.map(String);
  return adminIds.some((id) => roles.includes(id));
}

async function verifyStoreMember(accessToken) {
  const userRes = await fetch('https://discord.com/api/v10/users/@me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!userRes.ok) throw new Error('Discord sessie verlopen. Log opnieuw in.');
  const user = await userRes.json();

  const member = await getGuildMember(user.id);
  const memberRoles = member.roles || [];
  const displayName = member.nick || user.global_name || user.username;

  return {
    username: displayName,
    discordUsername: user.username,
    discordId: user.id,
    avatarUrl: avatarUrlFromUser(user),
    accessToken,
    isAdmin: isAdmin(memberRoles),
    memberRoleIds: memberRoles,
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
  createLinkCode,
  getAdminRoleIds,
};
