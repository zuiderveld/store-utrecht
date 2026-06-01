const { cors, json, readBody } = require('../server/lib/store/http');
const { exchangeCode, verifyStoreMember } = require('../server/lib/store/discord-store');
const { upsertUserFromDiscord } = require('../server/lib/store/session');
const { getState } = require('../server/lib/store/blob-store');

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
    await upsertUserFromDiscord(discord);

    const state = await getState();
    const user = state.users[discord.discordId] || {};

    return json(res, 200, {
      username: discord.username,
      discordUsername: discord.discordUsername,
      discordId: discord.discordId,
      avatarUrl: discord.avatarUrl,
      accessToken: discord.accessToken,
      isAdmin: discord.isAdmin,
      coins: user.coins || 0,
      license: user.license || null,
      linked: Boolean(user.license),
    });
  } catch (err) {
    console.error('store-auth:', err);
    return json(res, 403, { error: err.message || 'Inloggen mislukt' });
  }
};
