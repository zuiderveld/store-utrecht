const { cors, json, readBody } = require('../server/lib/store/http');
const { exchangeCode, fetchDiscordUser, getGuildMember, isAdmin } = require('../server/lib/store/discord-store');
const { createSession } = require('../server/lib/store/session');

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return json(res, 405, { error: 'Alleen POST' });

  try {
    const body = await readBody(req);
    let accessToken = body.accessToken;

    if (body.code) {
      if (!body.redirectUri) return json(res, 400, { error: 'redirectUri ontbreekt' });
      accessToken = await exchangeCode(body.code, body.redirectUri);
    }
    if (!accessToken) return json(res, 400, { error: 'Geen Discord code of token' });

    const discordUser = await fetchDiscordUser(accessToken);
    const member = await getGuildMember(discordUser.id);
    const roles = member?.roles || [];
    const admin = isAdmin(roles);

    const token = await createSession(discordUser, { isAdmin: admin });

    const { getState } = require('../server/lib/store/blob-store');
    const state = await getState();
    const user = state.users[discordUser.id] || {};

    return json(res, 200, {
      token,
      user: {
        discordId: discordUser.id,
        username: user.globalName || user.username || discordUser.username,
        avatar: discordUser.avatar,
        coins: user.coins || 0,
        license: user.license || null,
        linked: Boolean(user.license),
        isAdmin: admin,
      },
    });
  } catch (err) {
    console.error('store-auth:', err);
    return json(res, 403, { error: err.message || 'Inloggen mislukt' });
  }
};
