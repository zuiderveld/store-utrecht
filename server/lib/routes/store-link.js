const { cors, json, readBody } = require('../store/http');
const { requireAuth } = require('../store/session');
const { createLinkCode } = require('../store/discord-store');
const { saveState } = require('../store/state-store');

const CODE_TTL_MS = 10 * 60 * 1000;

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return json(res, 405, { error: 'Alleen POST' });

  try {
    const ctx = await requireAuth(req.headers.authorization);

    if (!ctx.user.discordId) {
      return json(res, 400, { error: 'Koppel eerst Discord voordat je FiveM koppelt.' });
    }

    const code = createLinkCode();
    const expiresAt = Date.now() + CODE_TTL_MS;

    await saveState((state) => {
      state.linkCodes[code] = {
        userId: ctx.user.userId || ctx.user.discordId,
        discordId: ctx.user.discordId,
        expiresAt,
      };
      return state;
    });

    return json(res, 200, {
      code,
      expiresAt,
      instruction: 'Ga in-game en typ: /koppelstore ' + code,
    });
  } catch (err) {
    console.error('store-link:', err);
    const msg = err.message || 'Koppelcode mislukt';
    const code = /log|discord|in/i.test(msg) ? 401 : 400;
    return json(res, code, { error: msg });
  }
};
