const { get, put, head } = require('@vercel/blob');

const BLOB_PATH = 'store/state.json';
const BLOB_BACKUP_PATH = 'store/state-backup.json';
const BLOB_CATALOG_BACKUP_PATH = 'store/catalog-backup.json';

/** 'private' voor Vercel Blob private store (standaard). Zet 'public' alleen bij een public store. */
function blobAccess() {
  const mode = (process.env.BLOB_ACCESS || 'private').toLowerCase();
  return mode === 'public' ? 'public' : 'private';
}

function blobToken() {
  return process.env.BLOB_READ_WRITE_TOKEN || '';
}

function blobPutOptions(extra = {}) {
  const token = blobToken();
  const opts = {
    access: blobAccess(),
    addRandomSuffix: false,
    allowOverwrite: true,
    ...extra,
  };
  if (token) opts.token = token;
  return opts;
}

const DEFAULT_STATE = {
  version: 1,
  categories: [
    { id: 'vehicles', name: 'Voertuigen', slug: 'vehicles', sort: 0 },
    { id: 'items', name: 'Items', slug: 'items', sort: 1 },
    { id: 'cosmetics', name: 'Cosmetics', slug: 'cosmetics', sort: 2 },
  ],
  products: [
    {
      id: 'demo-adder',
      categoryId: 'vehicles',
      name: 'Adder (demo)',
      description: 'Supercar — wordt in je garage gezet na aankoop.',
      price: 500,
      type: 'vehicle',
      active: true,
      image: '',
      meta: { model: 'adder', garage: 'pillboxgarage' },
    },
  ],
  users: {},
  sessions: {},
  linkCodes: {},
  authSessions: {},
  emailIndex: {},
  orders: [],
  camoAssets: { weapons: {}, camos: {} },
  productImages: {},
};

async function streamToText(stream) {
  if (!stream) return '';
  return new Response(stream).text();
}

function normalizeState(raw) {
  if (!raw || typeof raw !== 'object') {
    return JSON.parse(JSON.stringify(DEFAULT_STATE));
  }
  return {
    ...DEFAULT_STATE,
    ...raw,
    categories: Array.isArray(raw.categories) ? raw.categories : DEFAULT_STATE.categories,
    products: Array.isArray(raw.products) ? raw.products : DEFAULT_STATE.products,
    users: raw.users || {},
    sessions: raw.sessions || {},
    linkCodes: raw.linkCodes || {},
    authSessions: raw.authSessions || {},
    emailIndex: raw.emailIndex || {},
    orders: raw.orders || [],
    camoAssets:
      raw.camoAssets && typeof raw.camoAssets === 'object'
        ? {
            weapons: raw.camoAssets.weapons && typeof raw.camoAssets.weapons === 'object' ? raw.camoAssets.weapons : {},
            camos: raw.camoAssets.camos && typeof raw.camoAssets.camos === 'object' ? raw.camoAssets.camos : {},
          }
        : { weapons: {}, camos: {} },
    productImages:
      raw.productImages && typeof raw.productImages === 'object' ? raw.productImages : {},
    adminSessions: raw.adminSessions || {},
  };
}

async function blobFileExists(path) {
  const token = blobToken();
  if (!token) return false;
  try {
    await head(path, { token });
    return true;
  } catch {
    return false;
  }
}

async function readBlobAt(path) {
  const token = blobToken();
  if (!token) return { ok: false, reason: 'no-token' };

  try {
    const meta = await head(path, { token });
    if (meta?.url) {
      const res = await fetch(meta.url, { cache: 'no-store' });
      if (res.ok) {
        const text = await res.text();
        if (!text) return { ok: false, reason: 'empty' };
        return { ok: true, data: JSON.parse(text) };
      }
    }
  } catch (err) {
    console.warn('[urp-store] head+fetch mislukt (' + path + '):', err.message);
  }

  try {
    const result = await get(path, {
      access: blobAccess(),
      token,
      useCache: false,
    });
    if (!result?.stream) return { ok: false, reason: 'empty' };
    const text = await streamToText(result.stream);
    if (!text) return { ok: false, reason: 'empty' };
    return { ok: true, data: JSON.parse(text) };
  } catch (err) {
    console.error('[urp-store] readBlobAt mislukt (' + path + '):', err.message);
    return { ok: false, reason: 'error', error: err };
  }
}

async function readBlob() {
  return readBlobAt(BLOB_PATH);
}

async function writeBlob(state) {
  const token = blobToken();
  if (!token) throw new Error('BLOB_READ_WRITE_TOKEN ontbreekt — kan niet opslaan.');
  await put(BLOB_PATH, JSON.stringify(state), blobPutOptions({ contentType: 'application/json' }));
}

async function writeBackup(state) {
  const token = blobToken();
  if (!token) return;
  try {
    await put(
      BLOB_BACKUP_PATH,
      JSON.stringify(state),
      blobPutOptions({ contentType: 'application/json', cacheControlMaxAge: 60 })
    );
  } catch (err) {
    console.warn('[urp-store] backup mislukt:', err.message);
  }
}

async function writeCatalogBackup(state) {
  const token = blobToken();
  if (!token) return null;
  const payload = {
    version: 1,
    savedAt: new Date().toISOString(),
    categories: Array.isArray(state.categories) ? state.categories : [],
    products: Array.isArray(state.products) ? state.products : [],
  };
  try {
    await put(
      BLOB_CATALOG_BACKUP_PATH,
      JSON.stringify(payload),
      blobPutOptions({ contentType: 'application/json', cacheControlMaxAge: 60 })
    );
    return payload;
  } catch (err) {
    console.warn('[urp-store] catalog backup mislukt:', err.message);
    return null;
  }
}

async function loadCatalogBackup() {
  const read = await readBlobAt(BLOB_CATALOG_BACKUP_PATH);
  if (!read.ok || !read.data) return null;
  return read.data;
}

async function createInitialBlob() {
  const initial = JSON.parse(JSON.stringify(DEFAULT_STATE));
  await writeBlob(initial);
  console.log('[urp-store] Nieuwe store database aangemaakt in Blob');
  return initial;
}

async function getState() {
  const read = await readBlob();

  if (read.ok) {
    return normalizeState(read.data);
  }

  const exists = await blobFileExists(BLOB_PATH);

  if (exists) {
    throw new Error(
      'Store database kon niet worden gelezen (Blob bestaat wel). ' +
        'Controleer BLOB_READ_WRITE_TOKEN (zelfde store-project) en BLOB_ACCESS=private — sla niets op tot dit werkt, anders risico op dataverlies.'
    );
  }

  if (read.reason === 'error') {
    throw new Error(
      'Store database kon niet worden gelezen. Controleer BLOB_READ_WRITE_TOKEN en BLOB_ACCESS=private.'
    );
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.warn('[urp-store] Geen BLOB_READ_WRITE_TOKEN — alleen demo-data in geheugen');
    return JSON.parse(JSON.stringify(DEFAULT_STATE));
  }

  return createInitialBlob();
}

async function saveState(mutator) {
  const state = await getState();
  const next = (await mutator(state)) || state;
  await writeBlob(next);
  await writeBackup(next);
  await writeCatalogBackup(next);
  return next;
}

async function getBlobDiagnostics() {
  const tokenConfigured = Boolean(blobToken());
  const exists = tokenConfigured ? await blobFileExists(BLOB_PATH) : false;
  let readable = false;
  if (exists) {
    const read = await readBlob();
    readable = read.ok;
  }
  return {
    tokenConfigured,
    blobAccess: blobAccess(),
    path: BLOB_PATH,
    exists,
    readable,
  };
}

module.exports = {
  getState,
  saveState,
  loadCatalogBackup,
  writeCatalogBackup,
  getBlobDiagnostics,
  DEFAULT_STATE,
  BLOB_PATH,
  BLOB_CATALOG_BACKUP_PATH,
  blobAccess,
  blobToken,
  blobPutOptions,
  readBlobAt,
  blobFileExists,
};
