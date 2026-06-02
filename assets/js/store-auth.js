/** Store sessie — Discord of e-mail */

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

function isStoreDiscordLinked() {
  return sessionStorage.getItem('urpStoreDiscordLinked') === 'true';
}

function storeUserName() {
  return sessionStorage.getItem('urpStoreUser') || 'Speler';
}

function storeUserId() {
  return sessionStorage.getItem('urpStoreUserId') || '';
}

function storeLoginMethod() {
  return sessionStorage.getItem('urpStoreLoginMethod') || '';
}

function setStoreSession(data) {
  sessionStorage.setItem('urpStoreUser', data.username || 'Speler');
  sessionStorage.setItem('urpStoreAccessToken', data.accessToken || '');
  sessionStorage.setItem('urpStoreBeheer', data.isAdmin ? 'true' : 'false');
  sessionStorage.setItem('urpStoreFivemLinked', data.fivemLinked || data.linked ? 'true' : 'false');
  sessionStorage.setItem('urpStoreDiscordLinked', data.discordLinked ? 'true' : 'false');
  if (data.userId) sessionStorage.setItem('urpStoreUserId', data.userId);
  else if (data.discordId) sessionStorage.setItem('urpStoreUserId', data.discordId);
  if (data.discordId) sessionStorage.setItem('urpStoreDiscordId', data.discordId);
  else sessionStorage.removeItem('urpStoreDiscordId');
  if (data.avatarUrl) sessionStorage.setItem('urpStoreAvatarUrl', data.avatarUrl);
  else if (!data.discordLinked && data.loginMethod === 'email') sessionStorage.removeItem('urpStoreAvatarUrl');
  if (data.email) sessionStorage.setItem('urpStoreEmail', data.email);
  else sessionStorage.removeItem('urpStoreEmail');
  if (data.loginMethod) sessionStorage.setItem('urpStoreLoginMethod', data.loginMethod);
  if (data.coins != null) sessionStorage.setItem('urpStoreCoins', String(data.coins));
}

function clearStoreSession() {
  [
    'urpStoreUser',
    'urpStoreAccessToken',
    'urpStoreBeheer',
    'urpStoreFivemLinked',
    'urpStoreDiscordLinked',
    'urpStoreDiscordId',
    'urpStoreUserId',
    'urpStoreAvatarUrl',
    'urpStoreEmail',
    'urpStoreLoginMethod',
    'urpStoreDiscordTag',
    'urpStoreCoins',
    'urpStoreRedirect',
  ].forEach((k) => sessionStorage.removeItem(k));
}

function canUseCoins() {
  return isStoreLoggedIn() && isStoreDiscordLinked() && isStoreFivemLinked();
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

async function discordStoreAuthWithCode(code, linkUserId, redirectUri) {
  const res = await fetch(window.STORE_CONFIG.apiBase + '/api/store-auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code: code,
      redirectUri: redirectUri || discordRedirectUri(),
      linkUserId: linkUserId || undefined,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Discord inloggen mislukt');
  setStoreSession(data);
  return data;
}

async function emailStoreAuth(action, payload) {
  const data = await storeApi('/api/store-email-auth', {
    method: 'POST',
    body: { action, ...payload },
  });
  setStoreSession(data);
  return data;
}

async function handleStoreOAuthCallback() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  if (!code) return null;

  const state = params.get('state') || '';
  let linkUserId = null;
  if (state.startsWith('link:')) {
    linkUserId = state.slice(5);
  } else if (storeLoginMethod() === 'email' && storeUserId()) {
    linkUserId = storeUserId();
  }

  const redirectUri =
    state === 'admin' ? storeOAuthReturnUri() : discordRedirectUri();

  const data = await discordStoreAuthWithCode(code, linkUserId, redirectUri);

  if (state === 'admin') {
    window.history.replaceState({}, '', '/admin.html');
    if (!window.location.pathname.includes('admin')) {
      window.location.replace('/admin.html');
    }
    return data;
  }

  const clean = window.location.pathname.includes('admin') ? '/admin.html' : '/';
  window.history.replaceState({}, '', clean);
  return data;
}

function storeLogout() {
  const token = storeAccessToken();
  if (token.startsWith('urp_')) {
    fetch(window.STORE_CONFIG.apiBase + '/api/store-email-auth', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'logout' }),
    }).catch(function () {});
  }
  clearStoreSession();
  const dest = window.location.pathname.includes('admin') ? '/admin.html' : '/';
  window.location.replace(dest);
}

function openDiscordLogin(linkUserId) {
  window.location.href = getStoreDiscordAuthUrl(discordRedirectUri(), linkUserId || null);
}
