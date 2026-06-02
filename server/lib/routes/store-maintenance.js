const fs = require('fs');
const path = require('path');
const { cors, json } = require('../store/http');
const { readBody } = require('../store/http');
const { requireAdmin } = require('../store/session');

const DEFAULT_STATE = {
  global: false,
  message: 'De URP Store is momenteel in onderhoud. Probeer het later opnieuw.',
  updatedAt: null,
};

const BLOB_PATHNAME = 'urp-store-maintenance-state.json';

function readDefaultFile() {
  try {
    const filePath = path.join(process.cwd(), 'data', 'maintenance.json');
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return { ...DEFAULT_STATE };
  }
}

async function loadFromBlob() {
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
  if (!blobToken) return null;
  try {
    const { head } = require('@vercel/blob');
    const meta = await head(BLOB_PATHNAME, { token: blobToken });
    if (meta?.url) {
      const res = await fetch(meta.url, { cache: 'no-store' });
      if (res.ok) return await res.json();
    }
  } catch {
    /* geen blob */
  }
  return null;
}

async function saveToBlob(state) {
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
  if (!blobToken) {
    throw new Error('Vercel Blob vereist (BLOB_READ_WRITE_TOKEN) om onderhoud op te slaan.');
  }
  const { put } = require('@vercel/blob');
  await put(BLOB_PATHNAME, JSON.stringify(state), {
    access: 'public',
    token: blobToken,
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/json',
    cacheControlMaxAge: 60,
  });
}

async function getMaintenanceState() {
  if (process.env.MAINTENANCE_FORCE_OFF === 'true') {
    return { ...readDefaultFile(), global: false, _storage: 'force-off' };
  }
  const fromBlob = await loadFromBlob();
  if (fromBlob) return { ...fromBlob, _storage: 'blob' };
  const base = { ...readDefaultFile() };
  return {
    ...base,
    _storage: process.env.BLOB_READ_WRITE_TOKEN ? 'blob-empty' : 'default',
    _blobConfigured: !!process.env.BLOB_READ_WRITE_TOKEN,
  };
}

function normalizeState(input) {
  const base = readDefaultFile();
  return {
    global: !!input.global,
    message: (input.message || base.message || DEFAULT_STATE.message).trim(),
    updatedAt: new Date().toISOString(),
  };
}

async function assertStoreOpen() {
  const state = await getMaintenanceState();
  if (state.global) {
    throw new Error(state.message || DEFAULT_STATE.message);
  }
}

module.exports = async function handler(req, res) {
  cors(res);
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    const state = await getMaintenanceState();
    return json(res, 200, state);
  }

  if (req.method === 'POST') {
    try {
      await requireAdmin(req.headers.authorization);
      const body = await readBody(req);
      const state = normalizeState(body.maintenance || {});
      await saveToBlob(state);
      return json(res, 200, { ok: true, maintenance: { ...state, _storage: 'blob' } });
    } catch (err) {
      const code = /beheer|admin|token|log/i.test(err.message) ? 403 : 500;
      return json(res, code, { error: err.message || 'Opslaan mislukt' });
    }
  }

  return json(res, 405, { error: 'Alleen GET of POST' });
};

module.exports.getMaintenanceState = getMaintenanceState;
module.exports.assertStoreOpen = assertStoreOpen;
