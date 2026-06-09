/** Admin paneel — aparte sessie (wachtwoord), los van store Discord login */

function isAdminLoggedIn() {
  return !!sessionStorage.getItem('urpAdminToken');
}

function adminAccessToken() {
  return sessionStorage.getItem('urpAdminToken') || '';
}

function adminUserName() {
  return sessionStorage.getItem('urpAdminUser') || 'Beheerder';
}

function setAdminSession(data) {
  if (data.accessToken) sessionStorage.setItem('urpAdminToken', data.accessToken);
  if (data.username) sessionStorage.setItem('urpAdminUser', data.username);
  if (data.avatarUrl) sessionStorage.setItem('urpAdminAvatarUrl', data.avatarUrl);
  else sessionStorage.removeItem('urpAdminAvatarUrl');
  if (data.loginMethod) sessionStorage.setItem('urpAdminLoginMethod', data.loginMethod);
}

function clearAdminSession() {
  sessionStorage.removeItem('urpAdminToken');
  sessionStorage.removeItem('urpAdminUser');
  sessionStorage.removeItem('urpAdminAvatarUrl');
  sessionStorage.removeItem('urpAdminLoginMethod');
}

function adminRedirectUri() {
  return window.location.origin + '/admin.html';
}

function openAdminDiscordLogin() {
  if (!window.STORE_CONFIG || !window.STORE_CONFIG.discordClientId) {
    alert('Store config laadt niet — ververs de pagina (js/store-config.js).');
    return;
  }

  if (typeof window.getStoreDiscordAuthUrl === 'function') {
    window.location.href = window.getStoreDiscordAuthUrl(adminRedirectUri());
    return;
  }

  const params = new URLSearchParams({
    client_id: window.STORE_CONFIG.discordClientId,
    redirect_uri: adminRedirectUri(),
    response_type: 'code',
    scope: 'identify guilds guilds.members.read',
  });
  window.location.href = 'https://discord.com/api/oauth2/authorize?' + params.toString();
}

function bindAdminDiscordButton() {
  var btn = document.getElementById('btnDiscordLogin');
  if (!btn || btn.dataset.bound === '1') return;
  btn.dataset.bound = '1';
  btn.type = 'button';
  btn.addEventListener('click', function (e) {
    e.preventDefault();
    openAdminDiscordLogin();
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bindAdminDiscordButton);
} else {
  bindAdminDiscordButton();
}

async function adminDiscordLoginWithCode(code) {
  const data = await adminApiRequest('/api/store-admin-auth', {
    method: 'POST',
    body: {
      action: 'discord-login',
      code: code,
      redirectUri: adminRedirectUri(),
    },
  });
  setAdminSession(data);
  return data;
}

async function adminApiRequest(path, options) {
  options = options || {};
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const token = adminAccessToken();
  if (token) headers.Authorization = 'Bearer ' + token;

  const res = await fetch(window.STORE_CONFIG.apiBase + path, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json().catch(function () {
    return {};
  });
  if (!res.ok) {
    const err = new Error(data.error || res.statusText);
    err.details = data;
    throw err;
  }
  return data;
}

async function adminLogin(username, password) {
  const data = await adminApiRequest('/api/store-admin-auth', {
    method: 'POST',
    body: { action: 'login', username: username, password: password },
  });
  setAdminSession(data);
  return data;
}

async function verifyAdminSession() {
  if (!isAdminLoggedIn()) return false;
  try {
    await adminApiRequest('/api/store-admin-auth', {
      method: 'POST',
      body: { action: 'me' },
    });
    return true;
  } catch (e) {
    clearAdminSession();
    return false;
  }
}

function adminLogout() {
  const token = adminAccessToken();
  if (token) {
    fetch(window.STORE_CONFIG.apiBase + '/api/store-admin-auth', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'logout' }),
    }).catch(function () {});
  }
  clearAdminSession();
  window.location.replace('/admin.html');
}

function openAdminShellUi() {
  var gate = document.getElementById('adminGate');
  var app = document.getElementById('adminApp');
  var hint = document.getElementById('adminGateHint');
  var session = document.getElementById('adminSession');
  var logout = document.getElementById('btnLogout');
  var nameEl = document.getElementById('adminUserName');
  var avatar = document.getElementById('adminAvatar');

  if (hint) {
    hint.classList.add('hidden');
    hint.textContent = '';
  }
  if (gate) gate.classList.add('hidden');
  if (app) app.classList.remove('hidden');
  if (session) session.classList.remove('hidden');
  if (logout) logout.classList.remove('hidden');
  if (nameEl) nameEl.textContent = adminUserName();

  var avatarUrl = sessionStorage.getItem('urpAdminAvatarUrl');
  if (avatar) {
    if (avatarUrl) {
      avatar.src = avatarUrl;
      avatar.style.display = 'block';
    } else {
      avatar.style.display = 'none';
    }
  }
}

function setAdminGateHint(text) {
  var hint = document.getElementById('adminGateHint');
  if (!hint) return;
  if (!text) {
    hint.classList.add('hidden');
    hint.textContent = '';
    return;
  }
  hint.classList.remove('hidden');
  hint.textContent = text;
}

function cleanAdminOAuthUrl() {
  var url = new URL(window.location.href);
  url.searchParams.delete('code');
  url.searchParams.delete('state');
  var next = url.pathname + (url.search || '') + (url.hash || '');
  window.history.replaceState({}, '', next || '/admin.html');
}

async function handleAdminDiscordOAuthReturn() {
  var params = new URLSearchParams(window.location.search);
  var code = params.get('code');
  if (!code) return false;

  window.__urpAdminOAuthBusy = true;
  setAdminGateHint('Discord login verwerken…');
  cleanAdminOAuthUrl();

  try {
    await adminDiscordLoginWithCode(code);
    openAdminShellUi();
    window.__urpAdminNeedsBootstrap = true;
    document.dispatchEvent(new CustomEvent('urp-admin-logged-in', { detail: { method: 'discord' } }));
    return true;
  } catch (err) {
    var hint = err.message || 'Discord login mislukt';
    if (err.details && err.details.discordId) {
      hint += ' — rol Store Beheer op Discord nodig.';
    }
    setAdminGateHint(hint);
    document.dispatchEvent(new CustomEvent('urp-admin-login-failed', { detail: { error: hint } }));
    return false;
  } finally {
    window.__urpAdminOAuthBusy = false;
  }
}

(async function bootstrapAdminOAuth() {
  if (!window.location.pathname.includes('admin')) return;
  await handleAdminDiscordOAuthReturn();
})();
