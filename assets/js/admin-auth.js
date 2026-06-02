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
}

function clearAdminSession() {
  sessionStorage.removeItem('urpAdminToken');
  sessionStorage.removeItem('urpAdminUser');
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
  if (!res.ok) throw new Error(data.error || res.statusText);
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
