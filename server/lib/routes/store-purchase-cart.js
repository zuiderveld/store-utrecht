const { cors, json, readBody } = require('../store/http');
const { requireDiscordAndFivem } = require('../store/session');
const { assertStoreOpen } = require('./store-maintenance');
const { saveState } = require('../store/blob-store');
const { findUserInState, purchaseCart, normalizeProductIds } = require('../store/purchase-core');
const { processPendingDiscordRoleOrders } = require('../store/discord-role-fulfill');

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return json(res, 405, { error: 'Alleen POST' });

  try {
    await assertStoreOpen();
    const ctx = await requireDiscordAndFivem(req.headers.authorization);
    const body = await readBody(req);
    const productIds = normalizeProductIds(body.productIds);
    if (!productIds.length) return json(res, 400, { error: 'Geen producten geselecteerd' });

    let orders = [];
    let newBalance = 0;
    let total = 0;

    await saveState(async (state) => {
      const user = findUserInState(state, ctx.user);
      if (!user) throw new Error('Gebruiker niet gevonden');
      const result = purchaseCart(state, user, productIds);
      orders = result.orders;
      newBalance = result.coins;
      total = result.total;
      await processPendingDiscordRoleOrders(state);
      return state;
    });

    return json(res, 200, {
      ok: true,
      orderIds: orders.map((o) => o.id),
      coins: newBalance,
      total,
      message: 'Aankoop gelukt — je items worden verwerkt.',
    });
  } catch (err) {
    console.error('store-purchase-cart:', err);
    const msg = err.message || 'Aankoop mislukt';
    const code = /log|discord|fivem|koppel/i.test(msg) ? 401 : 400;
    return json(res, code, { error: msg });
  }
};
