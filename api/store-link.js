const { cors, json, readBody } = require('../server/lib/store/http');
const { resolveSession } = require('../server/lib/store/session');
const { createLinkCode } = require('../server/lib/store/discord-store');
const { saveState } = require('../server/lib/store/blob-store');

const CODE_TTL_MS = 10 * 60 * 1000;

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return json(res, 405, { error: 'Alleen POST' });

  try {
    const ctx = await resolveSession(req.headers.authorization);
    if (!ctx) return json(res, 401, { error: 'Log eerst in met Discord' });

    const code = createLinkCode();
    const expiresAt = Date.now() + CODE_TTL_MS;

    await saveState((state) => {
      state.linkCodes[code] = {
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
    return json(res, 500, { error: err.message || 'Koppelcode mislukt' });
  }
};
