(function () {
  const toast = document.getElementById('toast');
  const adminGate = document.getElementById('adminGate');
  const adminApp = document.getElementById('adminApp');
  const adminSession = document.getElementById('adminSession');
  const btnLogout = document.getElementById('btnLogout');
  const adminLoginForm = document.getElementById('adminLoginForm');
  const productFormTitle = document.getElementById('productFormTitle');

  let snapshot = { categories: [], products: [], users: [], orders: [] };
  let selectedUserId = null;
  let userSearchQuery = '';

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

  async function requireAdminPage() {
    if (!(await verifyAdminSession())) {
      showGate(true);
      setGateHint('Log in met je beheer-gebruikersnaam en wachtwoord.');
      return false;
    }
    openAdminApp();
    return true;
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
    document.getElementById('prodImage').value = '';
    document.getElementById('prodModel').value = '';
    document.getElementById('prodOxItem').value = '';
    document.getElementById('prodItemCount').value = '';
    document.getElementById('prodDiscordRoleId').value = '';
    document.getElementById('prodDiscordRoleName').value = '';
    document.getElementById('prodGarage').value = '';
    document.getElementById('prodTopspeed').value = '';
    document.getElementById('prodTrunk').value = '';
    document.getElementById('prodLocation').value = '';
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

  function syncProductTypeFields() {
    const type = document.getElementById('prodType').value;
    const vehicleFields = document.getElementById('prodVehicleFields');
    const itemFields = document.getElementById('prodItemFields');
    const discordRoleFields = document.getElementById('prodDiscordRoleFields');
    const sectionVehicle = document.getElementById('prodSectionVehicle');
    const sectionItem = document.getElementById('prodSectionItem');
    const sectionDiscordRole = document.getElementById('prodSectionDiscordRole');
    const showVehicle = type === 'vehicle';
    const showItem = type === 'item';
    const showDiscordRole = type === 'discord_role';

    vehicleFields.classList.toggle('hidden', !showVehicle);
    sectionVehicle.classList.toggle('hidden', !showVehicle);
    itemFields.classList.toggle('hidden', !showItem);
    sectionItem.classList.toggle('hidden', !showItem);
    discordRoleFields.classList.toggle('hidden', !showDiscordRole);
    sectionDiscordRole.classList.toggle('hidden', !showDiscordRole);
    document.getElementById('prodOxItem').required = showItem;
    document.getElementById('prodModel').required = showVehicle;
    document.getElementById('prodDiscordRoleId').required = showDiscordRole;
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
    };
  });

  function renderAll() {
    renderStats();

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
              '</td><td>' +
              p.price +
              ' 🪙</td><td>' +
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

  document.getElementById('formProduct').onsubmit = async function (e) {
    e.preventDefault();
    try {
      await adminApi({
        action: 'product-save',
        id: document.getElementById('prodId').value || undefined,
        categoryId: document.getElementById('prodCat').value,
        name: document.getElementById('prodName').value,
        description: document.getElementById('prodDesc').value,
        price: document.getElementById('prodPrice').value,
        originalPrice: document.getElementById('prodOriginalPrice').value || null,
        image: document.getElementById('prodImage').value.trim(),
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
        },
      });
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
      document.getElementById('prodImage').value = p.image || '';
      document.getElementById('prodDesc').value = p.description || '';
      document.getElementById('prodModel').value = p.meta?.model || '';
      document.getElementById('prodOxItem').value = p.meta?.item || '';
      document.getElementById('prodItemCount').value = p.meta?.count || '';
      document.getElementById('prodDiscordRoleId').value = p.meta?.discordRoleId || p.meta?.roleId || '';
      document.getElementById('prodDiscordRoleName').value = p.meta?.roleName || '';
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

  var formMaintenance = document.getElementById('formMaintenance');
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
        await loadSnapshot();
        await loadMaintenance();
        syncProductTypeFields();
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

  (async function init() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');

    if (code) {
      setGateHint('Discord login verwerken…');
      window.history.replaceState({}, '', '/admin.html');
      try {
        await adminDiscordLoginWithCode(code);
        openAdminApp();
        await loadSnapshot();
        await loadMaintenance();
        syncProductTypeFields();
        showToast('Ingelogd via Discord');
        return;
      } catch (err) {
        var hint = err.message || 'Discord login mislukt';
        if (err.details && err.details.discordId) {
          hint +=
            ' — rol Store Beheer (1502448726676078704) op server 1416816652644909109 nodig.';
        }
        setGateHint(hint);
        showToast(hint);
        showGate(true);
      }
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
          'Geen admin accounts — zet STORE_ADMIN_USERS of STORE_ADMIN_PASSWORD in Vercel en redeploy.'
        );
      } else if (cfg.multiUser) {
        setGateHint(
          'Meerdere beheerders: log in met jouw eigen gebruikersnaam en wachtwoord.'
        );
      }
    } catch (e) {
      /* config optioneel */
    }

    if (!(await requireAdminPage())) {
      showGate(true);
      return;
    }

    try {
      await loadSnapshot();
      await loadMaintenance();
      syncProductTypeFields();
    } catch (e) {
      showToast(e.message);
      if (!(await requireAdminPage())) return;
    }
  })();
})();
