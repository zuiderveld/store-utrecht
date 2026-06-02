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
    btnLogin.style.display = show ? 'inline-flex' : 'none';
    btnLogout.classList.toggle('hidden', show);
    adminSession.classList.toggle('hidden', show);
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

  function requireAdminPage() {
    if (!isStoreLoggedIn()) {
      sessionStorage.setItem('urpStoreRedirect', '/admin.html');
      showGate(true);
      return false;
    }
    if (!isStoreAdmin()) {
      showGate(true);
      showToast('Geen store-beheer rechten (DISCORD_STORE_ADMIN_ROLES).');
      return false;
    }
    showGate(false);
    updateAdminHeader();
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
            return (
              '<tr><td class="mono">' +
              esc(o.id) +
              '</td><td>' +
              esc(o.productName) +
              '</td><td>' +
              statusBadge(o.status) +
              '</td><td class="mono">' +
              esc(o.license ? o.license.replace('license:', '').slice(0, 12) + '…' : '—') +
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
      : emptyRow(5, 'Nog geen orders');
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
          garage: document.getElementById('prodGarage').value.trim() || 'pillboxgarage',
          topspeed: document.getElementById('prodTopspeed').value.trim(),
          trunk: document.getElementById('prodTrunk').value.trim(),
          location: document.getElementById('prodLocation').value.trim(),
          item: document.getElementById('prodOxItem').value.trim(),
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
    window.location.href = getStoreDiscordAuthUrl(discordRedirectUri());
  }

  btnLogin.onclick = goDiscordLogin;
  btnLoginGate.onclick = goDiscordLogin;
  btnLogout.onclick = function () {
    storeLogout();
  };

  (async function init() {
    try {
      await handleStoreOAuthCallback();
    } catch (e) {
      showToast(e.message);
    }
    if (!requireAdminPage()) return;
    try {
      await loadSnapshot();
    } catch (e) {
      showToast(e.message);
    }
  })();
})();
