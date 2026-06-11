const { cors, json } = require('../store/http');
const { getBlobDiagnostics } = require('../store/blob-store');

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const body = {
    ok: true,
    service: 'utrecht-roleplay',
    store: true,
    ts: new Date().toISOString(),
  };

  if (req.query?.blob === '1' || req.query?.verbose === '1') {
    try {
      body.blob = await getBlobDiagnostics();
    } catch (err) {
      body.blob = { error: err.message || 'blob check mislukt' };
    }
  }

  return json(res, 200, body);
};
