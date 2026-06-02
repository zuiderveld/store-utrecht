const crypto = require('crypto');
const { cors, json, readBody } = require('../store/http');
const { requireAdmin } = require('../store/session');
const { saveState, getState } = require('../store/blob-store');

function slugify(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'cat';
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
        users: Object.values(state.users).map((u) => ({
          discordId: u.discordId,
          username: u.globalName || u.username,
          coins: u.coins || 0,
          license: u.license,
          linked: Boolean(u.license),
        })),
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
          result.product = row;
          break;
        }
        case 'product-delete': {
          state.products = state.products.filter((p) => p.id !== body.id);
          break;
        }
        case 'coins-set': {
          const { discordId, coins } = body;
          if (!discordId) throw new Error('discordId verplicht');
          if (!state.users[discordId]) {
            state.users[discordId] = {
              discordId,
              username: 'Onbekend',
              coins: 0,
              license: null,
              identifiers: [],
            };
          }
          state.users[discordId].coins = Math.max(0, Number(coins) || 0);
          state.users[discordId].updatedAt = Date.now();
          result.user = state.users[discordId];
          break;
        }
        case 'coins-add': {
          const { discordId, amount } = body;
          if (!discordId) throw new Error('discordId verplicht');
          if (!state.users[discordId]) throw new Error('Gebruiker niet gevonden — eerst laten inloggen');
          const add = Number(amount) || 0;
          state.users[discordId].coins = (Number(state.users[discordId].coins) || 0) + add;
          state.users[discordId].updatedAt = Date.now();
          result.user = state.users[discordId];
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
