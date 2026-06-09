const { cors } = require('../store/http');
const { getState } = require('../store/blob-store');
const { hasWeaponAsset, hasCamoAsset, readAssetEntry, normalizeWeaponId, normalizeCamoId } = require('../store/camo-assets');

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') {
    res.status(405).setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'Alleen GET' }));
  }

  try {
    const type = String(req.query?.type || '').toLowerCase();
    const state = await getState();

    let entry = null;
    if (type === 'weapon') {
      const weaponId = normalizeWeaponId(req.query?.id || req.query?.weapon || '');
      if (!hasWeaponAsset(state, weaponId)) {
        res.status(404).setHeader('Content-Type', 'text/plain');
        return res.end('Wapen PNG niet gevonden — upload via admin → Camo PNG\'s');
      }
      entry = state.camoAssets.weapons[weaponId];
    } else if (type === 'camo') {
      const camoId = normalizeCamoId(req.query?.id || req.query?.camo || '');
      if (!hasCamoAsset(state, camoId)) {
        res.status(404).setHeader('Content-Type', 'text/plain');
        return res.end('Camo PNG niet gevonden');
      }
      entry = state.camoAssets.camos[camoId];
    } else {
      res.status(400).setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: 'type=weapon of type=camo verplicht' }));
    }

    const buffer = await readAssetEntry(entry);
    if (!buffer || !buffer.length) {
      res.status(404).setHeader('Content-Type', 'text/plain');
      return res.end('Afbeelding kon niet worden geladen');
    }

    res.status(200);
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
    res.end(buffer);
  } catch (err) {
    console.error('store-asset:', err);
    res.status(500).setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: err.message || 'Asset laden mislukt' }));
  }
};
