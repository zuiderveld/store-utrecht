(function () {
  const toast = document.getElementById('toast');
  let snapshot = { categories: [], products: [], users: [], orders: [] };

  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 4000);
  }

  async function adminApi(body) {
    return storeApi('/api/store-admin', { method: 'POST', body });
  }

  async function loadSnapshot() {
    snapshot = await storeApi('/api/store-admin?action=snapshot');
    renderAll();
  }

  document.querySelectorAll('.admin-tabs button').forEach((btn) => {
    btn.onclick = () => {
      document.querySelectorAll('.admin-tabs button').forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('.admin-panel').forEach((p) => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('panel-' + btn.dataset.tab).classList.add('active');
    };
  });

  function renderAll() {
    const catTable = document.getElementById('catTable');
    catTable.innerHTML = snapshot.categories
      .map(
        (c) =>
          '<tr><td>' +
          c.id +
          '</td><td>' +
          c.name +
          '</td><td><button type="button" data-edit-cat="' +
          c.id +
          '">Bewerk</button> <button type="button" data-del-cat="' +
          c.id +
          '">Verwijder</button></td></tr>'
      )
      .join('');

    const prodCat = document.getElementById('prodCat');
    prodCat.innerHTML = snapshot.categories.map((c) => '<option value="' + c.id + '">' + c.name + '</option>').join('');

    document.getElementById('prodTable').innerHTML = snapshot.products
      .map(
        (p) =>
          '<tr><td>' +
          p.name +
          '</td><td>' +
          p.price +
          '</td><td>' +
          p.type +
          '</td><td><button type="button" data-edit-prod="' +
          p.id +
          '">Bewerk</button> <button type="button" data-del-prod="' +
          p.id +
          '">Verwijder</button></td></tr>'
      )
      .join('');

    document.getElementById('userTable').innerHTML = snapshot.users
      .map(
        (u) =>
          '<tr><td>' +
          (u.username || u.discordId) +
          '</td><td>' +
          u.coins +
          '</td><td>' +
          (u.license || '—') +
          '</td></tr>'
      )
      .join('');

    document.getElementById('orderTable').innerHTML = snapshot.orders
      .map(
        (o) =>
          '<tr><td>' +
          o.id +
          '</td><td>' +
          o.productName +
          '</td><td>' +
          o.status +
          '</td><td>' +
          (o.license || '—') +
          '</td></tr>'
      )
      .join('');
  }

  document.getElementById('formCategory').onsubmit = async (e) => {
    e.preventDefault();
    try {
      await adminApi({
        action: 'category-save',
        id: document.getElementById('catId').value || undefined,
        name: document.getElementById('catName').value,
        sort: document.getElementById('catSort').value,
      });
      showToast('Categorie opgeslagen');
      await loadSnapshot();
    } catch (err) {
      showToast(err.message);
    }
  };

  document.getElementById('formProduct').onsubmit = async (e) => {
    e.preventDefault();
    try {
      await adminApi({
        action: 'product-save',
        id: document.getElementById('prodId').value || undefined,
        categoryId: document.getElementById('prodCat').value,
        name: document.getElementById('prodName').value,
        description: document.getElementById('prodDesc').value,
        price: document.getElementById('prodPrice').value,
        type: document.getElementById('prodType').value,
        active: document.getElementById('prodActive').checked,
        meta: {
          model: document.getElementById('prodModel').value.trim(),
          garage: document.getElementById('prodGarage').value.trim() || 'pillboxgarage',
        },
      });
      showToast('Product opgeslagen');
      await loadSnapshot();
    } catch (err) {
      showToast(err.message);
    }
  };

  document.getElementById('formCoins').onsubmit = async (e) => {
    e.preventDefault();
    try {
      await adminApi({
        action: 'coins-set',
        discordId: document.getElementById('coinDiscordId').value.trim(),
        coins: document.getElementById('coinAmount').value,
      });
      showToast('Coins bijgewerkt');
      await loadSnapshot();
    } catch (err) {
      showToast(err.message);
    }
  };

  document.getElementById('btnCoinAdd').onclick = async () => {
    const id = document.getElementById('coinDiscordId').value.trim();
    if (!id) return showToast('Vul Discord ID in');
    try {
      await adminApi({ action: 'coins-add', discordId: id, amount: 100 });
      showToast('+100 coins');
      await loadSnapshot();
    } catch (err) {
      showToast(err.message);
    }
  };

  document.body.addEventListener('click', async (e) => {
    const editCat = e.target.dataset.editCat;
    const delCat = e.target.dataset.delCat;
    const editProd = e.target.dataset.editProd;
    const delProd = e.target.dataset.delProd;

    if (editCat) {
      const c = snapshot.categories.find((x) => x.id === editCat);
      document.getElementById('catId').value = c.id;
      document.getElementById('catName').value = c.name;
      document.getElementById('catSort').value = c.sort || 0;
    }
    if (delCat && confirm('Categorie verwijderen?')) {
      await adminApi({ action: 'category-delete', id: delCat });
      await loadSnapshot();
    }
    if (editProd) {
      const p = snapshot.products.find((x) => x.id === editProd);
      document.getElementById('prodId').value = p.id;
      document.getElementById('prodName').value = p.name;
      document.getElementById('prodCat').value = p.categoryId;
      document.getElementById('prodType').value = p.type;
      document.getElementById('prodPrice').value = p.price;
      document.getElementById('prodDesc').value = p.description || '';
      document.getElementById('prodModel').value = p.meta?.model || '';
      document.getElementById('prodGarage').value = p.meta?.garage || '';
      document.getElementById('prodActive').checked = p.active !== false;
    }
    if (delProd && confirm('Product verwijderen?')) {
      await adminApi({ action: 'product-delete', id: delProd });
      await loadSnapshot();
    }
  });

  document.getElementById('btnLogin').onclick = () => {
    window.location.href = getStoreDiscordAuthUrl(storeAdminRedirectUri());
  };

  (async function init() {
    try {
      await handleStoreOAuthCallback(storeAdminRedirectUri());
      if (!getStoreToken()) {
        showToast('Log in met Discord (admin rol vereist)');
        return;
      }
      await loadSnapshot();
    } catch (e) {
      showToast(e.message);
    }
  })();
})();
