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

function parseAdminUserEntries() {
  const map = new Map();

  const multi = process.env.STORE_ADMIN_USERS;
  if (multi != null && String(multi).trim()) {
    String(multi)
      .split(/[,;\n]+/)
      .forEach((entry) => {
        const line = entry.trim();
        if (!line) return;
        const idx = line.indexOf(':');
        if (idx <= 0) return;
        const user = line.slice(0, idx).trim();
        const pass = line.slice(idx + 1);
        if (!user || !pass) return;
        map.set(user.toLowerCase(), { user, pass });
      });
  }

  const singlePass = process.env.STORE_ADMIN_PASSWORD || '';
  const singleUser = getConfiguredAdminUser();
  if (singlePass) {
    map.set(singleUser.toLowerCase(), { user: singleUser, pass: singlePass });
  }

  return map;
}

function hasAdminAccounts() {
  return parseAdminUserEntries().size > 0;
}

function getAdminUsernames() {
  return [...parseAdminUserEntries().values()].map((e) => e.user);
}

function safeEqual(a, b) {
  try {
    const left = Buffer.from(String(a));
    const right = Buffer.from(String(b));
    if (left.length !== right.length) return false;
    return crypto.timingSafeEqual(left, right);
  } catch {
    return false;
  }
}

function verifyAdminCredentials(username, password) {
  const entries = parseAdminUserEntries();
  if (!entries.size) {
    throw new Error(
      'Geen admin accounts — zet STORE_ADMIN_USERS of STORE_ADMIN_PASSWORD in Vercel.'
    );
  }

  const key = String(username || '').trim().toLowerCase();
  const entry = entries.get(key);
  if (!entry) return false;

  return safeEqual(password, entry.pass);
}

function resolveAdminUsername(username) {
  const key = String(username || '').trim().toLowerCase();
  return parseAdminUserEntries().get(key)?.user || String(username || '').trim();
}

function createAdminSessionToken() {
  return ADMIN_PREFIX + crypto.randomBytes(24).toString('hex');
}

async function createAdminSession(username, loginMethod) {
  const token = createAdminSessionToken();
  const displayName = resolveAdminUsername(username) || getConfiguredAdminUser();
  const method = loginMethod === 'discord' ? 'discord' : 'admin-password';

  await saveState((state) => {
    if (!state.adminSessions) state.adminSessions = {};
    state.adminSessions[token] = {
      username: displayName,
      loginMethod: method,
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

  return {
    username: entry.username,
    token,
    loginMethod: entry.loginMethod || 'admin-password',
  };
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
  getAdminUsernames,
  hasAdminAccounts,
};
