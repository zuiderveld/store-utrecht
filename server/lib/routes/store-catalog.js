const { cors, json } = require('../store/http');
const { getState } = require('../store/blob-store');
const { resolveDiscord } = require('../store/session');

function maskUsername(name) {
  if (!name || name === 'Onbekend') return 'Anoniem';
  const s = String(name);
  if (s.length <= 3) return s + '***';
  return s.slice(0, Math.min(4, s.length)) + '***';
}

function getMonthStart() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
}

function buildStats(state) {
  const monthStart = getMonthStart();
  const spending = {};

  (state.orders || []).forEach((order) => {
    if (!order.discordId || !order.createdAt) return;
    if (order.createdAt < monthStart) return;
    spending[order.discordId] = (spending[order.discordId] || 0) + (Number(order.price) || 0);
  });

  let topBuyer = null;
  let maxSpent = 0;
  Object.entries(spending).forEach(([discordId, totalSpent]) => {
    if (totalSpent > maxSpent) {
      maxSpent = totalSpent;
      const user = state.users[discordId];
      topBuyer = {
        username: maskUsername(user?.globalName || user?.username || 'Speler'),
        totalSpent,
      };
    }
  });

  const recentPurchases = (state.orders || [])
    .slice(0, 12)
    .map((order) => {
      const user = state.users[order.discordId];
      return {
        username: maskUsername(user?.globalName || user?.username || 'Speler'),
        productName: order.productName || 'Product',
        createdAt: order.createdAt,
      };
    });

  return { topBuyer, recentPurchases };
}

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const state = await getState();
    const categories = [...state.categories].sort((a, b) => (a.sort || 0) - (b.sort || 0));
    const products = state.products
      .filter((p) => p.active !== false)
      .map(({ id, categoryId, name, description, price, originalPrice, type, image, meta }) => ({
        id,
        categoryId,
        name,
        description,
        price,
        originalPrice: originalPrice || null,
        type,
        image: image || '',
        meta: meta || {},
      }));

    const { topBuyer, recentPurchases } = buildStats(state);

    let me = null;
    const ctx = await resolveDiscord(req.headers.authorization);
    if (ctx) {
      me = {
        discordId: ctx.user.discordId,
        username: ctx.user.globalName || ctx.user.username,
        coins: ctx.user.coins || 0,
        license: ctx.user.license || null,
        linked: Boolean(ctx.user.license),
        discordLoggedIn: true,
        fivemLinked: Boolean(ctx.user.license),
        isAdmin: Boolean(ctx.isAdmin),
      };
    }

    return json(res, 200, { categories, products, me, topBuyer, recentPurchases });
  } catch (err) {
    console.error('store:', err);
    return json(res, 500, { error: err.message || 'Store laden mislukt' });
  }
};
