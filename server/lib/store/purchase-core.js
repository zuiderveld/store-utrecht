const crypto = require('crypto');

function findUserByLicense(state, license) {
  if (!license) return null;
  return Object.values(state.users || {}).find((u) => u.license === license) || null;
}

function findUserByDiscordId(state, discordId) {
  if (!discordId) return null;
  if (state.users?.[discordId]) return state.users[discordId];
  return Object.values(state.users || {}).find((u) => u.discordId === discordId) || null;
}

function findUserInState(state, userRef) {
  if (!userRef) return null;
  const id = userRef.userId || userRef.discordId;
  if (id && state.users[id]) return state.users[id];
  if (userRef.discordId) return findUserByDiscordId(state, userRef.discordId);
  return Object.values(state.users || {}).find((u) => u.userId === id) || null;
}

function getProduct(state, productId) {
  return state.products.find((p) => p.id === productId && p.active !== false) || null;
}

function validateProductMeta(product) {
  const type = product.type || 'item';
  const meta = product.meta || {};
  const label = product.name || product.id || 'Product';
  if (type === 'vehicle' && !meta.model) {
    throw new Error(`${label}: mist spawn model (admin → meta.model)`);
  }
  if (type === 'item') {
    if (!meta.item) {
      throw new Error(`${label}: mist ox item naam (admin → meta.item, bijv. water)`);
    }
    const normalized = String(meta.item).trim();
    if (normalized.toLowerCase().startsWith('weapon_')) {
      meta.item = normalized.toUpperCase();
    } else {
      meta.item = normalized.toLowerCase();
    }
  }
  if (type === 'discord_role') {
    const { normalizeRoleId } = require('./discord-role-fulfill');
    const roleId = normalizeRoleId(meta.discordRoleId || meta.roleId);
    if (!roleId) {
      throw new Error(`${label}: mist Discord rol-ID (admin → meta.discordRoleId)`);
    }
    meta.discordRoleId = roleId;
  }
  if (type === 'external_link') {
    const url = String(meta.externalUrl || meta.url || '').trim();
    if (!url || !/^https?:\/\//i.test(url)) {
      throw new Error(`${label}: externe link verplicht (https://…)`);
    }
    meta.externalUrl = url;
    if (meta.buttonLabel) meta.buttonLabel = String(meta.buttonLabel).trim();
  }
  if (type === 'weapon_camo') {
    const weapon = String(meta.weapon || '').trim().toUpperCase();
    const camoId = String(meta.camoId || '').trim().toLowerCase();
    if (!weapon || !weapon.startsWith('WEAPON_')) {
      throw new Error(`${label}: wapen verplicht (meta.weapon, bijv. WEAPON_PISTOL)`);
    }
    if (!camoId) {
      throw new Error(`${label}: camo ID verplicht (meta.camoId, bijv. purple_haze)`);
    }
    meta.weapon = weapon;
    meta.camoId = camoId;
    meta.weaponLabel = String(meta.weaponLabel || '').trim();
    meta.weaponGroup = String(meta.weaponGroup || 'OVERIG').trim().toUpperCase();
    meta.tint = Math.min(7, Math.max(0, Number(meta.tint) || 0));
    if (meta.oxItem) meta.oxItem = String(meta.oxItem).trim().toLowerCase();
  }
}

function mergeOrderMeta(state, order) {
  const product = order.productId ? getProduct(state, order.productId) : null;
  return { ...(product?.meta || {}), ...(order.meta || {}) };
}

function normalizeProductIds(raw) {
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
  if (raw && typeof raw === 'object') {
    return Object.keys(raw)
      .sort((a, b) => Number(a) - Number(b))
      .map((k) => raw[k])
      .filter(Boolean)
      .map(String);
  }
  if (raw) return [String(raw)];
  return [];
}

function createOrder(user, product, price) {
  return {
    id: 'ord_' + crypto.randomBytes(8).toString('hex'),
    discordId: user.discordId,
    username: user.globalName || user.displayName || user.username || null,
    license: user.license,
    identifiers: user.identifiers || [],
    productId: product.id,
    productName: product.name,
    productType: product.type || 'item',
    price,
    meta: product.meta || {},
    status: 'pending',
    createdAt: Date.now(),
  };
}

function purchaseOne(state, user, productId) {
  const product = getProduct(state, productId);
  if (!product) throw new Error('Product niet gevonden');
  if (product.type === 'external_link') {
    throw new Error('Dit product is alleen via externe link — geen coin-aankoop');
  }
  validateProductMeta(product);
  if (!user.license) throw new Error('FiveM account niet gekoppeld — gebruik /koppelstore in-game');
  if (!user.discordId) throw new Error('Discord account niet gekoppeld');

  const price = Number(product.price) || 0;
  const coins = Number(user.coins) || 0;
  if (coins < price) throw new Error('Onvoldoende coins');

  user.coins = coins - price;
  user.updatedAt = Date.now();

  const order = createOrder(user, product, price);
  state.orders.unshift(order);
  if (state.orders.length > 500) state.orders = state.orders.slice(0, 500);

  return { order, coins: user.coins, product };
}

function purchaseCart(state, user, productIds) {
  if (!Array.isArray(productIds) || !productIds.length) {
    throw new Error('Geen producten geselecteerd');
  }
  if (!user.license) throw new Error('FiveM account niet gekoppeld — gebruik /koppelstore in-game');
  if (!user.discordId) throw new Error('Discord account niet gekoppeld');

  const unique = [...new Set(productIds)];
  const products = unique.map((id) => {
    const p = getProduct(state, id);
    if (!p) throw new Error('Product niet gevonden: ' + id);
    if (p.type === 'external_link') {
      throw new Error('"' + (p.name || id) + '" is alleen via externe link — geen coin-aankoop');
    }
    validateProductMeta(p);
    return p;
  });

  const total = products.reduce((sum, p) => sum + (Number(p.price) || 0), 0);
  const coins = Number(user.coins) || 0;
  if (coins < total) throw new Error('Onvoldoende coins');

  const orders = [];
  user.coins = coins - total;
  user.updatedAt = Date.now();

  products.forEach((product) => {
    const price = Number(product.price) || 0;
    const order = createOrder(user, product, price);
    orders.push(order);
    state.orders.unshift(order);
  });

  if (state.orders.length > 500) state.orders = state.orders.slice(0, 500);

  return { orders, coins: user.coins, total };
}

module.exports = {
  findUserByLicense,
  findUserByDiscordId,
  findUserInState,
  purchaseOne,
  purchaseCart,
  mergeOrderMeta,
  validateProductMeta,
  normalizeProductIds,
};
