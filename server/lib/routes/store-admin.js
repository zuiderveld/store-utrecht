const crypto = require('crypto');
const { cors, json, readBody } = require('../store/http');
const { requireAdmin } = require('../store/session');
const { saveState, getState, loadCatalogBackup, writeCatalogBackup } = require('../store/state-store');
const { findUser } = require('../store/auth-sessions');
const { logStoreAdminAction } = require('../store/discord-webhooks');
const {
  uploadWeaponImage,
  deleteWeaponImage,
  uploadProductImage,
  deleteProductImage,
  publicCamoAssets,
  detectContentType,
  weaponIdFromFilename,
} = require('../store/camo-assets');

function slugify(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'cat';
}

function resolveAdminUser(state, { userId, discordId }) {
  if (userId) {
    const u = findUser(state, userId);
    if (u) return u;
  }
  if (discordId) {
    const u = findUser(state, discordId) || state.users[discordId];
    if (u) return u;
  }
  return null;
}

function mapUserForAdmin(u) {
  const userId = u.userId || u.discordId || null;
  return {
    userId,
    discordId: u.discordId || null,
    email: u.email || null,
    username: u.globalName || u.displayName || u.username || 'Speler',
    coins: u.coins || 0,
    license: u.license || null,
    linked: Boolean(u.license),
    discordLinked: Boolean(u.discordId),
    updatedAt: u.updatedAt || u.createdAt || 0,
  };
}

function findUserForOrder(state, order) {
  if (!order) return null;
  if (order.discordId && state.users[order.discordId]) return state.users[order.discordId];
  if (order.license) {
    const byLicense = Object.values(state.users || {}).find((u) => u.license === order.license);
    if (byLicense) return byLicense;
  }
  if (order.discordId) {
    return Object.values(state.users || {}).find((u) => u.discordId === order.discordId) || null;
  }
  return null;
}

function mapOrderForAdmin(state, order) {
  const user = findUserForOrder(state, order);
  return {
    id: order.id,
    productName: order.productName,
    productType: order.productType,
    price: order.price || 0,
    status: order.status,
    license: order.license || user?.license || null,
    discordId: order.discordId || user?.discordId || null,
    username: order.username || user?.globalName || user?.displayName || user?.username || null,
    email: user?.email || null,
    note: order.note || '',
    refunded: Boolean(order.refunded),
    createdAt: order.createdAt || null,
    completedAt: order.completedAt || null,
  };
}

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const adminCtx = await requireAdmin(req.headers.authorization);
    const body = req.method === 'GET' ? {} : await readBody(req);
    const action = body.action || req.query?.action;

    if (req.method === 'GET' && (!action || action === 'snapshot')) {
      const state = await getState();
      return json(res, 200, {
        categories: state.categories,
        products: state.products,
        camoAssets: publicCamoAssets(state),
        users: Object.values(state.users)
          .map(mapUserForAdmin)
          .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)),
        orders: state.orders.slice(0, 50).map((o) => mapOrderForAdmin(state, o)),
      });
    }

    if (req.method === 'GET' && action === 'catalog-backup') {
      const backup = await loadCatalogBackup();
      return json(res, 200, {
        ok: true,
        backup: backup || null,
        counts: backup
          ? { categories: (backup.categories || []).length, products: (backup.products || []).length }
          : null,
      });
    }

    if (req.method === 'POST' && action === 'catalog-backup-save') {
      const state = await getState();
      const backup = await writeCatalogBackup(state);
      if (!backup) throw new Error('Catalog backup mislukt — check BLOB_READ_WRITE_TOKEN');
      const payload = {
        ok: true,
        savedAt: backup.savedAt,
        counts: { categories: backup.categories.length, products: backup.products.length },
      };
      logStoreAdminAction(adminCtx, action, body, payload);
      return json(res, 200, payload);
    }

    if (req.method === 'POST' && action === 'catalog-restore') {
      const backup = await loadCatalogBackup();
      if (!backup || !Array.isArray(backup.categories) || !Array.isArray(backup.products)) {
        throw new Error('Geen catalog backup gevonden in Vercel Blob (store/catalog-backup.json)');
      }
      await saveState((state) => {
        state.categories = backup.categories;
        state.products = backup.products;
        return state;
      });
      const payload = {
        ok: true,
        restoredAt: backup.savedAt || null,
        counts: { categories: backup.categories.length, products: backup.products.length },
      };
      logStoreAdminAction(adminCtx, action, body, payload);
      return json(res, 200, payload);
    }

    if (req.method === 'POST' && action === 'catalog-import') {
      const categories = body.categories;
      const products = body.products;
      if (!Array.isArray(categories) || !Array.isArray(products)) {
        throw new Error('categories en products moeten arrays zijn');
      }
      await saveState((state) => {
        state.categories = categories;
        state.products = products;
        return state;
      });
      const payload = {
        ok: true,
        counts: { categories: categories.length, products: products.length },
      };
      logStoreAdminAction(adminCtx, action, body, payload);
      return json(res, 200, payload);
    }

    if (req.method !== 'POST') return json(res, 405, { error: 'Gebruik GET snapshot of POST acties' });

    let result = { ok: true };

    await saveState(async (state) => {
      switch (action) {
        case 'category-save': {
          const { id, name, sort } = body;
          if (!name) throw new Error('Naam verplicht');
          const cid = id || 'cat_' + slugify(name);
          const idx = state.categories.findIndex((c) => c.id === cid);
          const row = { id: cid, name, slug: slugify(name), sort: Number(sort) || 0 };
          if (idx >= 0) state.categories[idx] = { ...state.categories[idx], ...row };
          else state.categories.push(row);
          result.category = row;
          break;
        }
        case 'category-delete': {
          const { id } = body;
          state.categories = state.categories.filter((c) => c.id !== id);
          break;
        }
        case 'product-save': {
          const {
            id,
            categoryId,
            name,
            description,
            price,
            originalPrice,
            type,
            active,
            image,
            meta,
            imageBase64,
            imageFileName,
            clearImage,
          } = body;
          if (!name || !categoryId) throw new Error('Naam en categorie verplicht');
          const pid = id || 'prod_' + crypto.randomBytes(6).toString('hex');
          const idx = state.products.findIndex((p) => p.id === pid);
          const existing = idx >= 0 ? state.products[idx] : null;
          let imageUrl = String(image || '').trim();

          if (imageBase64) {
            const buffer = Buffer.from(String(imageBase64), 'base64');
            const contentType = detectContentType(buffer, imageFileName || '');
            const uploaded = await uploadProductImage(state, pid, buffer, contentType, imageFileName || '');
            imageUrl = uploaded.url;
          } else if (clearImage) {
            await deleteProductImage(state, pid);
            imageUrl = '';
          } else if (existing && !imageUrl) {
            imageUrl = existing.image || '';
          }

          const row = {
            id: pid,
            categoryId,
            name,
            description: description || '',
            price: Number(price) || 0,
            originalPrice: originalPrice ? Number(originalPrice) : null,
            type: type || 'item',
            active: active !== false,
            image: imageUrl,
            meta: meta || {},
          };
          if (idx >= 0) state.products[idx] = { ...state.products[idx], ...row };
          else state.products.push(row);
          if (row.type === 'vehicle' && !row.meta?.model) {
            throw new Error('Voertuig vereist spawn model (meta.model, bijv. adder)');
          }
          if (row.type === 'item' && !row.meta?.item) {
            throw new Error('Item vereist ox item naam (meta.item, bijv. bread)');
          }
          if (row.type === 'discord_role') {
            const { normalizeRoleId } = require('../store/discord-role-fulfill');
            const roleId = normalizeRoleId(row.meta?.discordRoleId || row.meta?.roleId);
            if (!roleId) {
              throw new Error('Discord rol vereist rol-ID (meta.discordRoleId)');
            }
            row.meta = { ...(row.meta || {}), discordRoleId: roleId };
          }
          if (row.type === 'external_link') {
            const url = String(row.meta?.externalUrl || row.meta?.url || '').trim();
            if (!url || !/^https?:\/\//i.test(url)) {
              throw new Error('Externe link vereist een geldige URL (https://…)');
            }
            row.meta = {
              ...(row.meta || {}),
              externalUrl: url,
              buttonLabel: String(row.meta?.buttonLabel || 'Naar Discord').trim() || 'Naar Discord',
              priceUnit: String(row.meta?.priceUnit || '€').trim(),
            };
          }
          if (row.type === 'weapon_camo') {
            const weapon = String(row.meta?.weapon || '').trim().toUpperCase();
            const camoId = String(row.meta?.camoId || '').trim().toLowerCase();
            if (!weapon || !weapon.startsWith('WEAPON_')) {
              throw new Error('Wapen camo vereist meta.weapon (bijv. WEAPON_PISTOL)');
            }
            if (!camoId) {
              throw new Error('Wapen camo vereist meta.camoId (bijv. purple_haze)');
            }
            row.meta = {
              ...(row.meta || {}),
              weapon,
              camoId,
              weaponLabel: String(row.meta?.weaponLabel || '').trim(),
              weaponGroup: String(row.meta?.weaponGroup || 'OVERIG').trim().toUpperCase(),
              tint: Math.min(7, Math.max(0, Number(row.meta?.tint) || 0)),
              oxItem: String(row.meta?.oxItem || 'weapon_camo').trim().toLowerCase(),
            };
          }
          result.product = row;
          break;
        }
        case 'product-delete': {
          const productId = body.id;
          if (productId) await deleteProductImage(state, productId);
          state.products = state.products.filter((p) => p.id !== productId);
          break;
        }
        case 'coins-set':
        case 'user-save': {
          const { userId, discordId, coins, username } = body;
          let user = resolveAdminUser(state, { userId, discordId });

          if (!user && discordId) {
            const key = String(discordId).trim();
            state.users[key] = {
              userId: key,
              discordId: key,
              username: username && String(username).trim() ? String(username).trim() : 'Speler',
              coins: 0,
              license: null,
              identifiers: [],
              createdAt: Date.now(),
            };
            user = state.users[key];
          }

          if (!user) throw new Error('Gebruiker niet gevonden — laat speler eerst inloggen op de store');

          if (coins != null && coins !== '') {
            user.coins = Math.max(0, Number(coins) || 0);
          }
          if (username && String(username).trim()) {
            user.displayName = String(username).trim();
            user.username = user.displayName;
          }
          user.updatedAt = Date.now();
          result.user = mapUserForAdmin(user);
          break;
        }
        case 'coins-add': {
          const { userId, discordId, amount } = body;
          const user = resolveAdminUser(state, { userId, discordId });
          if (!user) throw new Error('Gebruiker niet gevonden');
          const add = Number(amount) || 0;
          user.coins = (Number(user.coins) || 0) + add;
          user.updatedAt = Date.now();
          result.user = mapUserForAdmin(user);
          break;
        }
        case 'order-requeue': {
          const { id } = body;
          const order = state.orders.find((o) => o.id === id);
          if (!order) throw new Error('Order niet gevonden');
          if (order.status !== 'failed') throw new Error('Alleen mislukte orders opnieuw proberen');
          order.status = 'pending';
          order.note = 'requeued_by_admin';
          delete order.completedAt;
          result.order = order;
          break;
        }
        case 'camo-weapon-upload': {
          const { weapon, imageBase64 } = body;
          if (!weapon || !imageBase64) throw new Error('weapon en imageBase64 verplicht');
          const buffer = Buffer.from(String(imageBase64), 'base64');
          const uploaded = await uploadWeaponImage(state, weapon, buffer);
          result.weaponId = uploaded.weaponId;
          result.camoAssets = publicCamoAssets(state);
          break;
        }
        case 'camo-weapons-bulk-upload': {
          const files = body.files;
          if (!Array.isArray(files) || !files.length) throw new Error('files array verplicht');
          const uploaded = [];
          const skipped = [];
          for (const file of files) {
            const weaponId = weaponIdFromFilename(file.name) || (file.weapon ? String(file.weapon) : null);
            if (!weaponId || !file.imageBase64) {
              skipped.push(file.name || file.weapon || 'onbekend');
              continue;
            }
            try {
              const buffer = Buffer.from(String(file.imageBase64), 'base64');
              const row = await uploadWeaponImage(state, weaponId, buffer);
              uploaded.push(row.weaponId);
            } catch (err) {
              skipped.push((file.name || weaponId) + ': ' + err.message);
            }
          }
          result.uploaded = uploaded;
          result.skipped = skipped;
          result.camoAssets = publicCamoAssets(state);
          break;
        }
        case 'camo-weapon-delete': {
          const deleted = await deleteWeaponImage(state, body.weapon);
          result.deleted = deleted;
          result.camoAssets = publicCamoAssets(state);
          break;
        }
        default:
          throw new Error('Onbekende actie: ' + action);
      }
      return state;
    });

    logStoreAdminAction(adminCtx, action, body, result);

    return json(res, 200, result);
  } catch (err) {
    console.error('store-admin:', err);
    const code = err.message?.includes('Niet ingelogd') || err.message?.includes('beheer') ? 403 : 400;
    return json(res, code, { error: err.message || 'Admin actie mislukt' });
  }
};
