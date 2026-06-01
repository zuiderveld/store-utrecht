const { cors, json } = require('../store/http');
const { getState } = require('../store/blob-store');
const { resolveDiscord } = require('../store/session');

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const state = await getState();
    const categories = [...state.categories].sort((a, b) => (a.sort || 0) - (b.sort || 0));
    const products = state.products
      .filter((p) => p.active !== false)
      .map(({ id, categoryId, name, description, price, type, image, meta }) => ({
        id,
        categoryId,
        name,
        description,
        price,
        type,
        image: image || '',
        meta: meta || {},
      }));

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

    return json(res, 200, { categories, products, me });
  } catch (err) {
    console.error('store:', err);
    return json(res, 500, { error: err.message || 'Store laden mislukt' });
  }
};
