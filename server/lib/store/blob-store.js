const { get, put, head } = require('@vercel/blob');

const BLOB_PATH = 'store/state.json';
const BLOB_BACKUP_PATH = 'store/state-backup.json';
const BLOB_CATALOG_BACKUP_PATH = 'store/catalog-backup.json';

/** 'private' voor Vercel Blob private store (standaard). Zet 'public' alleen bij een public store. */
function blobAccess() {
  const mode = (process.env.BLOB_ACCESS || 'private').toLowerCase();
  return mode === 'public' ? 'public' : 'private';
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
  };
}

async function blobFileExists() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return false;
  try {
    await head(BLOB_PATH, { token: process.env.BLOB_READ_WRITE_TOKEN });
    return true;
  } catch {
    return false;
  }
}

async function readBlobAt(path) {
  try {
    const result = await get(path, {
      access: blobAccess(),
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
  await put(BLOB_PATH, JSON.stringify(state), {
    access: blobAccess(),
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/json',
  });
}

async function writeBackup(state) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return;
  try {
    await put(BLOB_BACKUP_PATH, JSON.stringify(state), {
      access: blobAccess(),
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: 'application/json',
      cacheControlMaxAge: 60,
    });
  } catch (err) {
    console.warn('[urp-store] backup mislukt:', err.message);
  }
}

async function writeCatalogBackup(state) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return null;
  const payload = {
    version: 1,
    savedAt: new Date().toISOString(),
    categories: Array.isArray(state.categories) ? state.categories : [],
    products: Array.isArray(state.products) ? state.products : [],
  };
  try {
    await put(BLOB_CATALOG_BACKUP_PATH, JSON.stringify(payload), {
      access: blobAccess(),
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: 'application/json',
      cacheControlMaxAge: 60,
    });
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

  const exists = await blobFileExists();

  if (exists) {
    throw new Error(
      'Store database kon niet worden gelezen (Blob bestaat wel). ' +
        'Controleer BLOB_READ_WRITE_TOKEN en BLOB_ACCESS=private — sla niets op tot dit werkt, anders risico op dataverlies.'
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

module.exports = {
  getState,
  saveState,
  loadCatalogBackup,
  writeCatalogBackup,
  DEFAULT_STATE,
  BLOB_PATH,
  BLOB_CATALOG_BACKUP_PATH,
  blobAccess,
};
