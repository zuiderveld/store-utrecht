const { verifyStoreMember } = require('./discord-store');
const { getState, saveState } = require('./blob-store');

async function upsertUserFromDiscord(discord) {
  const now = Date.now();
  await saveState((state) => {
    if (!state.users[discord.discordId]) {
      state.users[discord.discordId] = {
        discordId: discord.discordId,
        username: discord.discordUsername,
        globalName: discord.username,
        avatar: null,
        coins: 0,
        license: null,
        identifiers: [],
        linkedAt: null,
        updatedAt: now,
      };
    } else {
      state.users[discord.discordId].username = discord.discordUsername;
      state.users[discord.discordId].globalName = discord.username;
      state.users[discord.discordId].updatedAt = now;
    }
    return state;
  });
}

function getAccessToken(authHeader) {
  if (!authHeader?.startsWith('Bearer ')) return null;
  return authHeader.slice(7).trim() || null;
}

async function resolveDiscord(authHeader) {
  const accessToken = getAccessToken(authHeader);
  if (!accessToken) return null;

  const discord = await verifyStoreMember(accessToken);
  await upsertUserFromDiscord(discord);

  const state = await getState();
  const user = state.users[discord.discordId];
  if (!user) return null;

  return {
    accessToken,
    discord,
    user,
    state,
    isAdmin: discord.isAdmin,
    fivemLinked: Boolean(user.license),
  };
}

async function requireDiscord(authHeader) {
  const ctx = await resolveDiscord(authHeader);
  if (!ctx) throw new Error('Log eerst in met Discord (zelfde login als staff-portaal).');
  return ctx;
}

async function requireDiscordAndFivem(authHeader) {
  const ctx = await requireDiscord(authHeader);
  if (!ctx.user.license) {
    throw new Error(
      'Koppel je FiveM-account: klik "Koppel FiveM" en typ /koppelstore CODE in-game. Coins gebruiken kan alleen met Discord + FiveM gekoppeld.'
    );
  }
  return ctx;
}

async function requireAdmin(authHeader) {
  const ctx = await requireDiscord(authHeader);
  if (!ctx.isAdmin) {
    throw new Error('Geen store-beheer rechten (Founder/Co-Founder of DISCORD_STORE_ADMIN_ROLES).');
  }
  return ctx;
}

module.exports = {
  upsertUserFromDiscord,
  resolveDiscord,
  requireDiscord,
  requireDiscordAndFivem,
  requireAdmin,
};
