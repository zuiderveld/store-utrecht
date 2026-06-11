const { get, put, del, head } = require('@vercel/blob');
const { blobPutOptions, blobAuthStrategies, hasBlobCredentials } = require('./blob-store');

const WEAPON_PREFIX = 'store/camo/weapons/';
const CAMO_PREFIX = 'store/camo/camos/';
const PRODUCT_PREFIX = 'store/products/';

function detectContentType(buffer, fileName) {
  if (buffer[0] === 0x89 && buffer[1] === 0x50) return 'image/png';
  if (buffer[0] === 0xff && buffer[1] === 0xd8) return 'image/jpeg';
  if (buffer[0] === 0x47 && buffer[1] === 0x49) return 'image/gif';
  if (buffer.length > 12 && buffer.slice(0, 4).toString('ascii') === 'RIFF') return 'image/webp';
  const name = String(fileName || '').toLowerCase();
  if (/\.jpe?g$/.test(name)) return 'image/jpeg';
  if (/\.webp$/.test(name)) return 'image/webp';
  if (/\.gif$/.test(name)) return 'image/gif';
  return 'image/png';
}

function extensionForContentType(contentType) {
  if (contentType === 'image/jpeg') return 'jpg';
  if (contentType === 'image/webp') return 'webp';
  if (contentType === 'image/gif') return 'gif';
  return 'png';
}

function normalizeProductId(raw) {
  const id = String(raw || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '');
  if (!id) throw new Error('Ongeldig product-ID');
  return id;
}

function productBlobPath(productId, contentType) {
  return PRODUCT_PREFIX + normalizeProductId(productId) + '.' + extensionForContentType(contentType);
}

function productAssetApiPath(productId) {
  return '/api/store-asset?type=product&id=' + encodeURIComponent(normalizeProductId(productId));
}

function ensureProductImages(state) {
  if (!state.productImages || typeof state.productImages !== 'object') {
    state.productImages = {};
  }
  return state.productImages;
}

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
  if (!hasBlobCredentials()) {
    return { path: null, inline: buffer.toString('base64') };
  }
  await put(path, buffer, blobPutOptions({ contentType: contentType || 'image/png' }));
  return { path, inline: null };
}

async function readAssetEntry(entry) {
  if (!entry) return null;
  if (entry.inline) {
    return { buffer: Buffer.from(entry.inline, 'base64'), contentType: entry.contentType || 'image/png' };
  }
  if (!entry.path || !hasBlobCredentials()) return null;

  for (const strategy of blobAuthStrategies()) {
    try {
      const meta = await head(entry.path, strategy.options);
      if (meta?.url && strategy.options.token) {
        const res = await fetch(meta.url, {
          cache: 'no-store',
          headers: { Authorization: 'Bearer ' + strategy.options.token },
        });
        if (res.ok) {
          const buffer = Buffer.from(await res.arrayBuffer());
          return { buffer, contentType: entry.contentType || res.headers.get('content-type') || 'image/png' };
        }
      }
    } catch {
      /* fallback get */
    }

    for (const access of ['private', 'public']) {
      try {
        const result = await get(entry.path, {
          access,
          useCache: false,
          ...strategy.options,
        });
        if (!result?.stream) continue;
        const buffer = await streamToBuffer(result.stream);
        return { buffer, contentType: entry.contentType || result.contentType || 'image/png' };
      } catch {
        /* volgende */
      }
    }
  }

  return null;
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

async function uploadProductImage(state, productRaw, buffer, contentType, fileName) {
  if (!Buffer.isBuffer(buffer) || !buffer.length) throw new Error('Leeg bestand');
  if (buffer.length > 4 * 1024 * 1024) throw new Error('Max 4 MB per afbeelding');

  const productId = normalizeProductId(productRaw);
  const type = contentType || detectContentType(buffer, fileName);
  const images = ensureProductImages(state);
  const stored = await putImageBlob(productBlobPath(productId, type), buffer, type);

  images[productId] = {
    path: stored.path,
    inline: stored.inline || null,
    contentType: type,
    updatedAt: Date.now(),
    size: buffer.length,
  };

  return { productId, entry: images[productId], url: productAssetApiPath(productId) };
}

async function deleteProductImage(state, productRaw) {
  const productId = normalizeProductId(productRaw);
  const images = ensureProductImages(state);
  const entry = images[productId];
  if (!entry) return { productId, deleted: false };

  if (entry.path && process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      await del(entry.path, { token: process.env.BLOB_READ_WRITE_TOKEN });
    } catch {
      /* negeer */
    }
  }
  delete images[productId];
  return { productId, deleted: true };
}

function hasProductAsset(state, productId) {
  const images = state.productImages;
  return Boolean(images && images[normalizeProductId(productId)]);
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
  normalizeProductId,
  ensureCamoAssets,
  ensureProductImages,
  uploadWeaponImage,
  uploadCamoImage,
  uploadProductImage,
  deleteWeaponImage,
  deleteProductImage,
  readAssetEntry,
  publicCamoAssets,
  hasWeaponAsset,
  hasCamoAsset,
  hasProductAsset,
  weaponIdFromFilename,
  productAssetApiPath,
  detectContentType,
};
