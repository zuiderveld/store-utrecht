const crypto = require('crypto');
const { saveState, getState } = require('./blob-store');

const ADMIN_PREFIX = 'urp_admin_';
const ADMIN_TTL_MS = 12 * 60 * 60 * 1000;

function isAdminSessionToken(token) {
  return typeof token === 'string' && token.startsWith(ADMIN_PREFIX);
}

function getConfiguredAdminUser() {
  return String(process.env.STORE_ADMIN_USER || 'admin').trim() || 'admin';
}

function verifyAdminCredentials(username, password) {
  const expectedPass = process.env.STORE_ADMIN_PASSWORD || '';
  const expectedUser = getConfiguredAdminUser();

  if (!expectedPass) {
    throw new Error('STORE_ADMIN_PASSWORD ontbreekt in Vercel environment variables.');
  }

  const userOk = String(username || '').trim() === expectedUser;
  if (!userOk) return false;

  try {
    const a = Buffer.from(String(password || ''));
    const b = Buffer.from(String(expectedPass));
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function createAdminSessionToken() {
  return ADMIN_PREFIX + crypto.randomBytes(24).toString('hex');
}

async function createAdminSession(username) {
  const token = createAdminSessionToken();
  await saveState((state) => {
    if (!state.adminSessions) state.adminSessions = {};
    state.adminSessions[token] = {
      username: username || getConfiguredAdminUser(),
      expiresAt: Date.now() + ADMIN_TTL_MS,
      createdAt: Date.now(),
    };
    return state;
  });
  return token;
}

async function resolveAdminSession(token) {
  if (!isAdminSessionToken(token)) return null;

  const state = await getState();
  const entry = state.adminSessions?.[token];
  if (!entry || entry.expiresAt < Date.now()) {
    if (entry) {
      await saveState((s) => {
        if (s.adminSessions?.[token]) delete s.adminSessions[token];
        return s;
      });
    }
    return null;
  }

  return { username: entry.username, token };
}

async function revokeAdminSession(token) {
  if (!isAdminSessionToken(token)) return;
  await saveState((state) => {
    if (state.adminSessions?.[token]) delete state.adminSessions[token];
    return state;
  });
}

function getAccessToken(authHeader) {
  if (!authHeader?.startsWith('Bearer ')) return '';
  return authHeader.slice(7).trim();
}

async function requireAdminAuth(authHeader) {
  const token = getAccessToken(authHeader);
  if (!token) throw new Error('Niet ingelogd — log in op het beheerpaneel.');

  const session = await resolveAdminSession(token);
  if (!session) throw new Error('Sessie verlopen — log opnieuw in.');

  return {
    accessToken: token,
    username: session.username,
    isAdmin: true,
    authType: 'admin-password',
  };
}

module.exports = {
  isAdminSessionToken,
  verifyAdminCredentials,
  createAdminSession,
  resolveAdminSession,
  revokeAdminSession,
  requireAdminAuth,
  getConfiguredAdminUser,
};
