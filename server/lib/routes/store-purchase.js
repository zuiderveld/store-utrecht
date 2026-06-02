const { cors, json, readBody } = require('../store/http');
const { requireDiscordAndFivem } = require('../store/session');
const { assertStoreOpen } = require('./store-maintenance');
const { saveState } = require('../store/blob-store');
const { findUserInState, purchaseOne } = require('../store/purchase-core');
const { processPendingDiscordRoleOrders, purchaseMessageForOrder } = require('../store/discord-role-fulfill');

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return json(res, 405, { error: 'Alleen POST' });

  try {
    await assertStoreOpen();
    const ctx = await requireDiscordAndFivem(req.headers.authorization);
    const body = await readBody(req);
    const productId = body.productId;
    if (!productId) return json(res, 400, { error: 'productId ontbreekt' });

    let order = null;
    let newBalance = 0;

    await saveState(async (state) => {
      const user = findUserInState(state, ctx.user);
      if (!user) throw new Error('Gebruiker niet gevonden');
      const result = purchaseOne(state, user, productId);
      order = result.order;
      newBalance = result.coins;
      await processPendingDiscordRoleOrders(state);
      return state;
    });

    return json(res, 200, {
      ok: true,
      orderId: order.id,
      coins: newBalance,
      message: purchaseMessageForOrder(order),
    });
  } catch (err) {
    console.error('store-purchase:', err);
    const msg = err.message || 'Aankoop mislukt';
    const code = /log|discord|fivem|koppel/i.test(msg) ? 401 : 400;
    return json(res, code, { error: msg });
  }
};
