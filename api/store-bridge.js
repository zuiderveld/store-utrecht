const { cors, json, readBody, checkBridgeKey } = require('../server/lib/store/http');
const { saveState, getState } = require('../server/lib/store/blob-store');

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!checkBridgeKey(req)) {
    return json(res, 401, { error: 'Ongeldige bridge API key' });
  }

  try {
    const action = req.query?.action || (await readBody(req)).action;

    if (action === 'health' || (!action && req.method === 'GET')) {
      const state = await getState();
      const pending = state.orders.filter((o) => o.status === 'pending').length;
      return json(res, 200, { ok: true, pending, ts: Date.now() });
    }

    if (action === 'link' && req.method === 'POST') {
      const body = await readBody(req);
      const code = String(body.code || '').toUpperCase().trim();
      const license = body.license;
      const identifiers = body.identifiers || [];

      if (!code || !license) {
        return json(res, 400, { error: 'code en license verplicht' });
      }

      let linked = false;
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
        linked = true;
        return state;
      });

      return json(res, 200, { ok: true, linked: true });
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

    return json(res, 400, { error: 'Onbekende bridge actie', actions: ['health', 'link', 'pending', 'complete'] });
  } catch (err) {
    console.error('store-bridge:', err);
    return json(res, 400, { error: err.message || 'Bridge fout' });
  }
};
