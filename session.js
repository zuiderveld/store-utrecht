const { verifyStoreMember, verifyStoreMemberByDiscordId } = require('./discord-store');
const { requireAdminAuth } = require('./admin-auth');

const { getState, saveState } = require('./blob-store');

const {

  resolveSessionUserId,

  findUser,

  findUserByDiscordId,

  userPayload,

  isStoreSessionToken,

} = require('./auth-sessions');



function getAccessToken(authHeader) {

  if (!authHeader?.startsWith('Bearer ')) return null;

  return authHeader.slice(7).trim() || null;

}



async function adminStatusForUser(user) {

  if (!user?.discordId) return false;

  try {

    const check = await verifyStoreMemberByDiscordId(user.discordId, {

      username: user.globalName || user.username,

      discordUsername: user.discordUsername,

      avatarUrl: user.avatarUrl,

    });

    return check.isAdmin;

  } catch {

    return false;

  }

}



async function upsertDiscordUser(discord) {

  const now = Date.now();

  await saveState((state) => {

    const existing = state.users[discord.discordId];

    if (!existing) {

      state.users[discord.discordId] = {

        userId: discord.discordId,

        discordId: discord.discordId,

        username: discord.discordUsername,

        globalName: discord.username,

        discordUsername: discord.discordUsername,

        avatarUrl: discord.avatarUrl,

        coins: 0,

        license: null,

        identifiers: [],

        linkedAt: null,

        updatedAt: now,

      };

    } else {

      existing.username = discord.discordUsername;

      existing.globalName = discord.username;

      existing.discordUsername = discord.discordUsername;

      existing.avatarUrl = discord.avatarUrl;

      existing.discordId = discord.discordId;

      existing.userId = existing.userId || discord.discordId;

      existing.updatedAt = now;

    }

    return state;

  });

}



async function linkDiscordToEmailUser(userId, discord) {

  await saveState((state) => {

    const emailUser = findUser(state, userId);

    if (!emailUser || !emailUser.email) throw new Error('E-mail account niet gevonden');



    const existingDiscord = findUserByDiscordId(state, discord.discordId);

    if (existingDiscord && existingDiscord.userId !== userId && !existingDiscord.email) {

      throw new Error('Dit Discord-account is al gekoppeld aan een ander profiel');

    }



    emailUser.discordId = discord.discordId;

    emailUser.discordUsername = discord.discordUsername;

    emailUser.globalName = discord.username;

    emailUser.avatarUrl = discord.avatarUrl;

    emailUser.updatedAt = Date.now();



    if (existingDiscord && existingDiscord.userId === discord.discordId && existingDiscord.email) {

      // merge coins/license from duplicate if any

      emailUser.coins = Math.max(emailUser.coins || 0, existingDiscord.coins || 0);

      if (!emailUser.license && existingDiscord.license) {

        emailUser.license = existingDiscord.license;

        emailUser.identifiers = existingDiscord.identifiers || [];

      }

    }



    return state;

  });

}



async function resolveAuth(authHeader) {

  const accessToken = getAccessToken(authHeader);

  if (!accessToken) return null;



  if (isStoreSessionToken(accessToken)) {

    const state = await getState();

    const userId = resolveSessionUserId(state, accessToken);

    if (!userId) return null;

    const user = findUser(state, userId);

    if (!user) return null;

    const isAdmin = await adminStatusForUser(user);

    return {

      accessToken,

      user,

      state,

      isAdmin,

      authType: user.email ? 'email' : 'session',

    };

  }



  const discord = await verifyStoreMember(accessToken);

  await upsertDiscordUser(discord);



  const state = await getState();

  const user = findUserByDiscordId(state, discord.discordId);

  if (!user) return null;



  return {

    accessToken,

    discord,

    user,

    state,

    isAdmin: discord.isAdmin,

    authType: 'discord',

  };

}



async function requireAuth(authHeader) {

  const ctx = await resolveAuth(authHeader);

  if (!ctx) throw new Error('Log eerst in (Discord of e-mail).');

  return ctx;

}



async function requireDiscordAndFivem(authHeader) {

  const ctx = await requireAuth(authHeader);

  if (!ctx.user.discordId) {

    throw new Error('Koppel je Discord-account om coins te gebruiken.');

  }

  if (!ctx.user.license) {

    throw new Error(

      'Koppel je FiveM-account: klik "Koppel FiveM" en typ /koppelstore CODE in-game.'

    );

  }

  return ctx;

}



async function requireAdmin(authHeader) {
  return requireAdminAuth(authHeader);
}



function buildMe(ctx) {

  return userPayload(ctx.user, { isAdmin: ctx.isAdmin });

}



module.exports = {

  upsertDiscordUser,

  linkDiscordToEmailUser,

  resolveAuth,

  requireAuth,

  requireDiscordAndFivem,

  requireAdmin,

  buildMe,

  adminStatusForUser,

  // backwards compat

  resolveDiscord: resolveAuth,

  requireDiscord: requireAuth,

  upsertUserFromDiscord: upsertDiscordUser,

};


