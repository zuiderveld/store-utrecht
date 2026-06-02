const { cors, json, readBody } = require('../store/http');
const { exchangeCode, verifyStoreMember, verifyStoreMemberByDiscordId, getAdminDiagnostics } = require('../store/discord-store');
const { upsertDiscordUser, linkDiscordToEmailUser, buildMe } = require('../store/session');
const { getState, saveState } = require('../store/blob-store');
const {
  findUser,
  findUserByDiscordId,
  createSession,
  isStoreSessionToken,
  resolveSessionUserId,
} = require('../store/auth-sessions');

function bearerToken(req, body) {
  if (body.accessToken) return String(body.accessToken).trim();
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7).trim();
  return '';
}

async function performAdminCheck(token) {
  if (!token) {
    return {
      status: 400,
      body: { error: 'Niet ingelogd — klik op Inloggen met Discord.', isAdmin: false },
    };
  }

  if (isStoreSessionToken(token)) {
    const state = await getState();
    const userId = resolveSessionUserId(state, token);
    if (!userId) {
      return {
        status: 403,
        body: { error: 'Sessie verlopen — log opnieuw in met Discord.', isAdmin: false },
      };
    }

    const user = findUser(state, userId);
    if (!user?.discordId) {
      return {
        status: 403,
        body: {
          error: 'Geen Discord op je account. Log in met Discord (niet alleen e-mail).',
          isAdmin: false,
        },
      };
    }

    const check = await verifyStoreMemberByDiscordId(user.discordId, {
      username: user.globalName || user.username,
      discordUsername: user.discordUsername,
      avatarUrl: user.avatarUrl,
    });

    return {
      status: 200,
      body: {
        ...check,
        username: check.username || user.globalName || user.username,
        discordId: user.discordId,
        avatarUrl: user.avatarUrl || check.avatarUrl,
      },
    };
  }

  const discord = await verifyStoreMember(token);
  return { status: 200, body: { ...discord, accessToken: undefined } };
}

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return json(res, 405, { error: 'Alleen POST' });

  try {
    const body = await readBody(req);
    let accessToken = body.accessToken;

    if (body.action === 'admin-diag') {
      return json(res, 200, { ok: true, ...getAdminDiagnostics() });
    }

    if (body.action === 'admin-check') {
      const token = bearerToken(req, body);
      const result = await performAdminCheck(token);
      const diag = getAdminDiagnostics();
      return json(res, result.status, {
        ...result.body,
        ...diag,
      });
    }

    if (body.code) {
      if (!body.redirectUri) return json(res, 400, { error: 'redirectUri ontbreekt' });
      accessToken = await exchangeCode(body.code, body.redirectUri);
    }
    if (!accessToken) return json(res, 400, { error: 'Geen Discord code of token' });

    const discord = await verifyStoreMember(accessToken);

    if (body.linkUserId && String(body.linkUserId).startsWith('em_')) {
      await linkDiscordToEmailUser(body.linkUserId, discord);
    } else {
      await upsertDiscordUser(discord);
    }

    const state = await getState();
    const user = body.linkUserId
      ? findUser(state, body.linkUserId)
      : findUserByDiscordId(state, discord.discordId) || state.users[discord.discordId] || {};

    const me = buildMe({ user, isAdmin: discord.isAdmin });

    let sessionToken;
    await saveState((s) => {
      sessionToken = createSession(s, user.userId || discord.discordId);
      return s;
    });

    return json(res, 200, {
      ...me,
      accessToken: sessionToken,
      message: body.linkUserId ? 'Discord gekoppeld aan je account!' : undefined,
    });
  } catch (err) {
    console.error('store-auth:', err);
    return json(res, 403, { error: err.message || 'Inloggen mislukt' });
  }
};
