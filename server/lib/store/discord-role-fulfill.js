const rolesFile = require('./discord-roles');

function getBotHeaders() {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) throw new Error('DISCORD_BOT_TOKEN ontbreekt in Vercel.');
  return { Authorization: `Bot ${token}` };
}

function getGuildId() {
  let guildId = String(process.env.DISCORD_GUILD_ID || rolesFile.guildId || '').trim();
  if (
    (guildId.startsWith('"') && guildId.endsWith('"')) ||
    (guildId.startsWith("'") && guildId.endsWith("'"))
  ) {
    guildId = guildId.slice(1, -1).trim();
  }
  if (!guildId) throw new Error('DISCORD_GUILD_ID ontbreekt in Vercel.');
  return guildId;
}

function normalizeRoleId(value) {
  const raw = String(value || '').trim();
  const mention = raw.match(/^<@&(\d{17,20})>$/);
  if (mention) return mention[1];
  if (/^\d{17,20}$/.test(raw)) return raw;
  return null;
}

function isDiscordRoleOrder(order) {
  if (!order || order.status !== 'pending') return false;
  if (order.productType === 'discord_role') return true;
  const meta = order.meta || {};
  return Boolean(normalizeRoleId(meta.discordRoleId || meta.roleId));
}

function resolveOrderRoleId(order, product) {
  const meta = { ...(product?.meta || {}), ...(order.meta || {}) };
  return normalizeRoleId(meta.discordRoleId || meta.roleId);
}

function refundOrderCoins(state, order) {
  const user =
    (order.discordId && state.users[order.discordId]) ||
    Object.values(state.users || {}).find((u) => u.license === order.license) ||
    null;
  if (!user) return false;
  user.coins = (Number(user.coins) || 0) + (Number(order.price) || 0);
  user.updatedAt = Date.now();
  order.refunded = true;
  return true;
}

async function assignDiscordRole(discordUserId, roleId) {
  const guildId = getGuildId();
  const userId = String(discordUserId).trim();
  const role = normalizeRoleId(roleId);
  if (!userId || !role) throw new Error('Ongeldige Discord user of rol-ID');

  const res = await fetch(
    `https://discord.com/api/v10/guilds/${guildId}/members/${userId}/roles/${role}`,
    { method: 'PUT', headers: getBotHeaders() }
  );

  if (res.status === 204 || res.status === 201) {
    return { ok: true, roleId: role };
  }

  let detail = '';
  try {
    const data = await res.json();
    detail = data.message || data.error || '';
  } catch {
    /* ok */
  }

  if (res.status === 404) {
    throw new Error('Speler zit niet op de URP Discord server.');
  }
  if (res.status === 403) {
    throw new Error(
      'Bot kan rol niet geven — zet bot-rol boven de doelrol en MANAGE_ROLES aan.'
    );
  }

  throw new Error(detail || `Discord rol mislukt (HTTP ${res.status})`);
}

async function fulfillDiscordRoleOrder(state, order) {
  const product = state.products.find((p) => p.id === order.productId);
  const roleId = resolveOrderRoleId(order, product);

  if (!order.discordId) {
    return { ok: false, permanent: true, note: 'no_discord_id' };
  }
  if (!roleId) {
    return { ok: false, permanent: true, note: 'no_role_configured' };
  }

  await assignDiscordRole(order.discordId, roleId);
  return { ok: true, note: `discord_role:${roleId}` };
}

async function processPendingDiscordRoleOrders(state) {
  const processed = [];

  for (const order of state.orders) {
    if (!isDiscordRoleOrder(order)) continue;

    try {
      const result = await fulfillDiscordRoleOrder(state, order);
      if (result.ok) {
        order.status = 'done';
        order.completedAt = Date.now();
        order.note = result.note;
        processed.push({ id: order.id, ok: true });
        continue;
      }

      if (result.permanent) {
        order.status = 'failed';
        order.completedAt = Date.now();
        order.note = result.note;
        refundOrderCoins(state, order);
        processed.push({ id: order.id, ok: false, note: result.note });
      }
    } catch (err) {
      const msg = err.message || 'discord_role_failed';
      order.note = msg;

      if (/niet op de URP Discord|Unknown Member|10007/i.test(msg)) {
        order.status = 'failed';
        order.completedAt = Date.now();
        refundOrderCoins(state, order);
        processed.push({ id: order.id, ok: false, note: msg });
      } else {
        processed.push({ id: order.id, ok: false, retry: true, note: msg });
      }
    }
  }

  return processed;
}

function purchaseMessageForOrder(order) {
  if (order.productType === 'vehicle') {
    return 'Aankoop gelukt — voertuig staat binnen enkele seconden in je garage (open je garage in-game).';
  }
  if (order.productType === 'discord_role') {
    return 'Aankoop gelukt — je Discord-rol wordt direct toegekend (check Discord).';
  }
  if (order.productType === 'item') {
    return 'Aankoop gelukt — item komt binnen enkele seconden in je ox_inventory (je moet online zijn).';
  }
  return 'Aankoop gelukt.';
}

module.exports = {
  isDiscordRoleOrder,
  resolveOrderRoleId,
  assignDiscordRole,
  fulfillDiscordRoleOrder,
  processPendingDiscordRoleOrders,
  purchaseMessageForOrder,
  normalizeRoleId,
};
