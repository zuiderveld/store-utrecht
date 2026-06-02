const { cors, json, readBody, checkBridgeKey } = require('../store/http');
const { saveState, getState } = require('../store/blob-store');
const { findUserByLicense, findUserInState, purchaseOne, purchaseCart, mergeOrderMeta, normalizeProductIds } = require('../store/purchase-core');
const { processPendingDiscordRoleOrders, purchaseMessageForOrder, isDiscordRoleOrder } = require('../store/discord-role-fulfill');
const { getMaintenanceState, assertStoreOpen } = require('./store-maintenance');

async function runDiscordRoleFulfillment(state) {
  await processPendingDiscordRoleOrders(state);
  return state;
}

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
    const body = req.method === 'POST' ? await readBody(req) : {};
    const action = req.query?.action || body.action;

    if (action === 'health' || (!action && req.method === 'GET')) {
      const state = await getState();
      const pending = state.orders.filter((o) => o.status === 'pending').length;
      return json(res, 200, { ok: true, pending, ts: Date.now() });
    }

    if (action === 'catalog' && req.method === 'GET') {
      const maint = await getMaintenanceState();
      if (maint.global) {
        return json(res, 503, {
          maintenance: true,
          error: maint.message || 'De URP Store is momenteel in onderhoud. Probeer het later opnieuw.',
        });
      }
      const state = await getState();
      const categories = [...state.categories].sort((a, b) => (a.sort || 0) - (b.sort || 0));
      const products = state.products.filter((p) => p.active !== false).map(mapProduct);
      return json(res, 200, { categories, products });
    }

    if (action === 'profile' && req.method === 'POST') {
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
        const user =
          (entry.userId && state.users[entry.userId]) ||
          state.users[entry.discordId] ||
          Object.values(state.users).find(
            (u) => u.discordId === entry.discordId || u.userId === entry.userId
          );
        if (!user) throw new Error('Gebruiker niet gevonden');

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
      await assertStoreOpen();
      const license = body.license;
      const productId = body.productId;
      if (!license || !productId) return json(res, 400, { error: 'license en productId verplicht' });

      let order = null;
      let coins = 0;

      await saveState(async (state) => {
        const user = findUserByLicense(state, license);
        if (!user) throw new Error('Account niet gekoppeld — log in op de website en gebruik /koppelstore');
        const result = purchaseOne(state, user, productId);
        order = result.order;
        coins = result.coins;
        await runDiscordRoleFulfillment(state);
        return state;
      });

      return json(res, 200, {
        ok: true,
        orderId: order.id,
        coins,
        message: purchaseMessageForOrder(order),
      });
    }

    if (action === 'purchase-cart' && req.method === 'POST') {
      await assertStoreOpen();
      const license = body.license;
      const productIds = normalizeProductIds(body.productIds);
      if (!license || !productIds.length) {
        return json(res, 400, { error: 'license en productIds verplicht' });
      }

      let orders = [];
      let coins = 0;
      let total = 0;

      await saveState(async (state) => {
        const user = findUserByLicense(state, license);
        if (!user) throw new Error('Account niet gekoppeld — log in op de website en gebruik /koppelstore');
        const result = purchaseCart(state, user, productIds);
        orders = result.orders;
        coins = result.coins;
        total = result.total;
        await runDiscordRoleFulfillment(state);
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
      const state = await saveState(async (s) => {
        await processPendingDiscordRoleOrders(s);
        return s;
      });

      const pending = state.orders
        .filter((o) => o.status === 'pending' && !isDiscordRoleOrder(o))
        .slice(0, 25)
        .map((o) => ({
          id: o.id,
          license: o.license,
          identifiers: o.identifiers,
          productId: o.productId,
          productType: o.productType,
          productName: o.productName,
          meta: mergeOrderMeta(state, o),
          createdAt: o.createdAt,
        }));
      return json(res, 200, { orders: pending });
    }

    if (action === 'complete' && req.method === 'POST') {
      const orderId = body.orderId;
      const status = body.status === 'failed' ? 'failed' : 'done';
      if (!orderId) return json(res, 400, { error: 'orderId verplicht' });

      await saveState((state) => {
        const order = state.orders.find((o) => o.id === orderId);
        if (!order) throw new Error('Order niet gevonden');
        order.status = status;
        order.completedAt = Date.now();
        order.note = body.note || '';

        if (status === 'failed') {
          const user =
            findUserByLicense(state, order.license) ||
            (order.discordId && state.users[order.discordId]) ||
            Object.values(state.users || {}).find((u) => u.license === order.license);
          if (user) {
            user.coins = (Number(user.coins) || 0) + (Number(order.price) || 0);
            user.updatedAt = Date.now();
            order.refunded = true;
          }
        }

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
