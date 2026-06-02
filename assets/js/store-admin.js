(function () {
  const toast = document.getElementById('toast');
  const adminGate = document.getElementById('adminGate');
  const adminApp = document.getElementById('adminApp');
  const adminSession = document.getElementById('adminSession');
  const btnLogin = document.getElementById('btnLogin');
  const btnLogout = document.getElementById('btnLogout');
  const btnLoginGate = document.getElementById('btnLoginGate');
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
    return storeApi('/api/store-admin', { method: 'POST', body: body });
  }

  async function loadSnapshot() {
    snapshot = await storeApi('/api/store-admin?action=snapshot');
    renderAll();
  }

  function showGate(show) {
    adminGate.classList.toggle('hidden', !show);
    adminApp.classList.toggle('hidden', show);
    var loggedIn = isStoreLoggedIn();
    btnLogin.style.display = show && !loggedIn ? 'inline-flex' : 'none';
    btnLogout.classList.toggle('hidden', !loggedIn);
    adminSession.classList.toggle('hidden', !loggedIn || show);
  }

  function setGateHint(text, asHtml) {
    var gateHint = document.getElementById('adminGateHint');
    if (!gateHint) return;
    gateHint.classList.remove('hidden');
    if (asHtml) gateHint.innerHTML = text;
    else gateHint.textContent = text;
  }

  function updateAdminHeader() {
    if (!isStoreLoggedIn()) return;
    const name = sessionStorage.getItem('urpStoreUser') || 'Beheerder';
    document.getElementById('adminUserName').textContent = name;
    const avatar = sessionStorage.getItem('urpStoreAvatarUrl');
    const img = document.getElementById('adminAvatar');
    if (avatar) {
      img.src = avatar;
      img.style.display = 'block';
    } else {
      img.style.display = 'none';
    }
  }

  function formatRoleList(roles, ids) {
    if (roles && roles.length) {
      return roles
        .map(function (r) {
          return r.name ? r.name + ' (' + r.id + ')' : r.id;
        })
        .join(', ');
    }
    return (ids || []).join(', ') || 'geen';
  }

  async function refreshAdminFromStore() {
    try {
      const data = await storeApi('/api/store');
      if (!data.me) return null;
      setStoreSession(Object.assign({}, data.me, { accessToken: storeAccessToken() }));
      return data.me;
    } catch (e) {
      return null;
    }
  }

  function openAdminApp() {
    var gateHint = document.getElementById('adminGateHint');
    if (gateHint) {
      gateHint.classList.add('hidden');
      gateHint.textContent = '';
    }
    showGate(false);
    updateAdminHeader();
  }

  async function refreshAdminAccess() {
    const gateHint = document.getElementById('adminGateHint');

    if (!isStoreLoggedIn()) {
      setGateHint(
        'Je bent nog niet ingelogd. Ga naar de store en log in, of klik hieronder op Discord.'
      );
      showGate(true);
      return false;
    }

    updateAdminHeader();
    setGateHint('Ingelogd als ' + storeUserName() + ' — toegang controleren…');
    showGate(true);

    var me = await refreshAdminFromStore();
    if (me && me.isAdmin) {
      openAdminApp();
      return true;
    }

    if (isStoreAdmin()) {
      openAdminApp();
      return true;
    }

    setGateHint('Beheer-rechten controleren via Discord…');

    try {
      const headers = { 'Content-Type': 'application/json' };
      const token = storeAccessToken();
      if (token) headers.Authorization = 'Bearer ' + token;

      const res = await fetch(window.STORE_CONFIG.apiBase + '/api/store-auth', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ action: 'admin-check' }),
      });
      const data = await res.json().catch(function () {
        return {};
      });

      if (!res.ok && !data.requiredRoleIds && !data.memberRoleIds) {
        throw new Error(data.error || res.statusText || 'Admin check mislukt');
      }

      if (!res.ok && data.error && !data.discordId) {
        throw new Error(data.error);
      }

      setStoreSession({
        username: data.username,
        accessToken: storeAccessToken(),
        isAdmin: data.isAdmin,
        discordId: data.discordId,
        discordLinked: true,
        avatarUrl: data.avatarUrl,
        loginMethod: 'discord',
      });

      if (data.isAdmin === true || data.adminViaUserAllowlist) {
        openAdminApp();
        return true;
      }

      if (!data.isAdmin) {
        if (gateHint) {
          gateHint.classList.remove('hidden');
          var unresolved = (data.unresolvedRoleTokens || []).join(', ');
          var errLine = data.error ? '<br><strong>Fout:</strong> ' + esc(data.error) : '';
          var discordLine = data.discordId
            ? '<br><strong>Jouw Discord-ID:</strong> <code>' + esc(data.discordId) + '</code>'
            : '';
          gateHint.innerHTML =
            'Geen beheer-toegang (server …' +
            esc(data.guildIdSuffix || '??????') +
            ').' +
            errLine +
            discordLine +
            '<br><strong>Vereist (rol-ID):</strong> <code>' +
            esc((data.requiredRoleIds || []).join(', ') || 'niet geconfigureerd') +
            '</code><br><strong>Jouw rollen:</strong> ' +
            esc(formatRoleList(data.memberRoles, data.memberRoleIds)) +
            (unresolved
              ? '<br><strong>Let op:</strong> onbekende rolnamen in Vercel: <code>' +
                esc(unresolved) +
                '</code>'
              : '');
        }
        showGate(true);
        showToast('Geen store-beheer rol op Discord.');
        return false;
      }

      openAdminApp();
      return true;
    } catch (err) {
      if (gateHint) {
        gateHint.classList.remove('hidden');
        gateHint.textContent = err.message || 'Discord check mislukt.';
      }
      showGate(true);
      showToast(err.message || 'Admin check mislukt');
      return false;
    }
  }

  function requireAdminPage() {
    return refreshAdminAccess();
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
    const sectionVehicle = document.getElementById('prodSectionVehicle');
    const sectionItem = document.getElementById('prodSectionItem');
    const showVehicle = type === 'vehicle';
    const showItem = type === 'item';

    vehicleFields.classList.toggle('hidden', !showVehicle);
    sectionVehicle.classList.toggle('hidden', !showVehicle);
    itemFields.classList.toggle('hidden', !showItem);
    sectionItem.classList.toggle('hidden', !showItem);
    document.getElementById('prodOxItem').required = showItem;
    document.getElementById('prodModel').required = showVehicle;
  }

  document.getElementById('prodType').addEventListener('change', syncProductTypeFields);
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

  function goDiscordLogin() {
    clearStoreSession();
    window.location.href = getStoreDiscordAuthUrl(storeOAuthReturnUri(), null, 'admin');
  }

  btnLogin.onclick = goDiscordLogin;
  btnLoginGate.onclick = goDiscordLogin;
  btnLogout.onclick = function () {
    storeLogout();
  };

  (async function init() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('error')) {
      showToast(
        'Discord login mislukt: ' + (params.get('error_description') || params.get('error'))
      );
      setGateHint(
        'Discord redirect ontbreekt. Voeg in Discord Developer Portal toe:\n' +
          window.location.origin +
          '/\n' +
          window.location.origin +
          '/admin.html'
      );
      window.history.replaceState({}, '', '/admin.html');
    }

    if (params.get('code')) {
      setGateHint('Discord login verwerken…');
      if (btnLoginGate) btnLoginGate.disabled = true;
    }

    try {
      var oauth = await handleStoreOAuthCallback();
      if (oauth && oauth.accessToken) {
        if (oauth.isAdmin) {
          setStoreSession({
            username: oauth.username,
            accessToken: oauth.accessToken,
            isAdmin: true,
            discordId: oauth.discordId,
            discordLinked: true,
            avatarUrl: oauth.avatarUrl,
            loginMethod: 'discord',
          });
          showGate(false);
          updateAdminHeader();
          try {
            await loadSnapshot();
            syncProductTypeFields();
          } catch (err) {
            showToast(err.message);
          }
          return;
        }
      }
    } catch (e) {
      setGateHint('Login mislukt: ' + e.message);
      showToast(e.message);
    }

    if (btnLoginGate) btnLoginGate.disabled = false;

    if (isStoreLoggedIn() && isStoreAdmin()) {
      openAdminApp();
      try {
        await loadSnapshot();
        syncProductTypeFields();
      } catch (e) {
        showToast(e.message);
        if (!(await refreshAdminAccess())) return;
        try {
          await loadSnapshot();
          syncProductTypeFields();
        } catch (err) {
          showToast(err.message);
        }
      }
      return;
    }

    if (!params.get('code')) {
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
    }

    if (!(await requireAdminPage())) return;
    try {
      await loadSnapshot();
      syncProductTypeFields();
    } catch (e) {
      showToast(e.message);
    }
  })();
})();
