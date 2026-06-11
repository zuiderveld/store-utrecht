const DEFAULT_STATE = {
  version: 1,
  categories: [
    { id: 'vehicles', name: 'Voertuigen', slug: 'vehicles', sort: 0 },
    { id: 'items', name: 'Items', slug: 'items', sort: 1 },
    { id: 'cosmetics', name: 'Cosmetics', slug: 'cosmetics', sort: 2 },
  ],
  products: [
    {
      id: 'demo-adder',
      categoryId: 'vehicles',
      name: 'Adder (demo)',
      description: 'Supercar — wordt in je garage gezet na aankoop.',
      price: 500,
      type: 'vehicle',
      active: true,
      image: '',
      meta: { model: 'adder', garage: 'pillboxgarage' },
    },
  ],
  users: {},
  sessions: {},
  linkCodes: {},
  authSessions: {},
  emailIndex: {},
  orders: [],
  camoAssets: { weapons: {}, camos: {} },
  productImages: {},
};

function emptyState() {
  return JSON.parse(JSON.stringify(DEFAULT_STATE));
}

function normalizeState(raw) {
  if (!raw || typeof raw !== 'object') {
    return emptyState();
  }
  return {
    ...DEFAULT_STATE,
    ...raw,
    categories: Array.isArray(raw.categories) ? raw.categories : DEFAULT_STATE.categories,
    products: Array.isArray(raw.products) ? raw.products : DEFAULT_STATE.products,
    users: raw.users || {},
    sessions: raw.sessions || {},
    linkCodes: raw.linkCodes || {},
    authSessions: raw.authSessions || {},
    emailIndex: raw.emailIndex || {},
    orders: raw.orders || [],
    camoAssets:
      raw.camoAssets && typeof raw.camoAssets === 'object'
        ? {
            weapons: raw.camoAssets.weapons && typeof raw.camoAssets.weapons === 'object' ? raw.camoAssets.weapons : {},
            camos: raw.camoAssets.camos && typeof raw.camoAssets.camos === 'object' ? raw.camoAssets.camos : {},
          }
        : { weapons: {}, camos: {} },
    productImages:
      raw.productImages && typeof raw.productImages === 'object' ? raw.productImages : {},
    adminSessions: raw.adminSessions || {},
  };
}

module.exports = { DEFAULT_STATE, emptyState, normalizeState };
