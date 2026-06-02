const { cors, json, readBody } = require('../store/http');
const { requireDiscordAndFivem } = require('../store/session');
const { saveState } = require('../store/blob-store');
const { findUserInState, purchaseOne } = require('../store/purchase-core');

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return json(res, 405, { error: 'Alleen POST' });

  try {
    const ctx = await requireDiscordAndFivem(req.headers.authorization);
    const body = await readBody(req);
    const productId = body.productId;
    if (!productId) return json(res, 400, { error: 'productId ontbreekt' });

    let order = null;
    let newBalance = 0;

    await saveState((state) => {
      const user = findUserInState(state, ctx.user);
      if (!user) throw new Error('Gebruiker niet gevonden');
      const result = purchaseOne(state, user, productId);
      order = result.order;
      newBalance = result.coins;
      return state;
    });

    return json(res, 200, {
      ok: true,
      orderId: order.id,
      coins: newBalance,
      message:
        order.productType === 'vehicle'
          ? 'Aankoop gelukt — voertuig staat binnen enkele seconden in je garage (open je garage in-game).'
          : 'Aankoop gelukt — item komt binnen enkele seconden in je ox_inventory (je moet online zijn).',
    });
  } catch (err) {
    console.error('store-purchase:', err);
    const msg = err.message || 'Aankoop mislukt';
    const code = /log|discord|fivem|koppel/i.test(msg) ? 401 : 400;
    return json(res, code, { error: msg });
  }
};
