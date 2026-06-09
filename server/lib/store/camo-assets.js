const { get, put, del } = require('@vercel/blob');
const { blobAccess } = require('./blob-store');

const WEAPON_PREFIX = 'store/camo/weapons/';
const CAMO_PREFIX = 'store/camo/camos/';

function normalizeWeaponId(raw) {
  const id = String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/\.PNG$/i, '')
    .replace(/[^A-Z0-9_]/g, '');
  if (!id.startsWith('WEAPON_')) throw new Error('Ongeldige wapen-ID (verwacht WEAPON_...)');
  return id;
}

function normalizeCamoId(raw) {
  const id = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/\.PNG$/i, '')
    .replace(/[^a-z0-9_]/g, '');
  if (!id) throw new Error('Ongeldige camo-ID');
  return id;
}

function weaponBlobPath(weaponId) {
  return WEAPON_PREFIX + weaponId + '.png';
}

function camoBlobPath(camoId) {
  return CAMO_PREFIX + camoId + '.png';
}

function ensureCamoAssets(state) {
  if (!state.camoAssets || typeof state.camoAssets !== 'object') {
    state.camoAssets = { weapons: {}, camos: {} };
  }
  if (!state.camoAssets.weapons) state.camoAssets.weapons = {};
  if (!state.camoAssets.camos) state.camoAssets.camos = {};
  return state.camoAssets;
}

async function streamToBuffer(stream) {
  if (!stream) return Buffer.alloc(0);
  const chunks = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

async function putImageBlob(path, buffer, contentType) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return { path: null, inline: buffer.toString('base64') };
  }
  await put(path, buffer, {
    access: blobAccess(),
    contentType: contentType || 'image/png',
    addRandomSuffix: false,
    allowOverwrite: true,
  });
  return { path, inline: null };
}

async function readAssetEntry(entry) {
  if (!entry) return null;
  if (entry.inline) {
    return Buffer.from(entry.inline, 'base64');
  }
  if (!entry.path || !process.env.BLOB_READ_WRITE_TOKEN) return null;
  try {
    const result = await get(entry.path, {
      access: blobAccess(),
      useCache: false,
    });
    if (!result?.stream) return null;
    return streamToBuffer(result.stream);
  } catch {
    return null;
  }
}

async function uploadWeaponImage(state, weaponRaw, buffer) {
  if (!Buffer.isBuffer(buffer) || !buffer.length) throw new Error('Leeg bestand');
  if (buffer.length > 3 * 1024 * 1024) throw new Error('Max 3 MB per PNG');

  const weaponId = normalizeWeaponId(weaponRaw);
  const assets = ensureCamoAssets(state);
  const stored = await putImageBlob(weaponBlobPath(weaponId), buffer, 'image/png');

  assets.weapons[weaponId] = {
    path: stored.path,
    inline: stored.inline || null,
    updatedAt: Date.now(),
    size: buffer.length,
  };

  return { weaponId, entry: assets.weapons[weaponId] };
}

async function uploadCamoImage(state, camoRaw, buffer) {
  if (!Buffer.isBuffer(buffer) || !buffer.length) throw new Error('Leeg bestand');
  if (buffer.length > 3 * 1024 * 1024) throw new Error('Max 3 MB per PNG');

  const camoId = normalizeCamoId(camoRaw);
  const assets = ensureCamoAssets(state);
  const stored = await putImageBlob(camoBlobPath(camoId), buffer, 'image/png');

  assets.camos[camoId] = {
    path: stored.path,
    inline: stored.inline || null,
    updatedAt: Date.now(),
    size: buffer.length,
  };

  return { camoId, entry: assets.camos[camoId] };
}

async function deleteWeaponImage(state, weaponRaw) {
  const weaponId = normalizeWeaponId(weaponRaw);
  const assets = ensureCamoAssets(state);
  const entry = assets.weapons[weaponId];
  if (!entry) return { weaponId, deleted: false };

  if (entry.path && process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      await del(entry.path, { token: process.env.BLOB_READ_WRITE_TOKEN });
    } catch {
      /* negeer */
    }
  }
  delete assets.weapons[weaponId];
  return { weaponId, deleted: true };
}

function publicCamoAssets(state) {
  const assets = ensureCamoAssets(state);
  const weapons = {};
  const camos = {};

  Object.entries(assets.weapons).forEach(([id, entry]) => {
    weapons[id] = { updatedAt: entry.updatedAt || null, size: entry.size || null };
  });
  Object.entries(assets.camos).forEach(([id, entry]) => {
    camos[id] = { updatedAt: entry.updatedAt || null, size: entry.size || null };
  });

  return { weapons, camos };
}

function hasWeaponAsset(state, weaponId) {
  const assets = state.camoAssets && state.camoAssets.weapons;
  return Boolean(assets && assets[String(weaponId).toUpperCase()]);
}

function hasCamoAsset(state, camoId) {
  const assets = state.camoAssets && state.camoAssets.camos;
  return Boolean(assets && assets[String(camoId).toLowerCase()]);
}

function weaponIdFromFilename(name) {
  const base = String(name || '').trim();
  const match = base.match(/^(WEAPON_[A-Z0-9_]+)\.png$/i);
  if (!match) return null;
  return normalizeWeaponId(match[1]);
}

module.exports = {
  normalizeWeaponId,
  normalizeCamoId,
  ensureCamoAssets,
  uploadWeaponImage,
  uploadCamoImage,
  deleteWeaponImage,
  readAssetEntry,
  publicCamoAssets,
  hasWeaponAsset,
  hasCamoAsset,
  weaponIdFromFilename,
};
