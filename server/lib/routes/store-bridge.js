const { cors, json, readBody, checkBridgeKey } = require('../store/http');
const { saveState, getState } = require('../store/blob-store');
const { findUserByLicense, purchaseOne, purchaseCart } = require('../store/purchase-core');

function mapProduct(p) {
  return {
    id: p.id,
    categoryId: p.categoryId,
    name: p.name,
    description: p.description || '',
    price: p.price,
    originalPrice: p.originalPrice || null,
    type: p.type || 'item',
    image: p.image || '',
    meta: p.meta || {},
  };
}

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!checkBridgeKey(req)) {
    return json(res, 401, { error: 'Ongeldige bridge API key' });
  }

  try {
    const action = req.query?.action || (req.method === 'POST' ? (await readBody(req)).action : null);

    if (action === 'health' || (!action && req.method === 'GET')) {
      const state = await getState();
      const pending = state.orders.filter((o) => o.status === 'pending').length;
      return json(res, 200, { ok: true, pending, ts: Date.now() });
    }

    if (action === 'catalog' && req.method === 'GET') {
      const state = await getState();
      const categories = [...state.categories].sort((a, b) => (a.sort || 0) - (b.sort || 0));
      const products = state.products.filter((p) => p.active !== false).map(mapProduct);
      return json(res, 200, { categories, products });
    }

    if (action === 'profile' && req.method === 'POST') {
      const body = await readBody(req);
      const license = body.license;
      if (!license) return json(res, 400, { error: 'license verplicht' });

      const state = await getState();
      const user = findUserByLicense(state, license);
      if (!user) {
        return json(res, 200, {
          linked: false,
          coins: 0,
          username: null,
          message: 'Account niet gekoppeld. Log in op store.utrechtroleplay.eu en gebruik /koppelstore CODE',
        });
      }

      return json(res, 200, {
        linked: Boolean(user.license),
        coins: user.coins || 0,
        username: user.globalName || user.username || 'Speler',
        discordId: user.discordId,
      });
    }

    if (action === 'link' && req.method === 'POST') {
      const body = await readBody(req);
      const code = String(body.code || '').toUpperCase().trim();
      const license = body.license;
      const identifiers = body.identifiers || [];

      if (!code || !license) {
        return json(res, 400, { error: 'code en license verplicht' });
      }

      await saveState((state) => {
        const entry = state.linkCodes[code];
        if (!entry || entry.expiresAt < Date.now()) {
          throw new Error('Koppelcode ongeldig of verlopen');
        }
        const user = state.users[entry.discordId];
        if (!user) throw new Error('Discord gebruiker niet gevonden');

        user.license = license;
        user.identifiers = identifiers;
        user.linkedAt = Date.now();
        user.updatedAt = Date.now();
        delete state.linkCodes[code];
        return state;
      });

      return json(res, 200, { ok: true, linked: true });
    }

    if (action === 'purchase' && req.method === 'POST') {
      const body = await readBody(req);
      const license = body.license;
      const productId = body.productId;
      if (!license || !productId) return json(res, 400, { error: 'license en productId verplicht' });

      let order = null;
      let coins = 0;

      await saveState((state) => {
        const user = findUserByLicense(state, license);
        if (!user) throw new Error('Account niet gekoppeld — log in op de website en gebruik /koppelstore');
        const result = purchaseOne(state, user, productId);
        order = result.order;
        coins = result.coins;
        return state;
      });

      return json(res, 200, {
        ok: true,
        orderId: order.id,
        coins,
        message:
          order.productType === 'vehicle'
            ? 'Voertuig komt binnen enkele seconden in je garage.'
            : 'Aankoop geplaatst.',
      });
    }

    if (action === 'purchase-cart' && req.method === 'POST') {
      const body = await readBody(req);
      const license = body.license;
      const productIds = body.productIds;
      if (!license || !productIds?.length) {
        return json(res, 400, { error: 'license en productIds verplicht' });
      }

      let orders = [];
      let coins = 0;
      let total = 0;

      await saveState((state) => {
        const user = findUserByLicense(state, license);
        if (!user) throw new Error('Account niet gekoppeld — log in op de website en gebruik /koppelstore');
        const result = purchaseCart(state, user, productIds);
        orders = result.orders;
        coins = result.coins;
        total = result.total;
        return state;
      });

      return json(res, 200, {
        ok: true,
        orderIds: orders.map((o) => o.id),
        coins,
        total,
        message: 'Aankoop gelukt — items worden verwerkt.',
      });
    }

    if (action === 'pending' && req.method === 'GET') {
      const state = await getState();
      const pending = state.orders
        .filter((o) => o.status === 'pending')
        .slice(0, 25)
        .map((o) => ({
          id: o.id,
          license: o.license,
          identifiers: o.identifiers,
          productType: o.productType,
          productName: o.productName,
          meta: o.meta,
          createdAt: o.createdAt,
        }));
      return json(res, 200, { orders: pending });
    }

    if (action === 'complete' && req.method === 'POST') {
      const body = await readBody(req);
      const orderId = body.orderId;
      const status = body.status === 'failed' ? 'failed' : 'done';
      if (!orderId) return json(res, 400, { error: 'orderId verplicht' });

      await saveState((state) => {
        const order = state.orders.find((o) => o.id === orderId);
        if (!order) throw new Error('Order niet gevonden');
        order.status = status;
        order.completedAt = Date.now();
        order.note = body.note || '';
        return state;
      });

      return json(res, 200, { ok: true });
    }

    return json(res, 400, {
      error: 'Onbekende bridge actie',
      actions: ['health', 'catalog', 'profile', 'link', 'purchase', 'purchase-cart', 'pending', 'complete'],
    });
  } catch (err) {
    console.error('store-bridge:', err);
    return json(res, 400, { error: err.message || 'Bridge fout' });
  }
};
