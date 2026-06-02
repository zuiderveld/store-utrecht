const { get, put } = require('@vercel/blob');

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

async function readBlob() {
  try {
    const result = await get(BLOB_PATH, {
      access: blobAccess(),
      useCache: false,
    });
    if (!result?.stream) return null;
    const text = await streamToText(result.stream);
    if (!text) return null;
    return JSON.parse(text);
  } catch {
    return null;
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

async function getState() {
  const raw = await readBlob();
  if (!raw || typeof raw !== 'object') {
    await writeBlob(DEFAULT_STATE);
    return JSON.parse(JSON.stringify(DEFAULT_STATE));
  }
  return {
    ...DEFAULT_STATE,
    ...raw,
    categories: raw.categories || DEFAULT_STATE.categories,
    products: raw.products || DEFAULT_STATE.products,
    users: raw.users || {},
    sessions: raw.sessions || {},
    linkCodes: raw.linkCodes || {},
    authSessions: raw.authSessions || {},
    emailIndex: raw.emailIndex || {},
    orders: raw.orders || [],
  };
}

async function saveState(mutator) {
  const state = await getState();
  const next = (await mutator(state)) || state;
  await writeBlob(next);
  return next;
}

module.exports = { getState, saveState, DEFAULT_STATE, BLOB_PATH };
