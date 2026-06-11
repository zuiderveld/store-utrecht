const fs = require('fs');
const path = require('path');
const { emptyState, normalizeState } = require('./store-schema');

function resolveStatePath() {
  const custom = (process.env.STORE_DATA_PATH || '').trim();
  if (custom) return path.resolve(custom);
  return path.join(process.cwd(), 'data', 'store-state.json');
}

function resolveBackupPath() {
  const base = resolveStatePath();
  return base.replace(/\.json$/i, '') + '.backup.json';
}

async function ensureDir(filePath) {
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
}

async function readJsonFile(filePath) {
  try {
    const text = await fs.promises.readFile(filePath, 'utf8');
    if (!text.trim()) return null;
    return JSON.parse(text);
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw new Error('JSON lezen mislukt (' + filePath + '): ' + err.message);
  }
}

async function writeJsonFileAtomic(filePath, data) {
  await ensureDir(filePath);
  const tmp = filePath + '.tmp';
  const payload = JSON.stringify(data);
  await fs.promises.writeFile(tmp, payload, 'utf8');
  await fs.promises.rename(tmp, filePath);
}

async function getState() {
  const filePath = resolveStatePath();
  let raw = await readJsonFile(filePath);
  if (!raw) {
    raw = await readJsonFile(resolveBackupPath());
    if (raw) {
      console.warn('[urp-store] Hoofdbestand mist — hersteld vanuit backup:', resolveBackupPath());
    }
  }
  if (!raw) {
    const initial = emptyState();
    await writeJsonFileAtomic(filePath, initial);
    await writeJsonFileAtomic(resolveBackupPath(), initial).catch(() => {});
    console.log('[urp-store] Nieuwe store database aangemaakt:', filePath);
    return initial;
  }
  return normalizeState(raw);
}

async function saveState(mutator) {
  const state = await getState();
  const next = (await mutator(state)) || state;
  const filePath = resolveStatePath();
  await writeJsonFileAtomic(filePath, next);
  await writeJsonFileAtomic(resolveBackupPath(), next).catch(() => {});
  return next;
}

async function getFileDiagnostics() {
  const filePath = resolveStatePath();
  let exists = false;
  let readable = false;
  let size = 0;
  try {
    const stat = await fs.promises.stat(filePath);
    exists = stat.isFile();
    size = stat.size;
    if (exists) {
      await readJsonFile(filePath);
      readable = true;
    }
  } catch {
    exists = false;
  }
  return {
    mode: 'file',
    path: filePath,
    exists,
    readable,
    sizeBytes: size,
    vercelWarning: Boolean(process.env.VERCEL)
      ? 'STORE_STORAGE=file op Vercel bewaart niets permanent — host de API op een VPS of wacht op Blob reset.'
      : null,
    hint: readable
      ? 'Database staat in een JSON-bestand op schijf.'
      : exists
        ? 'Bestand bestaat maar is geen geldige JSON.'
        : 'Eerste save maakt ' + filePath,
  };
}

module.exports = {
  getState,
  saveState,
  getFileDiagnostics,
  resolveStatePath,
};
