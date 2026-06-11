const { get, put, head, list } = require('@vercel/blob');

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

function blobAccessModes() {
  const preferred = blobAccess();
  const other = preferred === 'private' ? 'public' : 'private';
  return preferred === other ? [preferred] : [preferred, other];
}

function parseBlobJson(text, path) {
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new Error('Ongeldige JSON in blob ' + path + ': ' + (err.message || 'parse error'));
  }
}

async function fetchBlobUrl(url, token) {
  if (!url) return null;
  const attempts = [
    { headers: { Authorization: 'Bearer ' + token } },
    { headers: {} },
  ];
  for (const opts of attempts) {
    try {
      const res = await fetch(url, { cache: 'no-store', ...opts });
      if (res.ok) {
        const text = await res.text();
        return text || null;
      }
    } catch {
      /* volgende poging */
    }
  }
  return null;
}

async function readBlobTextAt(path) {
  const token = blobToken();
  if (!token) return { ok: false, reason: 'no-token' };

  const attempts = [];

  for (const access of blobAccessModes()) {
    try {
      const result = await get(path, {
        access,
        token,
        useCache: false,
      });
      if (result?.stream) {
        const text = await streamToText(result.stream);
        if (text) {
          return { ok: true, text, accessUsed: access, method: 'get' };
        }
        attempts.push({ method: 'get', access, error: 'empty stream' });
      } else {
        attempts.push({ method: 'get', access, error: 'not found' });
      }
    } catch (err) {
      attempts.push({ method: 'get', access, error: err.message || String(err) });
    }
  }

  try {
    const meta = await head(path, { token });
    const urls = [meta?.downloadUrl, meta?.url].filter(Boolean);
    for (const url of urls) {
      const text = await fetchBlobUrl(url, token);
      if (text) {
        return { ok: true, text, accessUsed: 'head-url', method: 'head-fetch' };
      }
      attempts.push({ method: 'head-fetch', url: url.slice(0, 48) + '…', error: 'fetch failed' });
    }
  } catch (err) {
    attempts.push({ method: 'head', error: err.message || String(err) });
  }

  try {
    const { blobs } = await list({ prefix: path, token, limit: 5 });
    const match =
      blobs.find((b) => b.pathname === path) ||
      blobs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))[0];
    if (match?.url) {
      const text = await fetchBlobUrl(match.downloadUrl || match.url, token);
      if (text) {
        return { ok: true, text, accessUsed: 'list-url', method: 'list-fetch' };
      }
      attempts.push({ method: 'list-fetch', error: 'fetch failed' });
    }
  } catch (err) {
    attempts.push({ method: 'list', error: err.message || String(err) });
  }

  return { ok: false, reason: 'error', attempts };
}

async function readBlobAt(path) {
  const read = await readBlobTextAt(path);
  if (!read.ok) return read;
  try {
    return {
      ok: true,
      data: parseBlobJson(read.text, path),
      accessUsed: read.accessUsed,
      method: read.method,
    };
  } catch (err) {
    return { ok: false, reason: 'error', error: err, attempts: read.attempts || [] };
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

  for (const backupPath of [BLOB_BACKUP_PATH]) {
    const backup = await readBlobAt(backupPath);
    if (backup.ok && backup.data) {
      console.warn('[urp-store] Hoofd-blob onleesbaar — hersteld vanuit backup:', backupPath);
      const state = normalizeState(backup.data);
      try {
        await writeBlob(state);
      } catch (err) {
        console.warn('[urp-store] Auto-repair write mislukt:', err.message);
      }
      return state;
    }
  }

  const exists = await blobFileExists(BLOB_PATH);

  if (exists) {
    const detail = read.attempts?.length
      ? ' Laatste pogingen: ' +
        read.attempts
          .slice(0, 4)
          .map((a) => (a.method || 'get') + (a.access ? '/' + a.access : '') + '=' + a.error)
          .join('; ')
      : read.error?.message
        ? ' (' + read.error.message + ')'
        : '';
    throw new Error(
      'Store database kon niet worden gelezen (Blob bestaat wel).' +
        detail +
        ' — controleer BLOB_READ_WRITE_TOKEN (store-project, niet staff) en probeer BLOB_ACCESS=public of private. Sla niets op tot /api/health?blob=1 readable:true toont.'
    );
  }

  if (read.reason === 'error') {
    throw new Error(
      'Store database kon niet worden gelezen. Controleer BLOB_READ_WRITE_TOKEN en BLOB_ACCESS (private of public).'
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
  const read = exists ? await readBlob() : null;
  const readable = Boolean(read?.ok);
  return {
    tokenConfigured,
    blobAccess: blobAccess(),
    blobAccessTried: blobAccessModes(),
    path: BLOB_PATH,
    exists,
    readable,
    readMethod: read?.method || null,
    readAccess: read?.accessUsed || null,
    attempts: read?.ok ? undefined : read?.attempts || [],
    parseError: read?.error?.message || null,
    hint: readable
      ? null
      : exists
        ? 'Blob staat waarschijnlijk op andere access (public/private). Zet BLOB_ACCESS=public in Vercel, redeploy, test opnieuw. Token moet uit het store-Vercel-project komen (Storage → Blob).'
        : tokenConfigured
          ? 'Geen store/state.json gevonden — eerste save maakt deze aan.'
          : 'Zet BLOB_READ_WRITE_TOKEN in Vercel (store-project → Storage → Blob).',
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
