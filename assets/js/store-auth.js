/** Zelfde sessie-patroon als staff-portaal (urpStaff* → urpStore*) */

function isStoreLoggedIn() {
  return !!sessionStorage.getItem('urpStoreUser') && !!sessionStorage.getItem('urpStoreAccessToken');
}

function storeAccessToken() {
  return sessionStorage.getItem('urpStoreAccessToken') || '';
}

function isStoreAdmin() {
  return sessionStorage.getItem('urpStoreBeheer') === 'true';
}

function isStoreFivemLinked() {
  return sessionStorage.getItem('urpStoreFivemLinked') === 'true';
}

function storeUserName() {
  return sessionStorage.getItem('urpStoreUser') || 'Speler';
}

function storeDiscordId() {
  return sessionStorage.getItem('urpStoreDiscordId') || '';
}

function setStoreSession(data) {
  sessionStorage.setItem('urpStoreUser', data.username || 'Speler');
  sessionStorage.setItem('urpStoreAccessToken', data.accessToken || '');
  sessionStorage.setItem('urpStoreBeheer', data.isAdmin ? 'true' : 'false');
  sessionStorage.setItem('urpStoreFivemLinked', data.linked ? 'true' : 'false');
  if (data.discordId) sessionStorage.setItem('urpStoreDiscordId', data.discordId);
  else sessionStorage.removeItem('urpStoreDiscordId');
  if (data.avatarUrl) sessionStorage.setItem('urpStoreAvatarUrl', data.avatarUrl);
  else sessionStorage.removeItem('urpStoreAvatarUrl');
  if (data.discordUsername) sessionStorage.setItem('urpStoreDiscordTag', data.discordUsername);
  else sessionStorage.removeItem('urpStoreDiscordTag');
  if (data.coins != null) sessionStorage.setItem('urpStoreCoins', String(data.coins));
}

function clearStoreSession() {
  [
    'urpStoreUser',
    'urpStoreAccessToken',
    'urpStoreBeheer',
    'urpStoreFivemLinked',
    'urpStoreDiscordId',
    'urpStoreAvatarUrl',
    'urpStoreDiscordTag',
    'urpStoreCoins',
    'urpStoreRedirect',
  ].forEach((k) => sessionStorage.removeItem(k));
}

function canUseCoins() {
  return isStoreLoggedIn() && isStoreFivemLinked();
}

async function storeApi(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const token = storeAccessToken();
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

async function discordStoreAuthWithCode(code) {
  const res = await fetch(window.STORE_CONFIG.apiBase + '/api/store-auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: code, redirectUri: discordRedirectUri() }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Discord inloggen mislukt');
  setStoreSession(data);
  return data;
}

async function handleStoreOAuthCallback() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  if (!code) return null;
  const data = await discordStoreAuthWithCode(code);
  window.history.replaceState({}, '', window.location.pathname);
  return data;
}

function storeLogout() {
  clearStoreSession();
  window.location.replace('/');
}
