/** Zelfde Discord OAuth-app als staff-portaal */
const SITE_API = window.location.origin;
const DISCORD_CLIENT_ID = '1105558581304098867';

window.STORE_CONFIG = {
  storeUrl: 'https://store.utrechtroleplay.eu',
  apiBase: SITE_API,
  discordClientId: DISCORD_CLIENT_ID,
  mainSiteUrl: 'https://www.utrechtroleplay.eu/',
  tebexUrl: 'https://utrecht-roleplay-tebex.tebex.io/',
  coinPackages: [
    {
      id: 'coins-1',
      name: '1 URP Coin',
      description: 'Met deze coins koop je producten via /store in-game of op deze website.',
      coins: 1,
      price: 0.99,
      salePrice: 0.5,
      tebexUrl: 'https://utrecht-roleplay-tebex.tebex.io/',
    },
    {
      id: 'coins-5',
      name: '5 URP Coins',
      description: 'Met deze coins koop je producten via /store in-game of op deze website.',
      coins: 5,
      price: 4.99,
      salePrice: 2.5,
      tebexUrl: 'https://utrecht-roleplay-tebex.tebex.io/',
    },
    {
      id: 'coins-15',
      name: '15 URP Coins',
      description: 'Met deze coins koop je producten via /store in-game of op deze website.',
      coins: 15,
      price: 14.99,
      salePrice: 7.5,
      tebexUrl: 'https://utrecht-roleplay-tebex.tebex.io/',
    },
    {
      id: 'coins-35',
      name: '35 URP Coins',
      description: 'Met deze coins koop je producten via /store in-game of op deze website.',
      coins: 35,
      price: 34.99,
      salePrice: 17.5,
      tebexUrl: 'https://utrecht-roleplay-tebex.tebex.io/',
    },
    {
      id: 'coins-50',
      name: '50 URP Coins',
      description: 'Met deze coins koop je producten via /store in-game of op deze website.',
      coins: 50,
      price: 49.99,
      salePrice: 25.0,
      tebexUrl: 'https://utrecht-roleplay-tebex.tebex.io/',
    },
    {
      id: 'coins-100',
      name: '100 + 25 URP Coins',
      description: 'Bonus coins! Met deze coins koop je producten via /store in-game of op deze website.',
      coins: 125,
      price: 99.99,
      salePrice: 50.0,
      tebexUrl: 'https://utrecht-roleplay-tebex.tebex.io/',
    },
  ],
};

function discordRedirectUri() {
  return window.location.origin + window.location.pathname;
}

window.storeRedirectUri = discordRedirectUri;
window.storeAdminRedirectUri = discordRedirectUri;

window.getStoreDiscordAuthUrl = function (redirectUri) {
  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    redirect_uri: redirectUri || discordRedirectUri(),
    response_type: 'code',
    scope: 'identify guilds',
  });
  return 'https://discord.com/api/oauth2/authorize?' + params.toString();
};

(function initTebexLinks() {
  const url = window.STORE_CONFIG.tebexUrl;
  document.addEventListener('DOMContentLoaded', function () {
    ['btnBuyCoins', 'sidebarTebex', 'footerTebex', 'heroTebex'].forEach(function (id) {
      const el = document.getElementById(id);
      if (el) el.href = url;
    });
  });
})();
