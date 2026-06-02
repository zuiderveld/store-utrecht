const crypto = require('crypto');
const { cors, json, readBody } = require('../store/http');
const { requireAdmin } = require('../store/session');
const { saveState, getState } = require('../store/blob-store');
const { findUser } = require('../store/auth-sessions');

function slugify(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'cat';
}

function resolveAdminUser(state, { userId, discordId }) {
  if (userId) {
    const u = findUser(state, userId);
    if (u) return u;
  }
  if (discordId) {
    const u = findUser(state, discordId) || state.users[discordId];
    if (u) return u;
  }
  return null;
}

function mapUserForAdmin(u) {
  const userId = u.userId || u.discordId || null;
  return {
    userId,
    discordId: u.discordId || null,
    email: u.email || null,
    username: u.globalName || u.displayName || u.username || 'Speler',
    coins: u.coins || 0,
    license: u.license || null,
    linked: Boolean(u.license),
    discordLinked: Boolean(u.discordId),
    updatedAt: u.updatedAt || u.createdAt || 0,
  };
}

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    await requireAdmin(req.headers.authorization);
    const body = req.method === 'GET' ? {} : await readBody(req);
    const action = body.action || req.query?.action;

    if (req.method === 'GET' && (!action || action === 'snapshot')) {
      const state = await getState();
      return json(res, 200, {
        categories: state.categories,
        products: state.products,
        users: Object.values(state.users)
          .map(mapUserForAdmin)
          .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)),
        orders: state.orders.slice(0, 50),
      });
    }

    if (req.method !== 'POST') return json(res, 405, { error: 'Gebruik GET snapshot of POST acties' });

    let result = { ok: true };

    await saveState((state) => {
      switch (action) {
        case 'category-save': {
          const { id, name, sort } = body;
          if (!name) throw new Error('Naam verplicht');
          const cid = id || 'cat_' + slugify(name);
          const idx = state.categories.findIndex((c) => c.id === cid);
          const row = { id: cid, name, slug: slugify(name), sort: Number(sort) || 0 };
          if (idx >= 0) state.categories[idx] = { ...state.categories[idx], ...row };
          else state.categories.push(row);
          result.category = row;
          break;
        }
        case 'category-delete': {
          const { id } = body;
          state.categories = state.categories.filter((c) => c.id !== id);
          break;
        }
        case 'product-save': {
          const { id, categoryId, name, description, price, originalPrice, type, active, image, meta } = body;
          if (!name || !categoryId) throw new Error('Naam en categorie verplicht');
          const pid = id || 'prod_' + crypto.randomBytes(6).toString('hex');
          const row = {
            id: pid,
            categoryId,
            name,
            description: description || '',
            price: Number(price) || 0,
            originalPrice: originalPrice ? Number(originalPrice) : null,
            type: type || 'item',
            active: active !== false,
            image: image || '',
            meta: meta || {},
          };
          const idx = state.products.findIndex((p) => p.id === pid);
          if (idx >= 0) state.products[idx] = { ...state.products[idx], ...row };
          else state.products.push(row);
          if (row.type === 'vehicle' && !row.meta?.model) {
            throw new Error('Voertuig vereist spawn model (meta.model, bijv. adder)');
          }
          if (row.type === 'item' && !row.meta?.item) {
            throw new Error('Item vereist ox item naam (meta.item, bijv. bread)');
          }
          result.product = row;
          break;
        }
        case 'product-delete': {
          state.products = state.products.filter((p) => p.id !== body.id);
          break;
        }
        case 'coins-set':
        case 'user-save': {
          const { userId, discordId, coins, username } = body;
          let user = resolveAdminUser(state, { userId, discordId });

          if (!user && discordId) {
            const key = String(discordId).trim();
            state.users[key] = {
              userId: key,
              discordId: key,
              username: username && String(username).trim() ? String(username).trim() : 'Speler',
              coins: 0,
              license: null,
              identifiers: [],
              createdAt: Date.now(),
            };
            user = state.users[key];
          }

          if (!user) throw new Error('Gebruiker niet gevonden — laat speler eerst inloggen op de store');

          if (coins != null && coins !== '') {
            user.coins = Math.max(0, Number(coins) || 0);
          }
          if (username && String(username).trim()) {
            user.displayName = String(username).trim();
            user.username = user.displayName;
          }
          user.updatedAt = Date.now();
          result.user = mapUserForAdmin(user);
          break;
        }
        case 'coins-add': {
          const { userId, discordId, amount } = body;
          const user = resolveAdminUser(state, { userId, discordId });
          if (!user) throw new Error('Gebruiker niet gevonden');
          const add = Number(amount) || 0;
          user.coins = (Number(user.coins) || 0) + add;
          user.updatedAt = Date.now();
          result.user = mapUserForAdmin(user);
          break;
        }
        case 'order-requeue': {
          const { id } = body;
          const order = state.orders.find((o) => o.id === id);
          if (!order) throw new Error('Order niet gevonden');
          if (order.status !== 'failed') throw new Error('Alleen mislukte orders opnieuw proberen');
          order.status = 'pending';
          order.note = 'requeued_by_admin';
          delete order.completedAt;
          result.order = order;
          break;
        }
        default:
          throw new Error('Onbekende actie: ' + action);
      }
      return state;
    });

    return json(res, 200, result);
  } catch (err) {
    console.error('store-admin:', err);
    const code = err.message?.includes('Niet ingelogd') || err.message?.includes('beheer') ? 403 : 400;
    return json(res, code, { error: err.message || 'Admin actie mislukt' });
  }
};
