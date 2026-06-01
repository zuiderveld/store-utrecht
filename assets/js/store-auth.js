const STORE_SESSION_KEY = 'urp_store_session';

function getStoreToken() {
  try {
    return sessionStorage.getItem(STORE_SESSION_KEY) || '';
  } catch {
    return '';
  }
}

function setStoreToken(token) {
  sessionStorage.setItem(STORE_SESSION_KEY, token);
}

function clearStoreToken() {
  sessionStorage.removeItem(STORE_SESSION_KEY);
}

async function storeApi(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const token = getStoreToken();
  if (token) headers.Authorization = 'Bearer ' + token;

  const res = await fetch(window.STORE_CONFIG.apiBase + path, {
    ...options,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

async function handleStoreOAuthCallback(redirectUri) {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  if (!code) return null;

  const data = await storeApi('/api/store-auth', {
    method: 'POST',
    body: { code, redirectUri },
  });
  setStoreToken(data.token);
  window.history.replaceState({}, '', window.location.pathname);
  return data.user;
}
