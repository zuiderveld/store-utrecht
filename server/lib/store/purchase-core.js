const crypto = require('crypto');

function findUserByLicense(state, license) {
  if (!license) return null;
  return Object.values(state.users || {}).find((u) => u.license === license) || null;
}

function findUserByDiscordId(state, discordId) {
  return state.users?.[discordId] || null;
}

function getProduct(state, productId) {
  return state.products.find((p) => p.id === productId && p.active !== false) || null;
}

function createOrder(user, product, price) {
  return {
    id: 'ord_' + crypto.randomBytes(8).toString('hex'),
    discordId: user.discordId,
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
  if (!user.license) throw new Error('FiveM account niet gekoppeld — gebruik /koppelstore op de website');

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
  if (!user.license) throw new Error('FiveM account niet gekoppeld — gebruik /koppelstore op de website');

  const unique = [...new Set(productIds)];
  const products = unique.map((id) => {
    const p = getProduct(state, id);
    if (!p) throw new Error('Product niet gevonden: ' + id);
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
  purchaseOne,
  purchaseCart,
};
