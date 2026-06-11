const { cors, json, readBody } = require('../store/http');
const {
  verifyAdminCredentials,
  createAdminSession,
  resolveAdminSession,
  revokeAdminSession,
  getAdminUsernames,
  hasAdminAccounts,
} = require('../store/admin-auth');
const { exchangeCode, verifyStoreMember } = require('../store/discord-store');
const { logStoreAdminLogin } = require('../store/discord-webhooks');

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

    if (action === 'discord-login') {
      const code = body.code;
      const redirectUri = body.redirectUri;
      if (!code || !redirectUri) {
        return json(res, 400, { error: 'Discord code ontbreekt — probeer opnieuw.' });
      }

      const discordAccess = await exchangeCode(code, redirectUri);
      const discord = await verifyStoreMember(discordAccess);

      if (!discord.isAdmin) {
        return json(res, 403, {
          error: 'Geen Store Beheer rol op Discord.',
          isAdmin: false,
          discordId: discord.discordId,
          username: discord.username,
          requiredRoleIds: discord.requiredRoleIds,
          memberRoleIds: discord.memberRoleIds,
          memberRoles: discord.memberRoles,
          guildIdSuffix: discord.guildIdSuffix,
        });
      }

      const accessToken = await createAdminSession(discord.username, 'discord');
      logStoreAdminLogin({ username: discord.username, method: 'discord' });
      return json(res, 200, {
        ok: true,
        username: discord.username,
        avatarUrl: discord.avatarUrl,
        discordId: discord.discordId,
        accessToken,
        loginMethod: 'discord',
      });
    }

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
      logStoreAdminLogin({ username, method: 'admin-password' });
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
        loginMethod: session.loginMethod || 'admin-password',
      });
    }

    if (action === 'logout') {
      const token = bearerToken(req);
      if (token) await revokeAdminSession(token);
      return json(res, 200, { ok: true });
    }

    if (action === 'config') {
      const usernames = getAdminUsernames();
      return json(res, 200, {
        ok: true,
        usernames,
        usernameHint: usernames[0] || 'admin',
        passwordConfigured: hasAdminAccounts(),
        multiUser: usernames.length > 1,
      });
    }

    return json(res, 400, {
      error: 'Onbekende actie',
      actions: ['login', 'discord-login', 'logout', 'me', 'config'],
    });
  } catch (err) {
    console.error('store-admin-auth:', err);
    return json(res, 500, { error: err.message || 'Admin login mislukt' });
  }
};
