/**
 * Eén serverless function voor alle store API-routes (betrouwbare npm-bundling).
 */
require('@vercel/blob');

const routes = {
  health: require('../server/lib/routes/health'),
  'store-auth': require('../server/lib/routes/store-auth'),
  store: require('../server/lib/routes/store-catalog'),
  'store-link': require('../server/lib/routes/store-link'),
  'store-purchase': require('../server/lib/routes/store-purchase'),
  'store-admin': require('../server/lib/routes/store-admin'),
  'store-bridge': require('../server/lib/routes/store-bridge'),
};

module.exports = async function handler(req, res) {
  const route = req.query.route;
  if (!route || !routes[route]) {
    res.setHeader('Content-Type', 'application/json');
    return res.status(404).json({
      error: 'API route niet gevonden',
      route: route || null,
    });
  }
  return routes[route](req, res);
};
