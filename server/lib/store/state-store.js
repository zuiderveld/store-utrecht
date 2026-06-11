const blobBackend = require('./blob-store');
const fileBackend = require('./file-store');
const memoryBackend = require('./memory-store');

function resolveStorageMode() {
  const explicit = (process.env.STORE_STORAGE || '').trim().toLowerCase();
  if (explicit === 'file' || explicit === 'json') return 'file';
  if (explicit === 'memory') return 'memory';
  if (explicit === 'blob') return 'blob';
  if ((process.env.STORE_DATA_PATH || '').trim()) return 'file';
  if (process.env.VERCEL) {
    return blobBackend.hasBlobCredentials() ? 'blob' : 'memory';
  }
  return 'file';
}

function backend() {
  const mode = resolveStorageMode();
  if (mode === 'file') return fileBackend;
  if (mode === 'memory') return memoryBackend;
  return blobBackend;
}

async function getState() {
  return backend().getState();
}

async function saveState(mutator) {
  return backend().saveState(mutator);
}

async function loadCatalogBackup() {
  const mode = resolveStorageMode();
  if (mode === 'blob' && blobBackend.loadCatalogBackup) {
    return blobBackend.loadCatalogBackup();
  }
  return null;
}

async function writeCatalogBackup(state) {
  const mode = resolveStorageMode();
  if (mode === 'blob' && blobBackend.writeCatalogBackup) {
    return blobBackend.writeCatalogBackup(state);
  }
  return null;
}

async function getStorageDiagnostics() {
  const mode = resolveStorageMode();
  const base = { storage: mode, storageMode: mode };

  if (mode === 'file') {
    return { ...base, ...(await fileBackend.getFileDiagnostics()) };
  }
  if (mode === 'memory') {
    return { ...base, ...(await memoryBackend.getMemoryDiagnostics()), readable: true };
  }

  const blob = await blobBackend.getBlobDiagnostics();
  return {
    ...base,
    ...blob,
    readable: blob.readable,
  };
}

/** @deprecated use getStorageDiagnostics */
async function getBlobDiagnostics() {
  return getStorageDiagnostics();
}

module.exports = {
  resolveStorageMode,
  getState,
  saveState,
  loadCatalogBackup,
  writeCatalogBackup,
  getStorageDiagnostics,
  getBlobDiagnostics,
  DEFAULT_STATE: require('./store-schema').DEFAULT_STATE,
};
