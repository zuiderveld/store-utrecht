(function () {
  const grid = document.getElementById('productGrid');
  const catTabs = document.getElementById('categoryTabs');
  const userBar = document.getElementById('userBar');
  const coinEl = document.getElementById('coinBalance');
  const userName = document.getElementById('userName');
  const userAvatar = document.getElementById('userAvatar');
  const btnLogin = document.getElementById('btnLogin');
  const btnLogout = document.getElementById('btnLogout');
  const btnLink = document.getElementById('btnLinkFivem');
  const linkBox = document.getElementById('linkBox');
  const linkCode = document.getElementById('linkCode');
  const navAdmin = document.getElementById('navAdmin');
  const toast = document.getElementById('toast');
  const searchInput = document.getElementById('searchInput');
  const productCount = document.getElementById('productCount');
  const topBuyerEl = document.getElementById('topBuyer');
  const recentList = document.getElementById('recentList');
  const productModal = document.getElementById('productModal');
  const modalClose = document.getElementById('modalClose');
  const heroActions = document.getElementById('heroActions');
  const btnLoginHero = document.getElementById('btnLoginHero');

  let catalog = { categories: [], products: [], me: null, recentPurchases: [], topBuyer: null };
  let activeCat = 'coins';
  let searchQuery = '';
  let modalProduct = null;

  const COINS_TAB = 'coins';
  const coinPackages = window.STORE_CONFIG?.coinPackages || [];
  const tebexUrl = window.STORE_CONFIG?.tebexUrl || '#';

  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 4500);
  }

  function esc(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  function formatTime(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    return d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
  }

  function discountPercent(price, original) {
    if (!original || original <= price) return 0;
    return Math.round((1 - price / original) * 100);
  }

  function placeholderLetter(name) {
    return (name || '?').charAt(0).toUpperCase();
  }

  function imageBlock(image, name) {
    if (image) {
      return '<img src="' + esc(image) + '" alt="' + esc(name) + '" loading="lazy">';
    }
    return '<span class="store-placeholder">' + esc(placeholderLetter(name)) + '</span>';
  }

  function updateAuthUI() {
    const me = catalog.me;
    const discordIn = isStoreLoggedIn();
    const fivemIn = me?.linked || isStoreFivemLinked();

    btnLogin.style.display = discordIn ? 'none' : 'inline-flex';
    btnLogout.style.display = discordIn ? 'inline-flex' : 'none';
    userBar.style.display = discordIn ? 'flex' : 'none';
    if (heroActions) heroActions.style.display = discordIn ? 'none' : 'flex';

    if (discordIn && me) {
      coinEl.textContent = me.coins ?? 0;
      sessionStorage.setItem('urpStoreCoins', String(me.coins ?? 0));
      sessionStorage.setItem('urpStoreFivemLinked', fivemIn ? 'true' : 'false');

      let status = 'Discord ✓';
      status += fivemIn ? ' · FiveM ✓' : ' · FiveM ✗';
      userName.textContent = (me.username || storeUserName()) + ' — ' + status;
      btnLink.style.display = fivemIn ? 'none' : 'inline-flex';
      navAdmin.style.display = me.isAdmin ? 'inline' : 'none';

      const avatar = sessionStorage.getItem('urpStoreAvatarUrl');
      if (avatar) {
        userAvatar.src = avatar;
        userAvatar.style.display = 'block';
      }
    }
  }

  function renderWidgets() {
    const top = catalog.topBuyer;
    if (top && top.username) {
      topBuyerEl.innerHTML =
        '<div class="store-top-donor-avatar">' +
        esc(placeholderLetter(top.username)) +
        '</div><div class="store-top-donor-info"><div class="store-top-donor-name">' +
        esc(top.username) +
        '</div><div class="store-top-donor-amount">' +
        top.totalSpent +
        ' coins uitgegeven</div></div>';
    } else {
      topBuyerEl.innerHTML = '<div class="store-top-donor-empty">Nog geen aankopen deze maand</div>';
    }

    const recent = catalog.recentPurchases || [];
    if (recent.length) {
      recentList.innerHTML = recent
        .map(
          (r) =>
            '<li><span class="store-recent-user">' +
            esc(r.username) +
            '</span><span class="store-recent-product">' +
            esc(r.productName) +
            '</span><span class="store-recent-time">' +
            formatTime(r.createdAt) +
            '</span></li>'
        )
        .join('');
    } else {
      recentList.innerHTML = '<li class="store-recent-empty">Nog geen recente aankopen</li>';
    }
  }

  function renderCategoryTabs() {
    catTabs.innerHTML = '';

    const coinsBtn = document.createElement('button');
    coinsBtn.type = 'button';
    coinsBtn.className = 'store-cat-tab' + (activeCat === COINS_TAB ? ' active' : '');
    coinsBtn.textContent = 'Coins kopen';
    coinsBtn.onclick = () => {
      activeCat = COINS_TAB;
      searchQuery = '';
      searchInput.value = '';
      renderCategoryTabs();
      renderProducts();
    };
    catTabs.appendChild(coinsBtn);

    catalog.categories.forEach((c) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'store-cat-tab' + (activeCat === c.id ? ' active' : '');
      btn.textContent = c.name;
      btn.onclick = () => {
        activeCat = c.id;
        renderCategoryTabs();
        renderProducts();
      };
      catTabs.appendChild(btn);
    });
  }

  function buyLabel() {
    if (!isStoreLoggedIn()) return 'Log in';
    if (!canUseCoins()) return 'Koppel FiveM';
    return 'Kopen';
  }

  function canBuyProduct(price) {
    return canUseCoins() && (catalog.me?.coins || 0) >= price;
  }

  function filteredProducts() {
    let items = catalog.products.filter((p) => activeCat === 'all' || p.categoryId === activeCat);
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      items = items.filter(
        (p) =>
          (p.name || '').toLowerCase().includes(q) ||
          (p.description || '').toLowerCase().includes(q) ||
          (p.type || '').toLowerCase().includes(q)
      );
    }
    return items;
  }

  function filteredCoinPackages() {
    if (!searchQuery.trim()) return coinPackages;
    const q = searchQuery.trim().toLowerCase();
    return coinPackages.filter(
      (p) => (p.name || '').toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q)
    );
  }

  function openModal(product, isTebex) {
    modalProduct = { ...product, isTebex: !!isTebex };
    document.getElementById('modalImage').innerHTML = imageBlock(product.image, product.name);
    document.getElementById('modalType').textContent = isTebex ? 'Tebex' : product.type || 'item';
    document.getElementById('modalTitle').textContent = product.name;
    document.getElementById('modalDesc').textContent = product.description || '';

    const priceEl = document.getElementById('modalPrice');
    const buyBtn = document.getElementById('modalBuy');

    if (isTebex) {
      const pct = discountPercent(product.salePrice, product.price);
      priceEl.innerHTML =
        (pct ? '<span class="store-card-badge" style="position:static;display:inline-block;margin-right:8px">-' + pct + '%</span>' : '') +
        '<span class="store-price-eur">€' +
        product.salePrice.toFixed(2) +
        '</span>' +
        (product.price > product.salePrice
          ? ' <span class="store-price-old">€' + product.price.toFixed(2) + '</span>'
          : '');
      buyBtn.textContent = 'Kopen via Tebex';
      buyBtn.disabled = false;
      buyBtn.onclick = () => window.open(product.tebexUrl || tebexUrl, '_blank');
    } else {
      priceEl.textContent = product.price + ' coins';
      buyBtn.textContent = buyLabel();
      buyBtn.disabled = !canBuyProduct(product.price);
      buyBtn.onclick = () => purchase(product.id);
    }

    productModal.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    productModal.hidden = true;
    document.body.style.overflow = '';
    modalProduct = null;
  }

  function renderCoinPackages() {
    const items = filteredCoinPackages();
    document.getElementById('emptyMsg').style.display = items.length ? 'none' : 'block';
    productCount.textContent = items.length + ' pakketten';
    grid.innerHTML = '';

    items.forEach((p) => {
      const pct = discountPercent(p.salePrice, p.price);
      const card = document.createElement('article');
      card.className = 'store-card store-card-tebex';
      card.innerHTML =
        '<div class="store-card-image">' +
        (pct ? '<span class="store-card-badge">-' + pct + '%</span>' : '') +
        '<span class="store-placeholder">🪙</span></div>' +
        '<div class="store-card-body">' +
        '<span class="type-badge">Tebex · ' +
        p.coins +
        ' coins</span>' +
        '<h4>' +
        esc(p.name) +
        '</h4>' +
        '<p>' +
        esc(p.description) +
        '</p>' +
        '<div class="store-price-row">' +
        '<span class="store-price store-price-eur">€' +
        p.salePrice.toFixed(2) +
        '</span>' +
        (p.price > p.salePrice ? '<span class="store-price-old">€' + p.price.toFixed(2) + '</span>' : '') +
        '</div>' +
        '<div class="store-card-actions">' +
        '<button type="button" class="btn-view" data-view>Bekijken</button>' +
        '<button type="button" class="btn-buy" data-buy>Kopen via Tebex</button>' +
        '</div></div>';

      card.querySelector('[data-view]').onclick = () => openModal(p, true);
      card.querySelector('[data-buy]').onclick = () => window.open(p.tebexUrl || tebexUrl, '_blank');
      grid.appendChild(card);
    });
  }

  function renderProducts() {
    if (activeCat === COINS_TAB) {
      renderCoinPackages();
      return;
    }

    const items = filteredProducts();
    document.getElementById('emptyMsg').style.display = items.length ? 'none' : 'block';
    productCount.textContent = items.length + ' producten';
    grid.innerHTML = '';

    items.forEach((p) => {
      const pct = p.originalPrice ? discountPercent(p.price, p.originalPrice) : 0;
      const card = document.createElement('article');
      card.className = 'store-card';
      card.innerHTML =
        '<div class="store-card-image">' +
        (pct ? '<span class="store-card-badge">-' + pct + '%</span>' : '') +
        imageBlock(p.image, p.name) +
        '</div>' +
        '<div class="store-card-body">' +
        '<span class="type-badge">' +
        esc(p.type || 'item') +
        '</span>' +
        '<h4>' +
        esc(p.name) +
        '</h4>' +
        '<p>' +
        esc(p.description || '') +
        '</p>' +
        '<div class="store-price-row">' +
        '<span class="store-price">' +
        p.price +
        ' coins</span>' +
        (p.originalPrice && p.originalPrice > p.price
          ? '<span class="store-price-old">' + p.originalPrice + ' coins</span>'
          : '') +
        '</div>' +
        '<div class="store-card-actions">' +
        '<button type="button" class="btn-view">Bekijken</button>' +
        '<button type="button" class="btn-buy">' +
        buyLabel() +
        '</button></div></div>';

      const buyBtn = card.querySelector('.btn-buy');
      buyBtn.disabled = !canBuyProduct(p.price);
      buyBtn.onclick = () => purchase(p.id);
      card.querySelector('.btn-view').onclick = () => openModal(p, false);
      grid.appendChild(card);
    });
  }

  async function loadCatalog() {
    catalog = await storeApi('/api/store');
    if (catalog.me) setStoreSession({ ...catalog.me, accessToken: storeAccessToken(), linked: catalog.me.linked });
    updateAuthUI();
    renderWidgets();
    renderCategoryTabs();
    renderProducts();
  }

  async function purchase(productId) {
    if (!isStoreLoggedIn()) {
      showToast('Log eerst in met Discord.');
      return;
    }
    if (!canUseCoins()) {
      showToast('Koppel FiveM via /koppelstore — coins vereisen Discord + FiveM.');
      return;
    }
    try {
      const res = await storeApi('/api/store-purchase', {
        method: 'POST',
        body: { productId },
      });
      showToast(res.message || 'Aankoop gelukt!');
      catalog.me.coins = res.coins;
      updateAuthUI();
      renderProducts();
      closeModal();
      await loadCatalog();
    } catch (e) {
      showToast(e.message);
    }
  }

  btnLogin.onclick = () => {
    window.location.href = getStoreDiscordAuthUrl(discordRedirectUri());
  };

  if (btnLoginHero) btnLoginHero.onclick = btnLogin.onclick;

  btnLogout.onclick = () => storeLogout();

  btnLink.onclick = async () => {
    if (!isStoreLoggedIn()) {
      showToast('Log eerst in met Discord.');
      return;
    }
    try {
      const res = await storeApi('/api/store-link', { method: 'POST' });
      linkCode.textContent = '/koppelstore ' + res.code;
      linkBox.style.display = 'block';
      showToast('Ga in-game en typ het commando.');
    } catch (e) {
      showToast(e.message);
    }
  };

  searchInput.addEventListener('input', () => {
    searchQuery = searchInput.value;
    renderProducts();
  });

  modalClose.onclick = closeModal;
  productModal.addEventListener('click', (e) => {
    if (e.target === productModal) closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !productModal.hidden) closeModal();
  });

  (async function init() {
    try {
      await handleStoreOAuthCallback();
    } catch (e) {
      showToast(e.message);
    }
    await loadCatalog();
  })();
})();
