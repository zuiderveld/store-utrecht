const { get, put, head } = require('@vercel/blob');

const BLOB_PATH = 'store/state.json';

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

async function readBlob() {
  try {
    const result = await get(BLOB_PATH, {
      access: blobAccess(),
      useCache: false,
    });
    if (!result?.stream) return { ok: false, reason: 'empty' };
    const text = await streamToText(result.stream);
    if (!text) return { ok: false, reason: 'empty' };
    return { ok: true, data: JSON.parse(text) };
  } catch (err) {
    console.error('[urp-store] readBlob mislukt:', err.message);
    return { ok: false, reason: 'error', error: err };
  }
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
    await put('store/state-backup.json', JSON.stringify(state), {
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
  return next;
}

module.exports = { getState, saveState, DEFAULT_STATE, BLOB_PATH, blobAccess };
