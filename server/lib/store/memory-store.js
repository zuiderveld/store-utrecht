const { emptyState, normalizeState } = require('./store-schema');

let cache = null;

async function getState() {
  if (!cache) {
    cache = emptyState();
    console.warn('[urp-store] Geheugen-database — data verdwijnt bij herstart (STORE_STORAGE=memory)');
  }
  return normalizeState(cache);
}

async function saveState(mutator) {
  const state = await getState();
  const next = normalizeState((await mutator(state)) || state);
  cache = next;
  return next;
}

async function getMemoryDiagnostics() {
  return {
    mode: 'memory',
    readable: Boolean(cache),
    hint: 'Alleen voor testen — coins/orders gaan verloren bij redeploy of herstart.',
  };
}

module.exports = { getState, saveState, getMemoryDiagnostics };
