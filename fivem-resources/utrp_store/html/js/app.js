(function () {
  const app = document.getElementById('app');
  const catNav = document.getElementById('catNav');
  const productGrid = document.getElementById('productGrid');
  const coinAmount = document.getElementById('coinAmount');
  const cartBadge = document.getElementById('cartBadge');
  const catTitle = document.getElementById('catTitle');
  const catCount = document.getElementById('catCount');
  const searchInput = document.getElementById('searchInput');
  const sidebarEmpty = document.getElementById('sidebarEmpty');
  const sidebarContent = document.getElementById('sidebarContent');
  const cartPanel = document.getElementById('cartPanel');
  const cartList = document.getElementById('cartList');
  const cartItems = document.getElementById('cartItems');
  const cartTotal = document.getElementById('cartTotal');
  const confirmModal = document.getElementById('confirmModal');
  const toast = document.getElementById('toast');
  const storeBackdrop = document.getElementById('storeBackdrop');
  const coinBalanceEl = document.getElementById('coinBalance');

  let profilePollTimer = null;

  let state = {
    categories: [],
    products: [],
    profile: { linked: false, coins: 0 },
    activeCat: 'all',
    search: '',
    selected: null,
    cart: [],
    cartOpen: false,
    storeWebUrl: '',
    tebexUrl: '',
  };

  function post(name, data) {
    return fetch('https://utrp_store/' + name, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data || {}),
    }).then((r) => r.json());
  }

  function showToast(msg, type) {
    toast.textContent = msg;
    toast.className = 'toast ' + (type || '');
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 3500);
  }

  function esc(s) {
    const d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function imageHtml(image, name) {
    if (image) return '<img src="' + esc(image) + '" alt="">';
    return '<span class="ph">' + esc((name || '?').charAt(0).toUpperCase()) + '</span>';
  }

  function categoryName(id) {
    if (id === 'all') return 'Alles';
    const c = state.categories.find((x) => x.id === id);
    return c ? c.name : 'Store';
  }

  function filteredProducts() {
    let items = state.products;
    if (state.activeCat !== 'all') {
      items = items.filter((p) => p.categoryId === state.activeCat);
    }
    if (state.search.trim()) {
      const q = state.search.trim().toLowerCase();
      items = items.filter(
        (p) =>
          (p.name || '').toLowerCase().includes(q) ||
          (p.description || '').toLowerCase().includes(q)
      );
    }
    return items;
  }

  function cartTotalCoins() {
    return state.cart.reduce((sum, id) => {
      const p = state.products.find((x) => x.id === id);
      return sum + (p ? Number(p.price) || 0 : 0);
    }, 0);
  }

  function updateCartUI() {
    const prev = Number(coinAmount.dataset.value || 0);
    const next = state.profile.coins ?? 0;
    cartBadge.textContent = state.cart.length;
    cartItems.textContent = state.cart.length;
    cartTotal.textContent = cartTotalCoins() + ' 🪙';
    coinAmount.textContent = next;
    coinAmount.dataset.value = String(next);
    if (prev !== next && coinBalanceEl) {
      coinBalanceEl.classList.remove('updated');
      void coinBalanceEl.offsetWidth;
      coinBalanceEl.classList.add('updated');
    }

    cartList.innerHTML = state.cart
      .map((id, idx) => {
        const p = state.products.find((x) => x.id === id);
        if (!p) return '';
        return (
          '<li><span class="name">' +
          esc(p.name) +
          '</span><span class="price">' +
          p.price +
          '</span><button type="button" data-rm="' +
          idx +
          '">✕</button></li>'
        );
      })
      .join('');

    cartList.querySelectorAll('[data-rm]').forEach((btn) => {
      btn.onclick = () => {
        state.cart.splice(Number(btn.dataset.rm), 1);
        updateCartUI();
      };
    });
  }

  function showDetail(product) {
    state.selected = product;
    sidebarEmpty.classList.add('hidden');
    sidebarContent.classList.remove('hidden');

    document.getElementById('detailImage').innerHTML = imageHtml(product.image, product.name);
    document.getElementById('detailTitle').textContent = product.name;
    document.getElementById('detailDesc').textContent = product.description || '';
    document.getElementById('detailPrice').textContent = product.price + ' 🪙';

    const meta = product.meta || {};
    const stats = [
      ['Topsnelheid', meta.topspeed || meta.topSpeed || '—'],
      ['Kofferbak', meta.trunk || meta.kofferbak || '—'],
      ['Locatie', meta.location || meta.locatie || 'Vasteland'],
    ];
    document.getElementById('detailStats').innerHTML = stats
      .map(
        (s) =>
          '<li><span>' +
          esc(s[0]) +
          '</span><span>' +
          esc(String(s[1])) +
          '</span></li>'
      )
      .join('');

    document.getElementById('detailAddCart').onclick = () => addToCart(product.id);
  }

  function addToCart(productId) {
    if (!state.profile.linked) {
      showToast('Koppel eerst je account via store.utrechtroleplay.eu + /koppelstore', 'error');
      return;
    }
    const product = state.products.find(function (x) {
      return x.id === productId;
    });
    if (product && product.type === 'item' && !(product.meta && product.meta.item)) {
      showToast('Dit item mist ox item naam in admin — kan niet gekocht worden', 'error');
      return;
    }
    if (product && product.type === 'vehicle' && !(product.meta && product.meta.model)) {
      showToast('Dit voertuig mist spawn model in admin — kan niet gekocht worden', 'error');
      return;
    }
    state.cart.push(productId);
    updateCartUI();
    showToast('Toegevoegd aan winkelwagen', 'success');
  }

  function renderCategories() {
    catNav.innerHTML = '';
    const tabs = [{ id: 'all', name: 'Alles' }, ...state.categories];
    tabs.forEach((c) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = c.name;
      btn.className = state.activeCat === c.id ? 'active' : '';
      btn.onclick = () => {
        state.activeCat = c.id;
        renderCategories();
        renderProducts();
      };
      catNav.appendChild(btn);
    });
  }

  function renderProducts() {
    const items = filteredProducts();
    catTitle.textContent = categoryName(state.activeCat);
    catCount.textContent = items.length + ' items beschikbaar';
    productGrid.innerHTML = '';

    if (!state.profile.linked) {
      const banner = document.createElement('div');
      banner.className = 'link-banner';
      banner.innerHTML =
        '<strong>Account koppelen vereist</strong><br>Log in op ' +
        esc(state.storeWebUrl || 'store.utrechtroleplay.eu') +
        ', klik <em>Koppel FiveM</em> en typ <code>/koppelstore CODE</code> in-game.';
      productGrid.appendChild(banner);
    }

    items.forEach((p) => {
      const card = document.createElement('article');
      card.className = 'product-card' + (state.selected?.id === p.id ? ' selected' : '');
      card.innerHTML =
        '<div class="thumb">' +
        imageHtml(p.image, p.name) +
        '</div><div class="body"><h4>' +
        esc(p.name) +
        '</h4><p>' +
        esc(p.description || '') +
        '</p><div class="foot"><span class="price">' +
        p.price +
        ' 🪙</span><button type="button" class="add">🛒</button></div></div>';

      card.onclick = (e) => {
        if (e.target.classList.contains('add')) return;
        showDetail(p);
        renderProducts();
      };
      card.querySelector('.add').onclick = (e) => {
        e.stopPropagation();
        addToCart(p.id);
      };
      productGrid.appendChild(card);
    });
  }

  function toggleCart(open) {
    state.cartOpen = open;
    if (open) {
      sidebarEmpty.classList.add('hidden');
      sidebarContent.classList.add('hidden');
      cartPanel.classList.remove('hidden');
    } else {
      cartPanel.classList.add('hidden');
      if (state.selected) {
        sidebarContent.classList.remove('hidden');
      } else {
        sidebarEmpty.classList.remove('hidden');
      }
    }
  }

  function closeStore() {
    confirmModal.classList.add('hidden');
    app.classList.add('hidden');
    stopProfilePoll();
    post('close').catch(function () {});
  }

  function startProfilePoll() {
    stopProfilePoll();
    profilePollTimer = setInterval(async function () {
      try {
        const res = await post('refreshProfile');
        if (res && res.coins != null) {
          state.profile.coins = res.coins;
          state.profile.linked = res.linked !== false;
          updateCartUI();
        }
      } catch (_) {}
    }, 8000);
  }

  function stopProfilePoll() {
    if (profilePollTimer) {
      clearInterval(profilePollTimer);
      profilePollTimer = null;
    }
  }
  function confirmCheckout() {
    if (!state.cart.length) {
      showToast('Winkelwagen is leeg', 'error');
      return;
    }
    const total = cartTotalCoins();
    document.getElementById('confirmText').textContent =
      'Weet je zeker dat je ' +
      state.cart.length +
      ' item(s) wilt afrekenen voor ' +
      total +
      ' coins?';
    confirmModal.classList.remove('hidden');
  }

  document.getElementById('btnCheckout').onclick = confirmCheckout;

  document.getElementById('confirmCancel').onclick = () => confirmModal.classList.add('hidden');

  document.getElementById('confirmOk').onclick = async () => {
    confirmModal.classList.add('hidden');
    const ids = [...state.cart];
    try {
      const res = await post('checkout', { productIds: ids });
      if (res.ok) {
        state.profile.coins = res.coins;
        state.cart = [];
        updateCartUI();
        toggleCart(false);
        showToast(res.message || 'Aankoop gelukt!', 'success');
      } else {
        showToast(res.error || 'Aankoop mislukt', 'error');
      }
    } catch {
      showToast('Verbinding mislukt', 'error');
    }
  };

  document.getElementById('btnCart').onclick = () => toggleCart(!state.cartOpen);
  document.getElementById('btnBackShop').onclick = () => toggleCart(false);
  document.getElementById('btnClose').onclick = closeStore;
  if (storeBackdrop) storeBackdrop.onclick = closeStore;

  searchInput.addEventListener('input', () => {
    state.search = searchInput.value;
    renderProducts();
  });

  window.addEventListener('message', (event) => {
    const msg = event.data;
    if (msg.action === 'open') {
      const d = msg.data || {};
      state.categories = d.categories || [];
      state.products = d.products || [];
      state.profile = d.profile || { linked: false, coins: 0 };
      state.storeWebUrl = d.storeWebUrl || '';
      state.tebexUrl = d.tebexUrl || '';
      state.activeCat = 'all';
      state.search = '';
      state.selected = null;
      state.cart = [];
      state.cartOpen = false;
      searchInput.value = '';
      app.classList.remove('hidden');
      cartPanel.classList.add('hidden');
      sidebarEmpty.classList.remove('hidden');
      sidebarContent.classList.add('hidden');
      updateCartUI();
      renderCategories();
      renderProducts();
      startProfilePoll();
    }
    if (msg.action === 'close') {
      app.classList.add('hidden');
      stopProfilePoll();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeStore();
  });
})();
