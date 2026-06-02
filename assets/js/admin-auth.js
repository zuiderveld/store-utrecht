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
  const params = new URLSearchParams({
    client_id: window.STORE_CONFIG.discordClientId,
    redirect_uri: adminRedirectUri(),
    response_type: 'code',
    scope: 'identify guilds guilds.members.read',
  });
  window.location.href = 'https://discord.com/api/oauth2/authorize?' + params.toString();
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
