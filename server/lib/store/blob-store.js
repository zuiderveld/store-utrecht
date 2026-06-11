const { get, put, head, list } = require('@vercel/blob');
const { emptyState, normalizeState, DEFAULT_STATE } = require('./store-schema');

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

function blobStoreIdEnv() {
  return (process.env.BLOB_STORE_ID || '').trim();
}

function parseStoreIdFromToken(token) {
  if (!token) return '';
  const parts = String(token).split('_');
  return parts[3] || '';
}

function isVercelRuntime() {
  return Boolean(process.env.VERCEL);
}

function hasOidcBlobAuth() {
  return isVercelRuntime() && Boolean(blobStoreIdEnv());
}

function hasBlobCredentials() {
  return Boolean(blobToken()) || hasOidcBlobAuth();
}

/** Auth-strategieën — OIDC eerst op Vercel (private store); token als fallback/lokaal. */
function blobAuthStrategies() {
  const strategies = [];
  const storeId = blobStoreIdEnv();
  const token = blobToken();

  if (hasOidcBlobAuth()) {
    strategies.push({ name: 'oidc', options: { storeId } });
  }

  if (token) {
    strategies.push({ name: 'token', options: { token } });
  }

  return strategies;
}

function blobPutOptions(extra = {}) {
  const strategy = blobAuthStrategies()[0];
  if (!strategy) {
    throw new Error('Geen blob credentials — koppel Blob aan Vercel project of zet BLOB_READ_WRITE_TOKEN.');
  }
  return {
    access: blobAccess(),
    addRandomSuffix: false,
    allowOverwrite: true,
    ...strategy.options,
    ...extra,
  };
}

async function streamToText(stream) {
  if (!stream) return '';
  return new Response(stream).text();
}

async function blobFileExists(path) {
  if (!hasBlobCredentials()) return false;
  for (const strategy of blobAuthStrategies()) {
    try {
      await head(path, strategy.options);
      return true;
    } catch {
      /* volgende strategie */
    }
  }
  return false;
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
  if (!hasBlobCredentials()) return { ok: false, reason: 'no-credentials' };

  const attempts = [];

  for (const strategy of blobAuthStrategies()) {
    for (const access of blobAccessModes()) {
      try {
        const result = await get(path, {
          access,
          useCache: false,
          ...strategy.options,
        });
        if (result?.stream) {
          const text = await streamToText(result.stream);
          if (text) {
            return {
              ok: true,
              text,
              accessUsed: access,
              authUsed: strategy.name,
              method: 'get',
            };
          }
          attempts.push({ method: 'get', auth: strategy.name, access, error: 'empty stream' });
        } else {
          attempts.push({ method: 'get', auth: strategy.name, access, error: 'not found' });
        }
      } catch (err) {
        attempts.push({
          method: 'get',
          auth: strategy.name,
          access,
          error: err.message || String(err),
        });
      }
    }

    try {
      const meta = await head(path, strategy.options);
      const urls = [meta?.downloadUrl, meta?.url].filter(Boolean);
      const bearer =
        strategy.name === 'token' && strategy.options.token ? strategy.options.token : blobToken();
      for (const url of urls) {
        const text = bearer ? await fetchBlobUrl(url, bearer) : null;
        if (text) {
          return {
            ok: true,
            text,
            accessUsed: 'head-url',
            authUsed: strategy.name,
            method: 'head-fetch',
          };
        }
        attempts.push({
          method: 'head-fetch',
          auth: strategy.name,
          url: url.slice(0, 48) + '…',
          error: 'fetch failed',
        });
      }
    } catch (err) {
      attempts.push({ method: 'head', auth: strategy.name, error: err.message || String(err) });
    }

    if (strategy.options.token) {
      try {
        const { blobs } = await list({ prefix: path, token: strategy.options.token, limit: 5 });
        const match =
          blobs.find((b) => b.pathname === path) ||
          blobs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))[0];
        if (match?.url) {
          const text = await fetchBlobUrl(match.downloadUrl || match.url, strategy.options.token);
          if (text) {
            return {
              ok: true,
              text,
              accessUsed: 'list-url',
              authUsed: strategy.name,
              method: 'list-fetch',
            };
          }
          attempts.push({ method: 'list-fetch', auth: strategy.name, error: 'fetch failed' });
        }
      } catch (err) {
        attempts.push({ method: 'list', auth: strategy.name, error: err.message || String(err) });
      }
    }
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
  if (!hasBlobCredentials()) {
    throw new Error(
      'Geen blob credentials — koppel Blob store aan dit Vercel-project (OIDC) of zet BLOB_READ_WRITE_TOKEN.'
    );
  }
  await put(BLOB_PATH, JSON.stringify(state), blobPutOptions({ contentType: 'application/json' }));
}

async function writeBackup(state) {
  if (!hasBlobCredentials()) return;
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
  if (!hasBlobCredentials()) return null;
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
  const initial = emptyState();
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
          .map((a) =>
            (a.method || 'get') +
            (a.auth ? '/' + a.auth : '') +
            (a.access ? '/' + a.access : '') +
            '=' +
            a.error
          )
          .join('; ')
      : read.error?.message
        ? ' (' + read.error.message + ')'
        : '';
    throw new Error(
      'Store database kon niet worden gelezen (Blob bestaat wel).' +
        detail +
        ' — op Vercel: koppel Blob store aan project (OIDC), verwijder oude handmatige BLOB_READ_WRITE_TOKEN, redeploy. Test /api/health?blob=1.'
    );
  }

  if (read.reason === 'error' || read.reason === 'no-credentials') {
    throw new Error(
      'Store database kon niet worden gelezen. Koppel Blob aan Vercel (OIDC + BLOB_STORE_ID) of zet BLOB_READ_WRITE_TOKEN.'
    );
  }

  if (!hasBlobCredentials()) {
    console.warn('[urp-store] Geen blob credentials — fallback via STORE_STORAGE=memory of file');
    return emptyState();
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
  const token = blobToken();
  const tokenStoreId = parseStoreIdFromToken(token);
  const envStoreId = blobStoreIdEnv();
  const storeIdMismatch = Boolean(tokenStoreId && envStoreId && tokenStoreId !== envStoreId);
  const credentials = hasBlobCredentials();
  const exists = credentials ? await blobFileExists(BLOB_PATH) : false;
  const read = exists ? await readBlob() : null;
  const readable = Boolean(read?.ok);

  let hint = null;
  if (readable) {
    hint = null;
  } else if (storeIdMismatch) {
    hint =
      'BLOB_READ_WRITE_TOKEN hoort bij andere store dan BLOB_STORE_ID. Verwijder de handmatige token in Vercel — laat OIDC van het gekoppelde project werken.';
  } else if (exists && read?.attempts?.some((a) => String(a.error).includes('403'))) {
    hint =
      '403 Forbidden: private blob op Vercel vereist OIDC. Storage → Blob → koppel store aan store-project → Upgrade to OIDC → verwijder handmatige BLOB_READ_WRITE_TOKEN → redeploy.';
  } else if (!credentials) {
    hint = 'Koppel Blob store aan het store-Vercel-project (Storage tab) — BLOB_STORE_ID wordt automatisch gezet.';
  } else if (!exists) {
    hint = 'Geen store/state.json — eerste succesvolle save maakt deze aan.';
  } else {
    hint = 'Lezen mislukt — controleer Blob-koppeling en redeploy.';
  }

  return {
    tokenConfigured: Boolean(token),
    oidcAvailable: hasOidcBlobAuth(),
    vercel: isVercelRuntime(),
    blobStoreId: envStoreId || null,
    tokenStoreId: tokenStoreId || null,
    storeIdMismatch,
    authStrategies: blobAuthStrategies().map((s) => s.name),
    blobAccess: blobAccess(),
    blobAccessTried: blobAccessModes(),
    path: BLOB_PATH,
    exists,
    readable,
    readMethod: read?.method || null,
    readAccess: read?.accessUsed || null,
    readAuth: read?.authUsed || null,
    attempts: read?.ok ? undefined : read?.attempts || [],
    parseError: read?.error?.message || null,
    hint,
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
  blobAuthStrategies,
  hasBlobCredentials,
  readBlobAt,
  blobFileExists,
};
