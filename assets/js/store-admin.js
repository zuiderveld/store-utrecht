(function () {
  const toast = document.getElementById('toast');
  const adminGate = document.getElementById('adminGate');
  const adminApp = document.getElementById('adminApp');
  const adminSession = document.getElementById('adminSession');
  const btnLogout = document.getElementById('btnLogout');
  const adminLoginForm = document.getElementById('adminLoginForm');
  const productFormTitle = document.getElementById('productFormTitle');

  let snapshot = { categories: [], products: [], users: [], orders: [], camoAssets: { weapons: {}, camos: {} } };
  let selectedUserId = null;
  let userSearchQuery = '';
  let pendingProdImageFile = null;
  let clearProductImageFlag = false;

  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(function () {
      toast.classList.remove('show');
    }, 4000);
  }

  function esc(s) {
    const d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function emptyRow(cols, text) {
    return '<tr><td colspan="' + cols + '" class="admin-empty">' + esc(text) + '</td></tr>';
  }

  async function adminApi(body) {
    return adminApiRequest('/api/store-admin', { method: 'POST', body: body });
  }

  async function loadSnapshot() {
    snapshot = await adminApiRequest('/api/store-admin?action=snapshot');
    renderAll();
  }

  function showGate(show) {
    adminGate.classList.toggle('hidden', !show);
    adminApp.classList.toggle('hidden', show);
    var loggedIn = isAdminLoggedIn();
    btnLogout.classList.toggle('hidden', !loggedIn || show);
    adminSession.classList.toggle('hidden', !loggedIn || show);
  }

  function setGateHint(text, asHtml) {
    var gateHint = document.getElementById('adminGateHint');
    if (!gateHint) return;
    if (!text) {
      gateHint.classList.add('hidden');
      gateHint.textContent = '';
      return;
    }
    gateHint.classList.remove('hidden');
    if (asHtml) gateHint.innerHTML = text;
    else gateHint.textContent = text;
  }

  function updateAdminHeader() {
    if (!isAdminLoggedIn()) return;
    document.getElementById('adminUserName').textContent = adminUserName();
    const avatar = sessionStorage.getItem('urpAdminAvatarUrl');
    const img = document.getElementById('adminAvatar');
    if (avatar) {
      img.src = avatar;
      img.style.display = 'block';
    } else {
      img.style.display = 'none';
    }
  }

  function openAdminApp() {
    setGateHint('');
    showGate(false);
    updateAdminHeader();
  }

  async function bootstrapAdminData() {
    try {
      await loadSnapshot();
      await loadMaintenance();
      await loadBackupStatus();
      syncProductTypeFields();
    } catch (err) {
      showToast(err.message || 'Admin data laden mislukt');
    }
  }

  document.addEventListener('urp-admin-logged-in', function () {
    openAdminApp();
    bootstrapAdminData().then(function () {
      showToast('Ingelogd via Discord');
    });
  });

  document.addEventListener('urp-admin-login-failed', function (e) {
    showGate(true);
    if (e.detail && e.detail.error) showToast(e.detail.error);
  });

  async function requireAdminPage() {
    if (!(await verifyAdminSession())) {
      showGate(true);
      setGateHint('Log in met je beheer-gebruikersnaam en wachtwoord.');
      return false;
    }
    openAdminApp();
    return true;
  }

  function readFileAsBase64(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        var result = String(reader.result || '');
        var comma = result.indexOf(',');
        resolve(comma >= 0 ? result.slice(comma + 1) : result);
      };
      reader.onerror = function () {
        reject(new Error('Bestand lezen mislukt: ' + file.name));
      };
      reader.readAsDataURL(file);
    });
  }

  function productImagePreviewSrc(imageUrl, productId) {
    if (imageUrl) {
      if (imageUrl.indexOf('/api/store-asset') === 0) {
        return imageUrl + (imageUrl.indexOf('?') >= 0 ? '&' : '?') + 'preview=1';
      }
      return imageUrl;
    }
    if (productId) {
      return '/api/store-asset?type=product&id=' + encodeURIComponent(productId) + '&preview=1';
    }
    return '';
  }

  function updateProdImagePreview(imageUrl, productId) {
    var wrap = document.getElementById('prodImagePreviewWrap');
    var img = document.getElementById('prodImagePreview');
    var label = document.getElementById('prodImageDropLabel');
    var zone = document.getElementById('prodImageDropZone');
    var hidden = document.getElementById('prodImage');
    var src = productImagePreviewSrc(imageUrl, productId);

    if (hidden) hidden.value = imageUrl || '';

    if (img && wrap) {
      if (src && !clearProductImageFlag) {
        img.src = src;
        wrap.hidden = false;
        if (zone) zone.classList.add('has-file');
        if (label) label.textContent = 'Andere afbeelding kiezen? Sleep of klik hier';
      } else {
        img.removeAttribute('src');
        wrap.hidden = true;
        if (zone) zone.classList.remove('has-file');
        if (label) label.textContent = 'Klik of sleep afbeelding van je PC';
      }
    }
  }

  function resetProductImageField() {
    pendingProdImageFile = null;
    clearProductImageFlag = false;
    var input = document.getElementById('prodImageFile');
    if (input) input.value = '';
    updateProdImagePreview('', null);
  }

  function resetCategoryForm() {
    document.getElementById('catId').value = '';
    document.getElementById('catName').value = '';
    document.getElementById('catSort').value = '0';
  }

  function resetProductForm() {
    document.getElementById('prodId').value = '';
    document.getElementById('prodName').value = '';
    document.getElementById('prodDesc').value = '';
    document.getElementById('prodPrice').value = '';
    document.getElementById('prodOriginalPrice').value = '';
    resetProductImageField();
    document.getElementById('prodModel').value = '';
    document.getElementById('prodOxItem').value = '';
    document.getElementById('prodItemCount').value = '';
    document.getElementById('prodDiscordRoleId').value = '';
    document.getElementById('prodDiscordRoleName').value = '';
    document.getElementById('prodGarage').value = '';
    document.getElementById('prodTopspeed').value = '';
    document.getElementById('prodTrunk').value = '';
    document.getElementById('prodLocation').value = '';
    document.getElementById('prodExternalUrl').value = '';
    document.getElementById('prodExternalLabel').value = 'Naar Discord';
    document.getElementById('prodPriceUnit').value = '€';
    document.getElementById('prodCamoWeapon').value = '';
    document.getElementById('prodCamoWeaponLabel').value = '';
    document.getElementById('prodCamoWeaponGroup').value = '';
    document.getElementById('prodCamoId').value = '';
    document.getElementById('prodCamoTint').value = '';
    document.getElementById('prodCamoOxItem').value = 'weapon_camo';
    document.getElementById('prodActive').checked = true;
    document.getElementById('prodType').value = 'vehicle';
    if (snapshot.categories.length) {
      document.getElementById('prodCat').value = snapshot.categories[0].id;
    }
    productFormTitle.textContent = 'Nieuw product';
    syncProductTypeFields();
  }

  function resetUserForm() {
    selectedUserId = null;
    document.getElementById('coinUserId').value = '';
    document.getElementById('coinUsername').value = '';
    document.getElementById('coinEmail').value = '';
    document.getElementById('coinDiscordId').value = '';
    document.getElementById('coinInternalId').value = '';
    document.getElementById('coinAmount').value = '';
    document.getElementById('userFormTitle').textContent = 'Speler bewerken';
    document.getElementById('userSelectedHint').classList.add('hidden');
    document.getElementById('userSelectedHint').textContent = '';
  }

  function userMatchesSearch(u, q) {
    if (!q) return true;
    const hay = [
      u.username,
      u.email,
      u.userId,
      u.discordId,
      u.license,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return hay.indexOf(q) >= 0;
  }

  function loadUserIntoForm(u) {
    selectedUserId = u.userId;
    document.getElementById('coinUserId').value = u.userId || '';
    document.getElementById('coinUsername').value = u.username || '';
    document.getElementById('coinEmail').value = u.email || '';
    document.getElementById('coinDiscordId').value = u.discordId || '';
    document.getElementById('coinInternalId').value = u.userId || '';
    document.getElementById('coinAmount').value = u.coins || 0;
    document.getElementById('userFormTitle').textContent = 'Speler bewerken';
    const hint = document.getElementById('userSelectedHint');
    hint.classList.remove('hidden');
    hint.innerHTML =
      'Geselecteerd: <strong>' +
      esc(u.username || u.userId) +
      '</strong> · ' +
      (u.coins || 0) +
      ' 🪙 · FiveM ' +
      (u.linked ? '✓' : '✗') +
      ' · Discord ' +
      (u.discordLinked ? '✓' : '✗');
    document.querySelector('.admin-tabs button[data-tab="coins"]').click();
    document.getElementById('formCoins').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function statusBadge(status) {
    const s = (status || 'pending').toLowerCase();
    const cls = s === 'done' ? 'done' : s === 'failed' ? 'failed' : 'pending';
    return '<span class="admin-status ' + cls + '">' + esc(status || 'pending') + '</span>';
  }

  function formatOrderTime(ts) {
    if (!ts) return '';
    return new Date(ts).toLocaleString('nl-NL', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function formatDisplayPrice(price, originalPrice, unit) {
    unit = unit == null || unit === '' ? '€' : String(unit);
    price = Number(price) || 0;
    originalPrice = Number(originalPrice) || 0;
    if (price <= 0 && originalPrice <= 0) return '';
    var main = price > 0 ? price : originalPrice;
    var suffix = unit === '€' ? ' €' : unit ? ' ' + unit : '';
    var text = main + suffix;
    if (originalPrice > 0 && price > 0 && originalPrice > price) {
      text += ' (was ' + originalPrice + suffix.trim() + ')';
    }
    return text;
  }

  function formatAdminProductPrice(p) {
    if (p.type !== 'external_link') return p.price + ' 🪙';
    var unit = (p.meta && p.meta.priceUnit) || '€';
    return formatDisplayPrice(p.price, p.originalPrice, unit) || 'Link';
  }

  function syncProductTypeFields() {
    const type = document.getElementById('prodType').value;
    const vehicleFields = document.getElementById('prodVehicleFields');
    const itemFields = document.getElementById('prodItemFields');
    const discordRoleFields = document.getElementById('prodDiscordRoleFields');
    const sectionVehicle = document.getElementById('prodSectionVehicle');
    const sectionItem = document.getElementById('prodSectionItem');
    const sectionDiscordRole = document.getElementById('prodSectionDiscordRole');
    const sectionExternal = document.getElementById('prodSectionExternal');
    const externalFields = document.getElementById('prodExternalFields');
    const sectionCamo = document.getElementById('prodSectionCamo');
    const camoFields = document.getElementById('prodCamoFields');
    const showVehicle = type === 'vehicle';
    const showItem = type === 'item';
    const showDiscordRole = type === 'discord_role';
    const showExternal = type === 'external_link';
    const showCamo = type === 'weapon_camo';

    vehicleFields.classList.toggle('hidden', !showVehicle);
    sectionVehicle.classList.toggle('hidden', !showVehicle);
    itemFields.classList.toggle('hidden', !showItem);
    sectionItem.classList.toggle('hidden', !showItem);
    discordRoleFields.classList.toggle('hidden', !showDiscordRole);
    sectionDiscordRole.classList.toggle('hidden', !showDiscordRole);
    externalFields.classList.toggle('hidden', !showExternal);
    sectionExternal.classList.toggle('hidden', !showExternal);
    camoFields.classList.toggle('hidden', !showCamo);
    sectionCamo.classList.toggle('hidden', !showCamo);
    document.getElementById('prodOxItem').required = showItem;
    document.getElementById('prodModel').required = showVehicle;
    document.getElementById('prodDiscordRoleId').required = showDiscordRole;
    document.getElementById('prodExternalUrl').required = showExternal;
    document.getElementById('prodCamoWeapon').required = showCamo;
    document.getElementById('prodCamoId').required = showCamo;
    document.getElementById('prodPriceLabel').textContent = showExternal
      ? 'Weergaveprijs (geen coins)'
      : 'Prijs (coins)';
    document.getElementById('prodOriginalPriceLabel').textContent = showExternal
      ? 'Oude prijs (doorgestreept)'
      : 'Oude prijs';
    document.getElementById('prodPrice').required = !showExternal;
    document.getElementById('prodPrice').disabled = false;
    document.getElementById('prodOriginalPriceWrap').classList.remove('hidden');
  }

  document.getElementById('prodType').addEventListener('change', syncProductTypeFields);

  function renderStats() {
    document.getElementById('statCategories').textContent = snapshot.categories.length;
    document.getElementById('statProducts').textContent = snapshot.products.length;
    document.getElementById('statUsers').textContent = snapshot.users.length;
    document.getElementById('statOrders').textContent = snapshot.orders.length;
  }

  document.querySelectorAll('.admin-tabs button').forEach(function (btn) {
    btn.onclick = function () {
      document.querySelectorAll('.admin-tabs button').forEach(function (b) {
        b.classList.remove('active');
      });
      document.querySelectorAll('.admin-panel').forEach(function (p) {
        p.classList.remove('active');
      });
      btn.classList.add('active');
      document.getElementById('panel-' + btn.dataset.tab).classList.add('active');
      if (btn.dataset.tab === 'backup') {
        renderBackupLiveStats();
        loadBackupStatus();
      }
      if (btn.dataset.tab === 'camoassets') {
        renderCamoWeaponAssets();
      }
    };
  });

  function renderAll() {
    renderStats();
    renderBackupLiveStats();
    renderCamoWeaponAssets();

    const catTable = document.getElementById('catTable');
    catTable.innerHTML = snapshot.categories.length
      ? snapshot.categories
          .map(function (c) {
            return (
              '<tr><td class="mono">' +
              esc(c.id) +
              '</td><td><strong>' +
              esc(c.name) +
              '</strong></td><td>' +
              (c.sort || 0) +
              '</td><td><div class="admin-table-actions">' +
              '<button type="button" class="btn-sm btn-sm-edit" data-edit-cat="' +
              esc(c.id) +
              '">Bewerk</button>' +
              '<button type="button" class="btn-sm btn-sm-del" data-del-cat="' +
              esc(c.id) +
              '">Verwijder</button></div></td></tr>'
            );
          })
          .join('')
      : emptyRow(4, 'Nog geen categorieën');

    const prodCat = document.getElementById('prodCat');
    prodCat.innerHTML = snapshot.categories
      .map(function (c) {
        return '<option value="' + esc(c.id) + '">' + esc(c.name) + '</option>';
      })
      .join('');

    document.getElementById('prodTable').innerHTML = snapshot.products.length
      ? snapshot.products
          .map(function (p) {
            return (
              '<tr><td><strong>' +
              esc(p.name) +
              '</strong>' +
              (p.active === false ? ' <span class="admin-status failed">inactief</span>' : '') +
              (p.type === 'item' && !(p.meta && p.meta.item)
                ? ' <span class="admin-status failed">geen ox item</span>'
                : '') +
              (p.type === 'vehicle' && !(p.meta && p.meta.model)
                ? ' <span class="admin-status failed">geen model</span>'
                : '') +
              (p.type === 'discord_role' && !(p.meta && p.meta.discordRoleId)
                ? ' <span class="admin-status failed">geen rol-ID</span>'
                : '') +
              (p.type === 'external_link' && !(p.meta && p.meta.externalUrl)
                ? ' <span class="admin-status failed">geen link</span>'
                : '') +
              '</td><td>' +
              (p.type === 'external_link' ? formatAdminProductPrice(p) : p.price + ' 🪙') +
              '</td><td>' +
              esc(p.type) +
              '</td><td><div class="admin-table-actions">' +
              '<button type="button" class="btn-sm btn-sm-edit" data-edit-prod="' +
              esc(p.id) +
              '">Bewerk</button>' +
              '<button type="button" class="btn-sm btn-sm-del" data-del-prod="' +
              esc(p.id) +
              '">Verwijder</button></div></td></tr>'
            );
          })
          .join('')
      : emptyRow(4, 'Nog geen producten');

    const filteredUsers = snapshot.users.filter(function (u) {
      return userMatchesSearch(u, userSearchQuery);
    });

    document.getElementById('userTable').innerHTML = filteredUsers.length
      ? filteredUsers
          .map(function (u) {
            const sub =
              (u.email ? esc(u.email) + '<br>' : '') +
              '<span class="mono">' +
              esc(u.userId || u.discordId || '—') +
              '</span>';
            const rowCls = selectedUserId && u.userId === selectedUserId ? ' class="admin-row-selected"' : '';
            return (
              '<tr' +
              rowCls +
              '><td><strong>' +
              esc(u.username || u.discordId || u.userId) +
              '</strong><br><span class="admin-user-sub">' +
              sub +
              '</span></td><td><strong>' +
              (u.coins || 0) +
              '</strong> 🪙</td><td>' +
              (u.license ? '<span class="admin-status done">✓</span>' : '<span class="admin-status pending">✗</span>') +
              '</td><td>' +
              (u.discordLinked ? '<span class="admin-status done">✓</span>' : '<span class="admin-status pending">✗</span>') +
              '</td><td><div class="admin-table-actions">' +
              '<button type="button" class="btn-sm btn-sm-edit" data-edit-user="' +
              esc(u.userId) +
              '">Bewerk</button></div></td></tr>'
            );
          })
          .join('')
      : emptyRow(5, userSearchQuery ? 'Geen spelers gevonden' : 'Nog geen spelers');

    document.getElementById('orderTable').innerHTML = snapshot.orders.length
      ? snapshot.orders
          .map(function (o) {
            const buyer =
              o.username ||
              (o.email ? o.email : null) ||
              (o.license ? o.license.replace('license:', '').slice(0, 10) + '…' : 'Onbekend');
            const buyerSub = [
              o.email && o.username ? o.email : null,
              o.license ? o.license.replace('license:', '').slice(0, 14) + '…' : null,
            ]
              .filter(Boolean)
              .join(' · ');
            return (
              '<tr><td class="mono">' +
              esc(o.id) +
              (o.createdAt ? '<br><span class="admin-order-time">' + esc(formatOrderTime(o.createdAt)) + '</span>' : '') +
              '</td><td><strong>' +
              esc(buyer) +
              '</strong>' +
              (buyerSub ? '<br><span class="admin-user-sub">' + esc(buyerSub) + '</span>' : '') +
              '</td><td class="mono">' +
              (o.discordId
                ? esc(o.discordId)
                : '<span class="admin-status pending">—</span>') +
              '</td><td>' +
              esc(o.productName) +
              (o.price ? '<br><span class="admin-user-sub">' + o.price + ' 🪙</span>' : '') +
              (o.note ? '<br><span class="admin-user-sub">' + esc(o.note) + '</span>' : '') +
              '</td><td>' +
              statusBadge(o.status) +
              (o.refunded ? ' <span class="admin-status pending">refund</span>' : '') +
              '</td><td>' +
              (o.status === 'failed'
                ? '<button type="button" class="btn-sm btn-sm-edit" data-requeue-order="' +
                  esc(o.id) +
                  '">Opnieuw</button>'
                : '—') +
              '</td></tr>'
            );
          })
          .join('')
      : emptyRow(6, 'Nog geen orders');
  }

  document.getElementById('formCategory').onsubmit = async function (e) {
    e.preventDefault();
    try {
      await adminApi({
        action: 'category-save',
        id: document.getElementById('catId').value || undefined,
        name: document.getElementById('catName').value,
        sort: document.getElementById('catSort').value,
      });
      showToast('Categorie opgeslagen');
      resetCategoryForm();
      await loadSnapshot();
    } catch (err) {
      showToast(err.message);
    }
  };

  function normalizeOxItemName(name) {
    var s = String(name || '').trim();
    if (!s) return '';
    if (s.toLowerCase().indexOf('weapon_') === 0) return s.toUpperCase();
    return s.toLowerCase();
  }

  function pickProductImageFile(file) {
    if (!file) return;
    if (!/^image\//i.test(file.type) && !/\.(png|jpe?g|webp|gif)$/i.test(file.name)) {
      showToast('Kies een afbeelding (PNG, JPG, WEBP of GIF)');
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      showToast('Max 4 MB per afbeelding');
      return;
    }
    pendingProdImageFile = file;
    clearProductImageFlag = false;
    var img = document.getElementById('prodImagePreview');
    var wrap = document.getElementById('prodImagePreviewWrap');
    var label = document.getElementById('prodImageDropLabel');
    var zone = document.getElementById('prodImageDropZone');
    if (img && wrap) {
      img.src = URL.createObjectURL(file);
      wrap.hidden = false;
    }
    if (zone) zone.classList.add('has-file');
    if (label) label.textContent = file.name + ' — klaar om op te slaan';
  }

  var prodImageFile = document.getElementById('prodImageFile');
  var prodImageDropZone = document.getElementById('prodImageDropZone');
  var btnClearProdImage = document.getElementById('btnClearProdImage');

  if (prodImageFile) {
    prodImageFile.addEventListener('change', function () {
      pickProductImageFile(prodImageFile.files && prodImageFile.files[0]);
    });
  }

  if (prodImageDropZone) {
    prodImageDropZone.addEventListener('dragover', function (e) {
      e.preventDefault();
      prodImageDropZone.classList.add('dragover');
    });
    prodImageDropZone.addEventListener('dragleave', function () {
      prodImageDropZone.classList.remove('dragover');
    });
    prodImageDropZone.addEventListener('drop', function (e) {
      e.preventDefault();
      prodImageDropZone.classList.remove('dragover');
      pickProductImageFile(e.dataTransfer.files && e.dataTransfer.files[0]);
    });
  }

  if (btnClearProdImage) {
    btnClearProdImage.onclick = function () {
      pendingProdImageFile = null;
      clearProductImageFlag = true;
      if (prodImageFile) prodImageFile.value = '';
      updateProdImagePreview('', null);
    };
  }

  document.getElementById('formProduct').onsubmit = async function (e) {
    e.preventDefault();
    try {
      var payload = {
        action: 'product-save',
        id: document.getElementById('prodId').value || undefined,
        categoryId: document.getElementById('prodCat').value,
        name: document.getElementById('prodName').value,
        description: document.getElementById('prodDesc').value,
        price: document.getElementById('prodPrice').value,
        originalPrice: document.getElementById('prodOriginalPrice').value || null,
        type: document.getElementById('prodType').value,
        active: document.getElementById('prodActive').checked,
        meta: {
          model: document.getElementById('prodModel').value.trim(),
          garage: document.getElementById('prodGarage').value.trim() || '2',
          topspeed: document.getElementById('prodTopspeed').value.trim(),
          trunk: document.getElementById('prodTrunk').value.trim(),
          location: document.getElementById('prodLocation').value.trim(),
          item: normalizeOxItemName(document.getElementById('prodOxItem').value),
          count: document.getElementById('prodItemCount').value.trim() || '1',
          discordRoleId: document.getElementById('prodDiscordRoleId').value.trim(),
          roleName: document.getElementById('prodDiscordRoleName').value.trim(),
          externalUrl: document.getElementById('prodExternalUrl').value.trim(),
          buttonLabel: document.getElementById('prodExternalLabel').value.trim() || 'Naar Discord',
          priceUnit: document.getElementById('prodPriceUnit').value.trim(),
          weapon: document.getElementById('prodCamoWeapon').value.trim().toUpperCase(),
          weaponLabel: document.getElementById('prodCamoWeaponLabel').value.trim(),
          weaponGroup: document.getElementById('prodCamoWeaponGroup').value.trim().toUpperCase(),
          camoId: document.getElementById('prodCamoId').value.trim().toLowerCase(),
          tint: document.getElementById('prodCamoTint').value.trim(),
          oxItem: document.getElementById('prodCamoOxItem').value.trim().toLowerCase() || 'weapon_camo',
        },
      };

      if (pendingProdImageFile) {
        payload.imageBase64 = await readFileAsBase64(pendingProdImageFile);
        payload.imageFileName = pendingProdImageFile.name;
      } else if (clearProductImageFlag) {
        payload.clearImage = true;
      }

      await adminApi(payload);
      showToast('Product opgeslagen');
      resetProductForm();
      await loadSnapshot();
    } catch (err) {
      showToast(err.message);
    }
  };

  document.getElementById('formCoins').onsubmit = async function (e) {
    e.preventDefault();
    const userId = document.getElementById('coinUserId').value.trim();
    const discordId = document.getElementById('coinDiscordId').value.trim();
    const coins = document.getElementById('coinAmount').value;
    const username = document.getElementById('coinUsername').value.trim();

    if (!userId && !discordId) {
      return showToast('Selecteer een speler of vul Discord ID in');
    }

    try {
      await adminApi({
        action: 'user-save',
        userId: userId || undefined,
        discordId: discordId || undefined,
        coins: coins,
        username: username || undefined,
      });
      showToast('Speler opgeslagen');
      await loadSnapshot();
      const reloadId = userId || discordId;
      if (reloadId) {
        const updated = snapshot.users.find(function (u) {
          return u.userId === reloadId || u.discordId === reloadId;
        });
        if (updated) loadUserIntoForm(updated);
      }
    } catch (err) {
      showToast(err.message);
    }
  };

  document.getElementById('btnResetUser').onclick = resetUserForm;

  document.getElementById('userSearch').oninput = function (e) {
    userSearchQuery = String(e.target.value || '')
      .trim()
      .toLowerCase();
    renderAll();
  };

  document.body.addEventListener('click', async function (e) {
    const addCoins = e.target.dataset.addCoins;
    if (addCoins) {
      const userId = document.getElementById('coinUserId').value.trim();
      const discordId = document.getElementById('coinDiscordId').value.trim();
      if (!userId && !discordId) return showToast('Selecteer eerst een speler');
      try {
        await adminApi({
          action: 'coins-add',
          userId: userId || undefined,
          discordId: discordId || undefined,
          amount: Number(addCoins) || 0,
        });
        showToast('+' + addCoins + ' coins');
        await loadSnapshot();
        const id = userId || discordId;
        const updated = snapshot.users.find(function (u) {
          return u.userId === id || u.discordId === id;
        });
        if (updated) loadUserIntoForm(updated);
      } catch (err) {
        showToast(err.message);
      }
    }
  });

  document.getElementById('btnResetCat').onclick = resetCategoryForm;
  document.getElementById('btnResetProd').onclick = resetProductForm;
  document.getElementById('btnRefresh').onclick = function () {
    loadSnapshot().then(function () {
      showToast('Data vernieuwd');
    });
  };

  document.body.addEventListener('click', async function (e) {
    const editCat = e.target.dataset.editCat;
    const delCat = e.target.dataset.delCat;
    const editProd = e.target.dataset.editProd;
    const delProd = e.target.dataset.delProd;
    const editUser = e.target.dataset.editUser;
    const requeueOrder = e.target.dataset.requeueOrder;

    if (requeueOrder) {
      try {
        await adminApi({ action: 'order-requeue', id: requeueOrder });
        showToast('Order opnieuw in wachtrij — speler moet online zijn voor items');
        await loadSnapshot();
      } catch (err) {
        showToast(err.message);
      }
    }

    if (editUser) {
      const u = snapshot.users.find(function (x) {
        return x.userId === editUser;
      });
      if (u) {
        loadUserIntoForm(u);
        showToast('Speler geladen — pas coins aan en sla op');
      }
    }

    if (editCat) {
      const c = snapshot.categories.find(function (x) {
        return x.id === editCat;
      });
      document.getElementById('catId').value = c.id;
      document.getElementById('catName').value = c.name;
      document.getElementById('catSort').value = c.sort || 0;
      showToast('Categorie geladen — pas aan en sla op');
    }
    if (delCat && confirm('Categorie verwijderen?')) {
      try {
        await adminApi({ action: 'category-delete', id: delCat });
        await loadSnapshot();
        showToast('Categorie verwijderd');
      } catch (err) {
        showToast(err.message);
      }
    }
    if (editProd) {
      const p = snapshot.products.find(function (x) {
        return x.id === editProd;
      });
      document.getElementById('prodId').value = p.id;
      document.getElementById('prodName').value = p.name;
      document.getElementById('prodCat').value = p.categoryId;
      document.getElementById('prodType').value = p.type;
      document.getElementById('prodPrice').value = p.price;
      document.getElementById('prodOriginalPrice').value = p.originalPrice || '';
      pendingProdImageFile = null;
      clearProductImageFlag = false;
      var prodImageInput = document.getElementById('prodImageFile');
      if (prodImageInput) prodImageInput.value = '';
      updateProdImagePreview(p.image || '', p.id);
      document.getElementById('prodDesc').value = p.description || '';
      document.getElementById('prodModel').value = p.meta?.model || '';
      document.getElementById('prodOxItem').value = p.meta?.item || '';
      document.getElementById('prodItemCount').value = p.meta?.count || '';
      document.getElementById('prodDiscordRoleId').value = p.meta?.discordRoleId || p.meta?.roleId || '';
      document.getElementById('prodDiscordRoleName').value = p.meta?.roleName || '';
      document.getElementById('prodExternalUrl').value = p.meta?.externalUrl || p.meta?.url || '';
      document.getElementById('prodExternalLabel').value = p.meta?.buttonLabel || 'Naar Discord';
      document.getElementById('prodPriceUnit').value = p.meta?.priceUnit != null ? p.meta.priceUnit : '€';
      document.getElementById('prodCamoWeapon').value = p.meta?.weapon || '';
      document.getElementById('prodCamoWeaponLabel').value = p.meta?.weaponLabel || '';
      document.getElementById('prodCamoWeaponGroup').value = p.meta?.weaponGroup || '';
      document.getElementById('prodCamoId').value = p.meta?.camoId || '';
      document.getElementById('prodCamoTint').value = p.meta?.tint != null ? p.meta.tint : '';
      document.getElementById('prodCamoOxItem').value = p.meta?.oxItem || 'weapon_camo';
      document.getElementById('prodGarage').value = p.meta?.garage || '';
      document.getElementById('prodTopspeed').value = p.meta?.topspeed || '';
      document.getElementById('prodTrunk').value = p.meta?.trunk || '';
      document.getElementById('prodLocation').value = p.meta?.location || '';
      document.getElementById('prodActive').checked = p.active !== false;
      productFormTitle.textContent = 'Product bewerken';
      syncProductTypeFields();
      document.querySelector('.admin-tabs button[data-tab="products"]').click();
      showToast('Product geladen');
    }
    if (delProd && confirm('Product verwijderen?')) {
      try {
        await adminApi({ action: 'product-delete', id: delProd });
        await loadSnapshot();
        showToast('Product verwijderd');
      } catch (err) {
        showToast(err.message);
      }
    }
  });

  function applyMaintState(state) {
    state = state || {};
    var globalEl = document.getElementById('maintGlobal');
    var msgEl = document.getElementById('maintMessage');
    var status = document.getElementById('maintStatus');
    if (globalEl) globalEl.checked = !!state.global;
    if (msgEl) msgEl.value = state.message || '';
    if (!status) return;
    var parts = [];
    parts.push(
      state.global
        ? 'Store staat IN onderhoud voor bezoekers (aankopen geblokkeerd).'
        : 'Store is open voor bezoekers.'
    );
    if (state.updatedAt) {
      try {
        parts.push('Laatst opgeslagen: ' + new Date(state.updatedAt).toLocaleString('nl-NL'));
      } catch (e) {
        /* ignore */
      }
    }
    if (state._storage === 'blob') {
      parts.push('Opgeslagen in Vercel Blob.');
    } else if (state._storage === 'default' || state._storage === 'blob-empty') {
      parts.push('Zet BLOB_READ_WRITE_TOKEN in Vercel zodat onderhoud bewaard blijft.');
    }
    status.textContent = parts.join(' ');
  }

  async function loadMaintenance() {
    var res = await fetch(window.STORE_CONFIG.apiBase + '/api/maintenance', { cache: 'no-store' });
    var state = await res.json().catch(function () {
      return {};
    });
    applyMaintState(state);
  }

  if (formMaintenance) {
    formMaintenance.addEventListener('submit', async function (e) {
      e.preventDefault();
      try {
        var data = await adminApiRequest('/api/maintenance', {
          method: 'POST',
          body: {
            maintenance: {
              global: document.getElementById('maintGlobal').checked,
              message: document.getElementById('maintMessage').value,
            },
          },
        });
        applyMaintState(data.maintenance || {});
        showToast(
          data.maintenance && data.maintenance.global
            ? 'Store op onderhoud gezet'
            : 'Onderhoud uitgeschakeld — store is open'
        );
      } catch (err) {
        showToast(err.message || 'Opslaan mislukt');
      }
    });
  }

  function downloadCatalogJson() {
    var payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      categories: snapshot.categories || [],
      products: snapshot.products || [],
    };
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'urp-store-backup-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function renderBackupLiveStats() {
    var live = document.getElementById('backupStatLive');
    var liveSub = document.getElementById('backupStatLiveSub');
    if (!live) return;
    var cats = (snapshot.categories || []).length;
    var prods = (snapshot.products || []).length;
    live.textContent = prods + ' producten';
    if (liveSub) liveSub.textContent = cats + ' categorieën · live catalogus';
  }

  function applyBackupStatus(data) {
    var cloud = document.getElementById('backupStatCloud');
    var cloudSub = document.getElementById('backupStatCloudSub');
    var when = document.getElementById('backupStatWhen');
    var whenSub = document.getElementById('backupStatWhenSub');

    if (!data || !data.backup) {
      if (cloud) cloud.textContent = 'Geen backup';
      if (cloudSub) cloudSub.textContent = 'Nog niet opgeslagen in cloud';
      if (when) when.textContent = '—';
      if (whenSub) whenSub.textContent = 'Maak je eerste backup';
      return;
    }

    var b = data.backup;
    var catCount = (b.categories || []).length;
    var prodCount = (b.products || []).length;
    var whenStr = b.savedAt ? new Date(b.savedAt).toLocaleString('nl-NL') : 'Onbekend';

    if (cloud) cloud.textContent = prodCount + ' producten';
    if (cloudSub) cloudSub.textContent = catCount + ' categorieën in cloud';
    if (when) when.textContent = whenStr.split(',')[0] || whenStr;
    if (whenSub) whenSub.textContent = whenStr;
  }

  async function loadBackupStatus() {
    try {
      var data = await adminApiRequest('/api/store-admin?action=catalog-backup');
      applyBackupStatus(data);
    } catch (e) {
      applyBackupStatus(null);
    }
  }

  var pendingBackupFile = null;

  function setBackupFileLabel(name) {
    var label = document.getElementById('backupFileLabel');
    var zone = document.getElementById('backupDropZone');
    if (!label || !zone) return;
    if (name) {
      label.textContent = name;
      zone.classList.add('has-file');
    } else {
      label.textContent = 'Klik of sleep je backup-bestand';
      zone.classList.remove('has-file');
    }
  }

  var btnBackupDownload = document.getElementById('btnBackupDownload');
  if (btnBackupDownload) {
    btnBackupDownload.onclick = async function () {
      var label = btnBackupDownload.querySelector('strong');
      var prevText = label ? label.textContent : 'Backup downloaden';
      btnBackupDownload.disabled = true;
      if (label) label.textContent = 'Bezig…';
      try {
        await adminApi({ action: 'catalog-backup-save' });
        await loadSnapshot();
        downloadCatalogJson();
        showToast('Backup opgeslagen in cloud en gedownload');
        await loadBackupStatus();
      } catch (err) {
        showToast(err.message || 'Backup mislukt');
      } finally {
        btnBackupDownload.disabled = false;
        if (label) label.textContent = prevText;
      }
    };
  }

  var btnBackupCloudRestore = document.getElementById('btnBackupCloudRestore');
  if (btnBackupCloudRestore) {
    btnBackupCloudRestore.onclick = async function () {
      if (!confirm('Catalogus herstellen uit cloud-backup? Huidige producten/categorieën worden overschreven.')) {
        return;
      }
      try {
        var data = await adminApi({ action: 'catalog-restore' });
        showToast(
          'Hersteld: ' + data.counts.products + ' producten, ' + data.counts.categories + ' categorieën'
        );
        await loadSnapshot();
        await loadBackupStatus();
      } catch (err) {
        showToast(err.message);
      }
    };
  }

  var backupFileInput = document.getElementById('backupFileInput');
  var backupDropZone = document.getElementById('backupDropZone');
  if (backupFileInput) {
    backupFileInput.addEventListener('change', function () {
      var file = backupFileInput.files && backupFileInput.files[0];
      pendingBackupFile = file || null;
      setBackupFileLabel(file ? file.name : '');
    });
  }
  if (backupDropZone) {
    backupDropZone.addEventListener('dragover', function (e) {
      e.preventDefault();
      backupDropZone.classList.add('dragover');
    });
    backupDropZone.addEventListener('dragleave', function () {
      backupDropZone.classList.remove('dragover');
    });
    backupDropZone.addEventListener('drop', function (e) {
      e.preventDefault();
      backupDropZone.classList.remove('dragover');
      var file = e.dataTransfer.files && e.dataTransfer.files[0];
      if (!file) return;
      pendingBackupFile = file;
      setBackupFileLabel(file.name);
    });
  }

  var btnBackupFileRestore = document.getElementById('btnBackupFileRestore');
  if (btnBackupFileRestore && backupFileInput) {
    btnBackupFileRestore.onclick = async function () {
      var file = (backupFileInput.files && backupFileInput.files[0]) || pendingBackupFile;
      if (!file) return showToast('Kies eerst een .json bestand');
      if (!confirm('Catalogus herstellen uit dit bestand? Huidige producten/categorieën worden overschreven.')) {
        return;
      }
      btnBackupFileRestore.disabled = true;
      try {
        var text = await file.text();
        var parsed = JSON.parse(text);
        var categories = parsed.categories;
        var products = parsed.products;
        if (!Array.isArray(categories) || !Array.isArray(products)) {
          throw new Error('Bestand moet categories en products bevatten');
        }
        var data = await adminApi({ action: 'catalog-import', categories: categories, products: products });
        showToast(
          'Import gelukt: ' + data.counts.products + ' producten, ' + data.counts.categories + ' categorieën'
        );
        backupFileInput.value = '';
        pendingBackupFile = null;
        setBackupFileLabel('');
        await loadSnapshot();
        await loadBackupStatus();
      } catch (err) {
        showToast(err.message || 'Import mislukt');
      } finally {
        btnBackupFileRestore.disabled = false;
      }
    };
  }

  if (adminLoginForm) {
    adminLoginForm.onsubmit = async function (e) {
      e.preventDefault();
      var submitBtn = document.getElementById('btnLoginGate');
      if (submitBtn) submitBtn.disabled = true;
      setGateHint('Inloggen…');
      try {
        await adminLogin(
          document.getElementById('adminUser').value.trim(),
          document.getElementById('adminPass').value
        );
        document.getElementById('adminPass').value = '';
        openAdminApp();
        await bootstrapAdminData();
        showToast('Ingelogd als beheerder');
      } catch (err) {
        setGateHint(err.message || 'Inloggen mislukt');
        showToast(err.message || 'Inloggen mislukt');
      }
      if (submitBtn) submitBtn.disabled = false;
    };
  }

  bindAdminDiscordButton();

  btnLogout.onclick = function () {
    adminLogout();
  };

  var pendingCamoWeaponFiles = [];

  function getCamoCatalogWeapons() {
    return (window.URP_CAMO_CATALOG && window.URP_CAMO_CATALOG.weapons) || [];
  }

  function weaponAssetUploaded(weaponId) {
    return Boolean(
      snapshot.camoAssets &&
        snapshot.camoAssets.weapons &&
        snapshot.camoAssets.weapons[String(weaponId || '').toUpperCase()]
    );
  }

  function weaponAssetPreviewUrl(weaponId) {
    if (!weaponAssetUploaded(weaponId)) return '';
    var entry = snapshot.camoAssets.weapons[String(weaponId).toUpperCase()];
    return '/api/store-asset?type=weapon&id=' + encodeURIComponent(weaponId) + '&v=' + (entry.updatedAt || '');
  }

  function renderCamoWeaponAssets() {
    var table = document.getElementById('camoWeaponAssetTable');
    var uploadedEl = document.getElementById('camoWeaponStatUploaded');
    var uploadedSub = document.getElementById('camoWeaponStatUploadedSub');
    var missingEl = document.getElementById('camoWeaponStatMissing');
    var missingSub = document.getElementById('camoWeaponStatMissingSub');
    if (!table) return;

    var weapons = getCamoCatalogWeapons().slice().sort(function (a, b) {
      return a.label.localeCompare(b.label, 'nl');
    });
    var uploadedCount = 0;

    table.innerHTML = weapons.length
      ? weapons
          .map(function (w) {
            var ok = weaponAssetUploaded(w.weapon);
            if (ok) uploadedCount += 1;
            var preview = ok
              ? '<img src="' + esc(weaponAssetPreviewUrl(w.weapon)) + '" alt="" style="width:48px;height:32px;object-fit:contain;background:#111;border-radius:6px">'
              : '—';
            return (
              '<tr><td><strong>' +
              esc(w.label) +
              '</strong><br><span class="mono">' +
              esc(w.weapon) +
              '</span></td><td class="mono">' +
              esc(w.weapon + '.png') +
              '</td><td>' +
              (ok
                ? '<span class="admin-status done">Geüpload</span>'
                : '<span class="admin-status failed">Ontbreekt</span>') +
              ' ' +
              preview +
              '</td><td><div class="admin-table-actions">' +
              (ok
                ? '<button type="button" class="btn-sm btn-sm-del" data-del-camo-weapon="' +
                  esc(w.weapon) +
                  '">Verwijder</button>'
                : '') +
              '</div></td></tr>'
            );
          })
          .join('')
      : emptyRow(4, 'Geen wapens in camo-catalog.js');

    if (uploadedEl) uploadedEl.textContent = String(uploadedCount);
    if (uploadedSub) uploadedSub.textContent = 'van ' + weapons.length + ' wapens';
    if (missingEl) missingEl.textContent = String(Math.max(0, weapons.length - uploadedCount));
    if (missingSub) missingSub.textContent = 'upload via bestand hierboven';

    table.querySelectorAll('[data-del-camo-weapon]').forEach(function (btn) {
      btn.onclick = async function () {
        if (!confirm('PNG verwijderen voor ' + btn.dataset.delCamoWeapon + '?')) return;
        try {
          var data = await adminApi({ action: 'camo-weapon-delete', weapon: btn.dataset.delCamoWeapon });
          snapshot.camoAssets = data.camoAssets || snapshot.camoAssets;
          renderCamoWeaponAssets();
          showToast('PNG verwijderd');
        } catch (err) {
          showToast(err.message);
        }
      };
    });
  }

  function setCamoWeaponDropLabel(text) {
    var label = document.getElementById('camoWeaponDropLabel');
    var zone = document.getElementById('camoWeaponDropZone');
    if (!label || !zone) return;
    label.textContent = text || "Klik of sleep wapen PNG's van je PC";
    zone.classList.toggle('has-file', Boolean(text && text.indexOf('Klik') !== 0));
  }

  async function uploadCamoWeaponFiles(files) {
    var list = Array.from(files || []).filter(function (f) {
      return f && /\.png$/i.test(f.name);
    });
    if (!list.length) {
      showToast('Geen PNG-bestanden geselecteerd');
      return;
    }

    var status = document.getElementById('camoWeaponUploadStatus');
    var btn = document.getElementById('btnCamoWeaponUpload');
    if (status) status.textContent = 'Bezig met uploaden…';
    if (btn) btn.disabled = true;

    try {
      var payloadFiles = [];
      for (var i = 0; i < list.length; i++) {
        payloadFiles.push({
          name: list[i].name,
          imageBase64: await readFileAsBase64(list[i]),
        });
      }

      var data = await adminApi({ action: 'camo-weapons-bulk-upload', files: payloadFiles });
      snapshot.camoAssets = data.camoAssets || snapshot.camoAssets;
      renderCamoWeaponAssets();

      var msg = (data.uploaded || []).length + ' geüpload';
      if (data.skipped && data.skipped.length) msg += ', ' + data.skipped.length + ' overgeslagen';
      showToast(msg);
      if (status) status.textContent = msg;
      setCamoWeaponDropLabel('');
      pendingCamoWeaponFiles = [];
      var input = document.getElementById('camoWeaponFileInput');
      if (input) input.value = '';
    } catch (err) {
      showToast(err.message || 'Upload mislukt');
      if (status) status.textContent = '';
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  var camoWeaponFileInput = document.getElementById('camoWeaponFileInput');
  var camoWeaponDropZone = document.getElementById('camoWeaponDropZone');
  var btnCamoWeaponUpload = document.getElementById('btnCamoWeaponUpload');

  if (camoWeaponFileInput) {
    camoWeaponFileInput.addEventListener('change', function () {
      pendingCamoWeaponFiles = Array.from(camoWeaponFileInput.files || []);
      setCamoWeaponDropLabel(
        pendingCamoWeaponFiles.length
          ? pendingCamoWeaponFiles.length + ' bestand(en) geselecteerd'
          : ''
      );
    });
  }

  if (camoWeaponDropZone) {
    camoWeaponDropZone.addEventListener('dragover', function (e) {
      e.preventDefault();
      camoWeaponDropZone.classList.add('dragover');
    });
    camoWeaponDropZone.addEventListener('dragleave', function () {
      camoWeaponDropZone.classList.remove('dragover');
    });
    camoWeaponDropZone.addEventListener('drop', function (e) {
      e.preventDefault();
      camoWeaponDropZone.classList.remove('dragover');
      pendingCamoWeaponFiles = Array.from(e.dataTransfer.files || []).filter(function (f) {
        return /\.png$/i.test(f.name);
      });
      setCamoWeaponDropLabel(
        pendingCamoWeaponFiles.length
          ? pendingCamoWeaponFiles.length + ' bestand(en) klaar om te uploaden'
          : 'Geen PNG-bestanden gevonden'
      );
    });
  }

  if (btnCamoWeaponUpload) {
    btnCamoWeaponUpload.onclick = function () {
      var files =
        pendingCamoWeaponFiles.length > 0
          ? pendingCamoWeaponFiles
          : camoWeaponFileInput && camoWeaponFileInput.files
            ? Array.from(camoWeaponFileInput.files)
            : [];
      uploadCamoWeaponFiles(files);
    };
  }

  (async function init() {
    if (window.__urpAdminOAuthBusy) {
      var waitAttempts = 0;
      while (window.__urpAdminOAuthBusy && waitAttempts < 50) {
        await new Promise(function (r) {
          setTimeout(r, 100);
        });
        waitAttempts += 1;
      }
    }

    if (isAdminLoggedIn() && (await verifyAdminSession())) {
      openAdminApp();
      await bootstrapAdminData();
      return;
    }

    try {
      var health = await fetch(window.STORE_CONFIG.apiBase + '/api/health');
      if (!health.ok) throw new Error('API offline');
    } catch (e) {
      setGateHint(
        'Store API werkt niet — deploy op Vercel moet de map server/ bevatten (niet alleen HTML).'
      );
      showGate(true);
      showToast('Backend API niet bereikbaar');
      return;
    }

    try {
      var cfg = await adminApiRequest('/api/store-admin-auth', {
        method: 'POST',
        body: { action: 'config' },
      });
      if (!cfg.passwordConfigured) {
        setGateHint(
          'Geen wachtwoord-accounts — je kunt nog wel inloggen met Discord (rol Store Beheer). ' +
            'Optioneel: STORE_ADMIN_USERS in Vercel.'
        );
      } else if (cfg.multiUser) {
        setGateHint('Meerdere beheerders: log in met Discord of jouw eigen gebruikersnaam + wachtwoord.');
      }
    } catch (e) {
      /* config optioneel */
    }

    try {
      var blobCheck = await fetch(window.STORE_CONFIG.apiBase + '/api/health?blob=1', { cache: 'no-store' });
      var blobInfo = await blobCheck.json().catch(function () {
        return {};
      });
      if (blobInfo.blob && blobInfo.blob.tokenConfigured && blobInfo.blob.exists && !blobInfo.blob.readable) {
        setGateHint(
          'Blob-database niet leesbaar — zet BLOB_READ_WRITE_TOKEN (store-project) en BLOB_ACCESS=private in Vercel. ' +
            'Sla niets op tot /api/health?blob=1 readable:true toont.'
        );
      } else if (blobInfo.blob && !blobInfo.blob.tokenConfigured) {
        setGateHint('Zet BLOB_READ_WRITE_TOKEN in Vercel zodat producten en orders bewaard blijven.');
      }
    } catch (e) {
      /* blob check optioneel */
    }

    if (isAdminLoggedIn() && (await verifyAdminSession())) {
      openAdminApp();
      await bootstrapAdminData();
      return;
    }

    if (!window.__urpAdminOAuthBusy && !isAdminLoggedIn()) {
      showGate(true);
    }
  })();
})();
