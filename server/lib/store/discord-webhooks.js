const WEBHOOK_PURCHASES = () => String(process.env.STORE_WEBHOOK_PURCHASES || '').trim();
const WEBHOOK_ADMIN = () => String(process.env.STORE_WEBHOOK_ADMIN || '').trim();

function truncate(value, max = 1024) {
  const text = String(value ?? '');
  return text.length > max ? text.slice(0, max - 3) + '…' : text;
}

function formatCoins(n) {
  const num = Number(n) || 0;
  return num.toLocaleString('nl-NL') + ' coins';
}

function playerName(user, order) {
  return (
    user?.globalName ||
    user?.displayName ||
    user?.username ||
    order?.username ||
    'Onbekend'
  );
}

async function postWebhook(url, payload) {
  if (!url) return;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error('[store-webhook]', res.status, text.slice(0, 200));
    }
  } catch (err) {
    console.error('[store-webhook]', err.message || err);
  }
}

function orderStatusLabel(status) {
  if (status === 'completed') return '✅ Voltooid';
  if (status === 'failed') return '❌ Mislukt';
  if (status === 'pending') return '⏳ In behandeling';
  return status || '—';
}

function productTypeLabel(type) {
  const map = {
    item: 'Item',
    vehicle: 'Voertuig',
    discord_role: 'Discord rol',
    external_link: 'Externe link',
  };
  return map[type] || type || 'Product';
}

function logStorePurchase({ source, user, orders, total, newBalance }) {
  const list = Array.isArray(orders) ? orders : orders ? [orders] : [];
  if (!list.length) return;

  const url = WEBHOOK_PURCHASES();
  if (!url) return;

  const name = playerName(user, list[0]);
  const discordId = user?.discordId || list[0]?.discordId || '—';
  const productLines = list.map((o) => {
    const type = productTypeLabel(o.productType);
    return `• **${o.productName || o.productId}** (${type}) — ${formatCoins(o.price)} · ${orderStatusLabel(o.status)}`;
  });

  const embed = {
    title: list.length === 1 ? '🛒 Nieuwe store-aankoop' : '🛒 Nieuwe winkelwagen-aankoop',
    color: 0x3b82f6,
    fields: [
      { name: 'Speler', value: truncate(name), inline: true },
      { name: 'Discord ID', value: truncate(discordId), inline: true },
      { name: 'Bron', value: truncate(source || 'Website'), inline: true },
      {
        name: list.length === 1 ? 'Product' : 'Producten (' + list.length + ')',
        value: truncate(productLines.join('\n')),
        inline: false,
      },
      { name: 'Totaal', value: formatCoins(total ?? list.reduce((s, o) => s + (Number(o.price) || 0), 0)), inline: true },
      { name: 'Saldo na aankoop', value: formatCoins(newBalance), inline: true },
      {
        name: 'Order ID',
        value: truncate(list.map((o) => '`' + o.id + '`').join('\n')),
        inline: false,
      },
    ],
    timestamp: new Date().toISOString(),
    footer: { text: 'URP Store · Aankopen' },
  };

  void postWebhook(url, {
    username: 'URP Store',
    embeds: [embed],
  });
}

function logStoreAdmin({ title, description, admin, fields = [] }) {
  const url = WEBHOOK_ADMIN();
  if (!url) return;

  const embedFields = [
    { name: 'Beheerder', value: truncate(admin || 'Onbekend'), inline: true },
    ...fields.map((f) => ({
      name: f.name,
      value: truncate(f.value),
      inline: f.inline !== false,
    })),
  ];

  void postWebhook(url, {
    username: 'URP Store Admin',
    embeds: [
      {
        title: title || '⚙️ Admin actie',
        description: description ? truncate(description, 2048) : undefined,
        color: 0xf59e0b,
        fields: embedFields,
        timestamp: new Date().toISOString(),
        footer: { text: 'URP Store · Beheer' },
      },
    ],
  });
}

function logStoreAdminAction(admin, action, body, result) {
  if (!action) return;

  const adminName = admin?.username || admin?.discordId || 'Beheerder';
  const base = { admin: adminName };

  switch (action) {
    case 'category-save':
      return logStoreAdmin({
        ...base,
        title: '📁 Categorie opgeslagen',
        fields: [
          { name: 'Naam', value: result.category?.name || body.name || '—' },
          { name: 'ID', value: '`' + (result.category?.id || body.id || '—') + '`' },
        ],
      });
    case 'category-delete':
      return logStoreAdmin({
        ...base,
        title: '📁 Categorie verwijderd',
        fields: [{ name: 'ID', value: '`' + (body.id || '—') + '`', inline: false }],
      });
    case 'product-save':
      return logStoreAdmin({
        ...base,
        title: '📦 Product opgeslagen',
        fields: [
          { name: 'Naam', value: result.product?.name || body.name || '—' },
          { name: 'Type', value: productTypeLabel(result.product?.type || body.type) },
          { name: 'Prijs', value: formatCoins(result.product?.price ?? body.price) },
          { name: 'ID', value: '`' + (result.product?.id || body.id || '—') + '`' },
        ],
      });
    case 'product-delete':
      return logStoreAdmin({
        ...base,
        title: '📦 Product verwijderd',
        fields: [{ name: 'ID', value: '`' + (body.id || '—') + '`', inline: false }],
      });
    case 'coins-set':
    case 'user-save':
      return logStoreAdmin({
        ...base,
        title: '🪙 Speler coins bijgewerkt',
        fields: [
          { name: 'Speler', value: result.user?.username || body.username || '—' },
          { name: 'Discord ID', value: result.user?.discordId || body.discordId || body.userId || '—' },
          { name: 'Coins', value: formatCoins(result.user?.coins ?? body.coins) },
        ],
      });
    case 'coins-add':
      return logStoreAdmin({
        ...base,
        title: '🪙 Coins toegevoegd',
        fields: [
          { name: 'Speler', value: result.user?.username || '—' },
          { name: 'Discord ID', value: result.user?.discordId || body.discordId || body.userId || '—' },
          { name: 'Toegevoegd', value: formatCoins(body.amount) },
          { name: 'Nieuw saldo', value: formatCoins(result.user?.coins) },
        ],
      });
    case 'order-requeue':
      return logStoreAdmin({
        ...base,
        title: '🧾 Order opnieuw in wachtrij',
        fields: [
          { name: 'Order', value: '`' + (body.id || '—') + '`' },
          { name: 'Product', value: result.order?.productName || '—' },
        ],
      });
    case 'catalog-backup-save':
      return logStoreAdmin({
        ...base,
        title: '💾 Cloud backup opgeslagen',
        fields: [
          { name: 'Producten', value: String(result.counts?.products ?? '—'), inline: true },
          { name: 'Categorieën', value: String(result.counts?.categories ?? '—'), inline: true },
        ],
      });
    case 'catalog-restore':
      return logStoreAdmin({
        ...base,
        title: '⚠️ Catalogus hersteld uit cloud',
        description: 'Producten en categorieën zijn overschreven vanuit cloud-backup.',
        fields: [
          { name: 'Producten', value: String(result.counts?.products ?? '—'), inline: true },
          { name: 'Categorieën', value: String(result.counts?.categories ?? '—'), inline: true },
        ],
      });
    case 'catalog-import':
      return logStoreAdmin({
        ...base,
        title: '⚠️ Catalogus geïmporteerd',
        description: 'Producten en categorieën zijn overschreven vanuit geüpload bestand.',
        fields: [
          { name: 'Producten', value: String(result.counts?.products ?? '—'), inline: true },
          { name: 'Categorieën', value: String(result.counts?.categories ?? '—'), inline: true },
        ],
      });
    default:
      return logStoreAdmin({
        ...base,
        title: '⚙️ Admin actie',
        fields: [{ name: 'Actie', value: '`' + action + '`', inline: false }],
      });
  }
}

function logStoreAdminLogin({ username, method }) {
  logStoreAdmin({
    admin: username,
    title: '🔐 Admin ingelogd',
    fields: [{ name: 'Methode', value: method === 'discord' ? 'Discord' : 'Wachtwoord', inline: true }],
  });
}

function logStoreMaintenance({ admin, global, message }) {
  logStoreAdmin({
    admin,
    title: global ? '🔴 Store onderhoud ingeschakeld' : '🟢 Store onderhoud uitgeschakeld',
    fields: [
      { name: 'Status', value: global ? 'Onderhoud aan' : 'Store open', inline: true },
      { name: 'Bericht', value: message || '—', inline: false },
    ],
  });
}

module.exports = {
  logStorePurchase,
  logStoreAdmin,
  logStoreAdminAction,
  logStoreAdminLogin,
  logStoreMaintenance,
};
