const { cors, json } = require('../server/lib/store/http');

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  return json(res, 200, {
    ok: true,
    service: 'utrecht-roleplay',
    store: true,
    ts: new Date().toISOString(),
  });
};
