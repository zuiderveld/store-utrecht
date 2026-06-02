const crypto = require('crypto');

const SESSION_PREFIX = 'urp_';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function createSessionToken() {
  return SESSION_PREFIX + crypto.randomBytes(24).toString('hex');
}

function isStoreSessionToken(token) {
  return typeof token === 'string' && token.startsWith(SESSION_PREFIX);
}

function createSession(state, userId) {
  const token = createSessionToken();
  if (!state.authSessions) state.authSessions = {};
  state.authSessions[token] = {
    userId,
    expiresAt: Date.now() + SESSION_TTL_MS,
  };
  return token;
}

function resolveSessionUserId(state, token) {
  if (!isStoreSessionToken(token)) return null;
  const entry = state.authSessions?.[token];
  if (!entry || entry.expiresAt < Date.now()) {
    if (entry && state.authSessions) delete state.authSessions[token];
    return null;
  }
  return entry.userId;
}

function revokeSession(state, token) {
  if (state.authSessions?.[token]) delete state.authSessions[token];
}

function findUser(state, userId) {
  if (!userId) return null;
  if (state.users[userId]) return state.users[userId];
  return Object.values(state.users || {}).find((u) => u.userId === userId || u.discordId === userId) || null;
}

function findUserByDiscordId(state, discordId) {
  if (!discordId) return null;
  if (state.users[discordId]) return state.users[discordId];
  return Object.values(state.users || {}).find((u) => u.discordId === discordId) || null;
}

function findUserByEmail(state, email) {
  const key = state.emailIndex?.[email];
  if (!key) return null;
  return state.users[key] || null;
}

function userPayload(user, extras = {}) {
  const discordLinked = Boolean(user.discordId);
  const fivemLinked = Boolean(user.license);
  return {
    userId: user.userId || user.discordId,
    username: user.globalName || user.username || user.displayName || 'Speler',
    email: user.email || null,
    discordId: user.discordId || null,
    discordUsername: user.discordUsername || null,
    avatarUrl: user.avatarUrl || null,
    coins: user.coins || 0,
    license: user.license || null,
    linked: fivemLinked,
    discordLinked,
    fivemLinked,
    loginMethod: user.email ? (discordLinked ? 'email+discord' : 'email') : 'discord',
    isAdmin: extras.isAdmin || false,
    canUseCoins: discordLinked && fivemLinked,
  };
}

module.exports = {
  createSession,
  resolveSessionUserId,
  revokeSession,
  isStoreSessionToken,
  findUser,
  findUserByDiscordId,
  findUserByEmail,
  userPayload,
};
