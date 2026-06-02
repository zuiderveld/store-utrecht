const { cors, json, readBody } = require('../store/http');
const {
  verifyAdminCredentials,
  createAdminSession,
  resolveAdminSession,
  revokeAdminSession,
  getConfiguredAdminUser,
} = require('../store/admin-auth');

function bearerToken(req) {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7).trim();
  return '';
}

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return json(res, 405, { error: 'Alleen POST' });

  try {
    const body = await readBody(req);
    const action = body.action || req.query?.action;

    if (action === 'login') {
      const username = String(body.username || '').trim();
      const password = String(body.password || '');

      if (!username || !password) {
        return json(res, 400, { error: 'Gebruikersnaam en wachtwoord verplicht.' });
      }

      const ok = verifyAdminCredentials(username, password);
      if (!ok) {
        return json(res, 401, { error: 'Onjuiste gebruikersnaam of wachtwoord.' });
      }

      const accessToken = await createAdminSession(username);
      return json(res, 200, {
        ok: true,
        username,
        accessToken,
        loginMethod: 'admin-password',
      });
    }

    if (action === 'me') {
      const token = bearerToken(req);
      const session = await resolveAdminSession(token);
      if (!session) {
        return json(res, 401, { error: 'Niet ingelogd of sessie verlopen.', ok: false });
      }
      return json(res, 200, {
        ok: true,
        username: session.username,
        loginMethod: 'admin-password',
      });
    }

    if (action === 'logout') {
      const token = bearerToken(req);
      if (token) await revokeAdminSession(token);
      return json(res, 200, { ok: true });
    }

    if (action === 'config') {
      return json(res, 200, {
        ok: true,
        usernameHint: getConfiguredAdminUser(),
        passwordConfigured: Boolean(process.env.STORE_ADMIN_PASSWORD),
      });
    }

    return json(res, 400, {
      error: 'Onbekende actie',
      actions: ['login', 'logout', 'me', 'config'],
    });
  } catch (err) {
    console.error('store-admin-auth:', err);
    return json(res, 500, { error: err.message || 'Admin login mislukt' });
  }
};
