const BLOB_PATH = 'store/state.json';

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
  orders: [],
};

async function readBlob() {
  try {
    const { head } = require('@vercel/blob');
    const meta = await head(BLOB_PATH);
    if (!meta?.url) return null;
    const res = await fetch(meta.url);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function writeBlob(state) {
  const { put } = require('@vercel/blob');
  await put(BLOB_PATH, JSON.stringify(state), {
    access: 'public',
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
    orders: raw.orders || [],
  };
}

async function saveState(mutator) {
  const state = await getState();
  const next = mutator(state) || state;
  await writeBlob(next);
  return next;
}

module.exports = { getState, saveState, DEFAULT_STATE, BLOB_PATH };
