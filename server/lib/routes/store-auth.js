const { cors, json, readBody } = require('../store/http');
const { exchangeCode, verifyStoreMember } = require('../store/discord-store');
const { upsertDiscordUser, linkDiscordToEmailUser, buildMe } = require('../store/session');
const { getState } = require('../store/blob-store');
const { findUser, findUserByDiscordId } = require('../store/auth-sessions');

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

    const discord = await verifyStoreMember(accessToken);

    if (body.linkUserId && String(body.linkUserId).startsWith('em_')) {
      await linkDiscordToEmailUser(body.linkUserId, discord);
    } else {
      await upsertDiscordUser(discord);
    }

    const state = await getState();
    const user = body.linkUserId
      ? findUser(state, body.linkUserId)
      : findUserByDiscordId(state, discord.discordId) || state.users[discord.discordId] || {};

    const me = buildMe({ user, isAdmin: discord.isAdmin });

    return json(res, 200, {
      ...me,
      accessToken: discord.accessToken,
      message: body.linkUserId ? 'Discord gekoppeld aan je account!' : undefined,
    });
  } catch (err) {
    console.error('store-auth:', err);
    return json(res, 403, { error: err.message || 'Inloggen mislukt' });
  }
};
