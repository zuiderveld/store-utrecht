const crypto = require('crypto');
const { cors, json, readBody } = require('../server/lib/store/http');
const { resolveSession } = require('../server/lib/store/session');
const { saveState } = require('../server/lib/store/blob-store');

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return json(res, 405, { error: 'Alleen POST' });

  try {
    const ctx = await resolveSession(req.headers.authorization);
    if (!ctx) return json(res, 401, { error: 'Log eerst in met Discord' });
    if (!ctx.user.license) {
      return json(res, 400, { error: 'Koppel eerst je FiveM account (/koppelstore in-game)' });
    }

    const body = await readBody(req);
    const productId = body.productId;
    if (!productId) return json(res, 400, { error: 'productId ontbreekt' });

    let order = null;
    let newBalance = 0;

    await saveState((state) => {
      const product = state.products.find((p) => p.id === productId && p.active !== false);
      if (!product) throw new Error('Product niet gevonden');

      const user = state.users[ctx.user.discordId];
      if (!user) throw new Error('Gebruiker niet gevonden');
      const price = Number(product.price) || 0;
      const coins = Number(user.coins) || 0;
      if (coins < price) throw new Error('Onvoldoende coins');

      user.coins = coins - price;
      user.updatedAt = Date.now();
      newBalance = user.coins;

      order = {
        id: 'ord_' + crypto.randomBytes(8).toString('hex'),
        discordId: user.discordId,
        license: user.license,
        identifiers: user.identifiers || [],
        productId: product.id,
        productName: product.name,
        productType: product.type || 'item',
        price,
        meta: product.meta || {},
        status: 'pending',
        createdAt: Date.now(),
      };
      state.orders.unshift(order);
      if (state.orders.length > 500) state.orders = state.orders.slice(0, 500);
      return state;
    });

    return json(res, 200, {
      ok: true,
      orderId: order.id,
      coins: newBalance,
      message:
        order.productType === 'vehicle'
          ? 'Aankoop geplaatst — voertuig komt automatisch in je garage zodra je online bent (max. enkele minuten).'
          : 'Aankoop geplaatst — wordt door de server verwerkt.',
    });
  } catch (err) {
    console.error('store-purchase:', err);
    return json(res, 400, { error: err.message || 'Aankoop mislukt' });
  }
};
