const crypto = require('crypto');

function getClientId() {
  return process.env.DISCORD_STORE_CLIENT_ID || process.env.DISCORD_CLIENT_ID || '';
}

function getAdminRoleIds() {
  const raw = process.env.DISCORD_STORE_ADMIN_ROLES || '';
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

async function exchangeCode(code, redirectUri) {
  const clientId = getClientId();
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('DISCORD_STORE_CLIENT_ID en DISCORD_CLIENT_SECRET ontbreken in Vercel.');
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

async function fetchDiscordUser(accessToken) {
  const res = await fetch('https://discord.com/api/users/@me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error('Discord profiel ophalen mislukt');
  return data;
}

async function getGuildMember(userId) {
  const token = process.env.DISCORD_BOT_TOKEN;
  const guildId = process.env.DISCORD_GUILD_ID;
  if (!token || !guildId) return null;

  const res = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${userId}`, {
    headers: { Authorization: `Bot ${token}` },
  });
  if (!res.ok) return null;
  return res.json();
}

function isAdmin(memberRoles) {
  const adminIds = getAdminRoleIds();
  if (!adminIds.length) return false;
  if (!memberRoles?.length) return false;
  return adminIds.some((id) => memberRoles.includes(id));
}

function createSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

function createLinkCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

module.exports = {
  getClientId,
  getAdminRoleIds,
  exchangeCode,
  fetchDiscordUser,
  getGuildMember,
  isAdmin,
  createSessionToken,
  createLinkCode,
};
