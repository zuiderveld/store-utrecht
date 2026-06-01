const { saveState, getState } = require('./blob-store');

const SESSION_MS = 7 * 24 * 60 * 60 * 1000;

async function createSession(discordUser, extra = {}) {
  const token = require('./discord-store').createSessionToken();
  const now = Date.now();

  await saveState((state) => {
    if (!state.users[discordUser.id]) {
      state.users[discordUser.id] = {
        discordId: discordUser.id,
        username: discordUser.username,
        globalName: discordUser.global_name || discordUser.username,
        avatar: discordUser.avatar,
        coins: 0,
        license: null,
        identifiers: [],
        linkedAt: null,
        updatedAt: now,
      };
    } else {
      state.users[discordUser.id].username = discordUser.username;
      state.users[discordUser.id].globalName = discordUser.global_name || discordUser.username;
      state.users[discordUser.id].avatar = discordUser.avatar;
      state.users[discordUser.id].updatedAt = now;
    }

    state.sessions[token] = {
      discordId: discordUser.id,
      createdAt: now,
      expiresAt: now + SESSION_MS,
      ...extra,
    };
    return state;
  });

  return token;
}

async function resolveSession(authHeader) {
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7).trim();
  if (!token) return null;

  const state = await getState();
  const sess = state.sessions[token];
  if (!sess || sess.expiresAt < Date.now()) return null;

  const user = state.users[sess.discordId];
  if (!user) return null;

  return { token, session: sess, user, state };
}

async function requireAdmin(authHeader) {
  const ctx = await resolveSession(authHeader);
  if (!ctx) throw new Error('Niet ingelogd');
  if (!ctx.session.isAdmin) throw new Error('Geen store-beheer rechten');
  return ctx;
}

module.exports = { createSession, resolveSession, requireAdmin, SESSION_MS };
