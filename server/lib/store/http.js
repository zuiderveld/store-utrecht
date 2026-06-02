function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Bridge-Key');
}

function json(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function bridgeKey(req) {
  const raw = req.headers['x-bridge-key'] || req.query?.key || '';
  return String(raw).trim();
}

function checkBridgeKey(req) {
  const expected = String(process.env.STORE_BRIDGE_API_KEY || process.env.GRP_BRIDGE_API_KEY || '').trim();
  if (!expected) return false;
  return bridgeKey(req) === expected;
}

module.exports = { cors, json, readBody, checkBridgeKey };
