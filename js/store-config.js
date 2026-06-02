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
  return window.location.origin + window.location.pathname;
}

window.storeRedirectUri = discordRedirectUri;
window.storeAdminRedirectUri = discordRedirectUri;

window.getStoreDiscordAuthUrl = function (redirectUri, linkUserId) {
  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    redirect_uri: redirectUri || discordRedirectUri(),
    response_type: 'code',
    scope: 'identify guilds',
  });
  if (linkUserId) params.set('state', 'link:' + linkUserId);
  return 'https://discord.com/api/oauth2/authorize?' + params.toString();
};
