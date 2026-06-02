const crypto = require('crypto');
const { cors, json, readBody } = require('../store/http');
const { saveState, getState } = require('../store/blob-store');
const { hashPassword, verifyPassword, normalizeEmail, isValidEmail } = require('../store/password');
const { createSession, userPayload } = require('../store/auth-sessions');

function validatePassword(password) {
  if (!password || password.length < 8) {
    throw new Error('Wachtwoord moet minimaal 8 tekens zijn');
  }
}

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return json(res, 405, { error: 'Alleen POST' });

  try {
    const body = await readBody(req);
    const action = body.action || req.query?.action;

    if (action === 'register') {
      const email = normalizeEmail(body.email);
      const password = body.password;
      const displayName = String(body.displayName || body.username || '').trim().slice(0, 40);

      if (!isValidEmail(email)) return json(res, 400, { error: 'Ongeldig e-mailadres' });
      validatePassword(password);
      if (!displayName) return json(res, 400, { error: 'Kies een weergavenaam' });

      let token = null;
      let profile = null;

      await saveState((state) => {
        if (!state.emailIndex) state.emailIndex = {};
        if (state.emailIndex[email]) throw new Error('Dit e-mailadres is al geregistreerd');

        const userId = 'em_' + crypto.randomBytes(8).toString('hex');
        const { salt, hash } = hashPassword(password);

        state.users[userId] = {
          userId,
          email,
          displayName,
          username: displayName,
          passwordSalt: salt,
          passwordHash: hash,
          discordId: null,
          coins: 0,
          license: null,
          identifiers: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        state.emailIndex[email] = userId;
        token = createSession(state, userId);
        profile = userPayload(state.users[userId]);
        return state;
      });

      return json(res, 200, {
        ...profile,
        accessToken: token,
        message: 'Account aangemaakt. Koppel Discord en FiveM om te kunnen kopen.',
      });
    }

    if (action === 'login') {
      const email = normalizeEmail(body.email);
      const password = body.password;
      if (!email || !password) return json(res, 400, { error: 'E-mail en wachtwoord verplicht' });

      let token = null;
      let profile = null;

      await saveState((state) => {
        const user = state.emailIndex?.[email] ? state.users[state.emailIndex[email]] : null;
        if (!user || !verifyPassword(password, user.passwordSalt, user.passwordHash)) {
          throw new Error('Onjuist e-mailadres of wachtwoord');
        }
        user.updatedAt = Date.now();
        token = createSession(state, user.userId);
        profile = userPayload(user);
        return state;
      });

      return json(res, 200, { ...profile, accessToken: token });
    }

    if (action === 'logout') {
      const authHeader = req.headers.authorization || '';
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
      if (token) {
        await saveState((state) => {
          const { revokeSession, isStoreSessionToken } = require('../store/auth-sessions');
          if (isStoreSessionToken(token)) revokeSession(state, token);
          return state;
        });
      }
      return json(res, 200, { ok: true });
    }

    return json(res, 400, { error: 'Onbekende actie', actions: ['register', 'login', 'logout'] });
  } catch (err) {
    console.error('store-email-auth:', err);
    return json(res, 400, { error: err.message || 'Mislukt' });
  }
};
