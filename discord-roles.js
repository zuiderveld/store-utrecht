/** URP Discord + store-beheer rol */
module.exports = {
  clientId: '1105558581304098867',
  /** Utrecht Roleplay Discord server — moet gelijk zijn aan DISCORD_GUILD_ID in Vercel */
  guildId: '1416816652644909109',
  /** Rollen met toegang tot /admin.html */
  beheerRoleIds: ['1502448726676078704'],
  /** Optioneel: Discord user-IDs met altijd admin (via Vercel STORE_ADMIN_DISCORD_IDS) */
  adminDiscordIds: [],
  ranks: [
    { id: 'store-beheer', naam: 'Store Beheer', discordRoleId: '1502448726676078704' },
  ],
};
