/**
 * Lokale store API met JSON-bestand (STORE_STORAGE=file).
 * Gebruik: node scripts/local-api.js
 */
process.env.STORE_STORAGE = process.env.STORE_STORAGE || 'file';

const http = require('http');
const { URL } = require('url');
const handler = require('../api/router');

const PORT = Number(process.env.PORT || 3000);

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost:' + PORT);
    const routeMatch = url.pathname.match(/^\/api\/([^/?]+)/);
    req.query = Object.fromEntries(url.searchParams);
    if (routeMatch) {
      req.query.route = routeMatch[1];
    }
    req.url = url.pathname + url.search;

    await handler(req, res);
  } catch (err) {
    console.error('local-api:', err);
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message || 'Server error' }));
    }
  }
});

server.listen(PORT, () => {
  console.log('[urp-store] Lokaal: http://localhost:' + PORT);
  console.log('[urp-store] Opslag: STORE_STORAGE=' + (process.env.STORE_STORAGE || 'file'));
  console.log('[urp-store] Data: data/store-state.json');
});
