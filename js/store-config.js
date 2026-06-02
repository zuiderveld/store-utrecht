/** Store config — los van staff-portaal */
const SITE_API = window.location.origin;
const DISCORD_CLIENT_ID = '1105558581304098867';

window.STORE_CONFIG = {
  storeUrl: 'https://store.utrechtroleplay.eu',
  apiBase: SITE_API,
  discordClientId: DISCORD_CLIENT_ID,
  mainSiteUrl: 'https://www.utrechtroleplay.eu/',
};

function discordRedirectUri() {
  const path = window.location.pathname || '/';
  if (path.includes('admin')) {
    return window.location.origin + '/admin.html';
  }
  // Discord: registreer exact deze URL (zonder index.html)
  return window.location.origin + '/';
}

/** Altijd geregistreerd in Discord — gebruik voor admin-login (state=admin). */
function storeOAuthReturnUri() {
  return window.location.origin + '/';
}

window.storeRedirectUri = discordRedirectUri;
window.storeAdminRedirectUri = discordRedirectUri;
window.storeOAuthReturnUri = storeOAuthReturnUri;

window.getStoreDiscordAuthUrl = function (redirectUri, linkUserId, returnTo) {
  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    redirect_uri: redirectUri || discordRedirectUri(),
    response_type: 'code',
    scope: 'identify guilds guilds.members.read',
  });
  if (linkUserId) params.set('state', 'link:' + linkUserId);
  else if (returnTo === 'admin') params.set('state', 'admin');
  return 'https://discord.com/api/oauth2/authorize?' + params.toString();
};
