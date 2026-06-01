/** Publieke store-config — apart project (store.utrechtroleplay.eu) */
window.STORE_CONFIG = {
  apiBase: window.location.origin,
  discordClientId: '1105558581304098867',
  mainSiteUrl: 'https://www.utrechtroleplay.eu/',
  storePath: '/',
  adminPath: '/admin.html',
};

window.storeRedirectUri = function () {
  return window.location.origin + window.STORE_CONFIG.storePath;
};

window.storeAdminRedirectUri = function () {
  return window.location.origin + window.STORE_CONFIG.adminPath;
};

window.getStoreDiscordAuthUrl = function (redirectUri) {
  const params = new URLSearchParams({
    client_id: window.STORE_CONFIG.discordClientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'identify',
  });
  return 'https://discord.com/api/oauth2/authorize?' + params.toString();
};
