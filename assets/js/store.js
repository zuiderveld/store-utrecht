(function () {
  const grid = document.getElementById('productGrid');
  const catTabs = document.getElementById('categoryTabs');
  const userBar = document.getElementById('userBar');
  const coinEl = document.getElementById('coinBalance');
  const userName = document.getElementById('userName');
  const userAvatar = document.getElementById('userAvatar');
  const statusBadges = document.getElementById('statusBadges');
  const btnLogin = document.getElementById('btnLogin');
  const btnLogout = document.getElementById('btnLogout');
  const btnLinkDiscord = document.getElementById('btnLinkDiscord');
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
  const loginModal = document.getElementById('loginModal');
  const modalClose = document.getElementById('modalClose');
  const loginModalClose = document.getElementById('loginModalClose');
  const heroActions = document.getElementById('heroActions');
  const btnLoginHero = document.getElementById('btnLoginHero');
  const sessionChip = document.getElementById('sessionChip');
  const chipName = document.getElementById('chipName');
  const chipStatus = document.getElementById('chipStatus');
  const chipCoins = document.getElementById('chipCoins');
  const chipAvatar = document.getElementById('chipAvatar');
  const loggedBanner = document.getElementById('loggedBanner');
  const loggedBannerText = document.getElementById('loggedBannerText');

  let catalog = { categories: [], products: [], me: null, recentPurchases: [], topBuyer: null };
  let activeCat = 'all';
  let searchQuery = '';

  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(function () {
      toast.classList.remove('show');
    }, 4500);
  }

  function esc(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  function formatTime(ts) {
    if (!ts) return '';
    return new Date(ts).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
  }

  function discountPercent(price, original) {
    if (!original || original <= price) return 0;
    return Math.round((1 - price / original) * 100);
  }

  function placeholderLetter(name) {
    return (name || '?').charAt(0).toUpperCase();
  }

  function imageBlock(image, name) {
    if (image) return '<img src="' + esc(image) + '" alt="' + esc(name) + '" loading="lazy">';
    return '<span class="store-placeholder">' + esc(placeholderLetter(name)) + '</span>';
  }

  function badge(ok, label) {
    return (
      '<span class="store-badge ' +
      (ok ? 'ok' : 'missing') +
      '">' +
      (ok ? '✓' : '✗') +
      ' ' +
      label +
      '</span>'
    );
  }

  function openLoginModal() {
    loginModal.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function closeLoginModal() {
    loginModal.hidden = true;
    document.body.style.overflow = '';
  }

  function updateAuthUI() {
    const me = catalog.me;
    const loggedIn = isStoreLoggedIn();
    const discordOk = me?.discordLinked || isStoreDiscordLinked();
    const fivemOk = me?.fivemLinked || me?.linked || isStoreFivemLinked();

    btnLogin.style.display = loggedIn ? 'none' : 'inline-flex';
    btnLogout.style.display = loggedIn ? 'inline-flex' : 'none';
    userBar.style.display = loggedIn ? 'flex' : 'none';
    if (heroActions) heroActions.style.display = loggedIn ? 'none' : 'flex';

    if (loggedIn) {
      loggedBanner.classList.remove('hidden');
      sessionChip.classList.remove('hidden');

      const name = me?.username || storeUserName();
      const coins = me?.coins ?? sessionStorage.getItem('urpStoreCoins') ?? 0;

      coinEl.textContent = coins;
      chipCoins.textContent = coins + ' 🪙';
      chipName.textContent = name;
      userName.textContent = name;

      sessionStorage.setItem('urpStoreCoins', String(coins));
      sessionStorage.setItem('urpStoreFivemLinked', fivemOk ? 'true' : 'false');
      sessionStorage.setItem('urpStoreDiscordLinked', discordOk ? 'true' : 'false');

      statusBadges.innerHTML = badge(discordOk, 'Discord') + badge(fivemOk, 'FiveM');
      chipStatus.textContent = (discordOk ? 'Discord ✓' : 'Discord ✗') + ' · ' + (fivemOk ? 'FiveM ✓' : 'FiveM ✗');

      if (canUseCoins()) {
        loggedBannerText.textContent = 'Ingelogd — je kunt kopen met coins';
        loggedBanner.classList.add('ready');
      } else {
        loggedBannerText.textContent = 'Ingelogd — koppel Discord + FiveM om te kopen';
        loggedBanner.classList.remove('ready');
      }

      const avatar = me?.avatarUrl || sessionStorage.getItem('urpStoreAvatarUrl');
      if (avatar) {
        userAvatar.src = avatar;
        userAvatar.style.display = 'block';
        chipAvatar.src = avatar;
        chipAvatar.style.display = 'block';
      } else {
        userAvatar.style.display = 'none';
        chipAvatar.style.display = 'none';
      }

      btnLinkDiscord.classList.toggle('hidden', discordOk);
      btnLink.classList.toggle('hidden', !discordOk || fivemOk);
      navAdmin.style.display = me?.isAdmin ? 'inline' : 'none';
    } else {
      loggedBanner.classList.add('hidden');
      sessionChip.classList.add('hidden');
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
        .map(function (r) {
          return (
            '<li><span class="store-recent-user">' +
            esc(r.username) +
            '</span><span class="store-recent-product">' +
            esc(r.productName) +
            '</span><span class="store-recent-time">' +
            formatTime(r.createdAt) +
            '</span></li>'
          );
        })
        .join('');
    } else {
      recentList.innerHTML = '<li class="store-recent-empty">Nog geen recente aankopen</li>';
    }
  }

  function renderCategoryTabs() {
    catTabs.innerHTML = '';

    const allBtn = document.createElement('button');
    allBtn.type = 'button';
    allBtn.className = 'store-cat-tab' + (activeCat === 'all' ? ' active' : '');
    allBtn.textContent = 'Alles';
    allBtn.onclick = function () {
      activeCat = 'all';
      renderCategoryTabs();
      renderProducts();
    };
    catTabs.appendChild(allBtn);

    catalog.categories.forEach(function (c) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'store-cat-tab' + (activeCat === c.id ? ' active' : '');
      btn.textContent = c.name;
      btn.onclick = function () {
        activeCat = c.id;
        renderCategoryTabs();
        renderProducts();
      };
      catTabs.appendChild(btn);
    });
  }

  function buyLabel() {
    if (!isStoreLoggedIn()) return 'Log in';
    if (!isStoreDiscordLinked()) return 'Koppel Discord';
    if (!isStoreFivemLinked()) return 'Koppel FiveM';
    return 'Kopen';
  }

  function canBuyProduct(price) {
    return canUseCoins() && (catalog.me?.coins || 0) >= price;
  }

  function filteredProducts() {
    let items = catalog.products.filter(function (p) {
      return activeCat === 'all' || p.categoryId === activeCat;
    });
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      items = items.filter(function (p) {
        return (
          (p.name || '').toLowerCase().includes(q) ||
          (p.description || '').toLowerCase().includes(q) ||
          (p.type || '').toLowerCase().includes(q)
        );
      });
    }
    return items;
  }

  function openProductModal(product) {
    document.getElementById('modalImage').innerHTML = imageBlock(product.image, product.name);
    document.getElementById('modalType').textContent = product.type || 'item';
    document.getElementById('modalTitle').textContent = product.name;
    document.getElementById('modalDesc').textContent = product.description || '';
    document.getElementById('modalPrice').textContent = product.price + ' coins';
    const buyBtn = document.getElementById('modalBuy');
    buyBtn.textContent = buyLabel();
    buyBtn.disabled = !canBuyProduct(product.price);
    buyBtn.onclick = function () {
      purchase(product.id);
    };
    productModal.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function closeProductModal() {
    productModal.hidden = true;
    if (loginModal.hidden) document.body.style.overflow = '';
  }

  function renderProducts() {
    const items = filteredProducts();
    document.getElementById('emptyMsg').style.display = items.length ? 'none' : 'block';
    productCount.textContent = items.length + ' producten';
    grid.innerHTML = '';

    items.forEach(function (p) {
      const pct = p.originalPrice ? discountPercent(p.price, p.originalPrice) : 0;
      const card = document.createElement('article');
      card.className = 'store-card';
      card.innerHTML =
        '<div class="store-card-image">' +
        (pct ? '<span class="store-card-badge">-' + pct + '%</span>' : '') +
        imageBlock(p.image, p.name) +
        '</div><div class="store-card-body"><span class="type-badge">' +
        esc(p.type || 'item') +
        '</span><h4>' +
        esc(p.name) +
        '</h4><p>' +
        esc(p.description || '') +
        '</p><div class="store-price-row"><span class="store-price">' +
        p.price +
        ' coins</span>' +
        (p.originalPrice && p.originalPrice > p.price
          ? '<span class="store-price-old">' + p.originalPrice + ' coins</span>'
          : '') +
        '</div><div class="store-card-actions"><button type="button" class="btn-view">Bekijken</button><button type="button" class="btn-buy">' +
        buyLabel() +
        '</button></div></div>';

      card.querySelector('.btn-buy').disabled = !canBuyProduct(p.price);
      card.querySelector('.btn-buy').onclick = function () {
        purchase(p.id);
      };
      card.querySelector('.btn-view').onclick = function () {
        openProductModal(p);
      };
      grid.appendChild(card);
    });
  }

  async function loadCatalog() {
    catalog = await storeApi('/api/store');
    if (catalog.me) {
      setStoreSession(Object.assign({}, catalog.me, { accessToken: storeAccessToken() }));
    }
    updateAuthUI();
    renderWidgets();
    renderCategoryTabs();
    renderProducts();
  }

  async function purchase(productId) {
    if (!isStoreLoggedIn()) {
      openLoginModal();
      return;
    }
    if (!canUseCoins()) {
      showToast('Koppel Discord + FiveM om te kunnen kopen.');
      return;
    }
    try {
      const res = await storeApi('/api/store-purchase', {
        method: 'POST',
        body: { productId: productId },
      });
      showToast(res.message || 'Aankoop gelukt!');
      catalog.me.coins = res.coins;
      updateAuthUI();
      renderProducts();
      closeProductModal();
      await loadCatalog();
    } catch (e) {
      showToast(e.message);
    }
  }

  btnLogin.onclick = openLoginModal;
  if (btnLoginHero) btnLoginHero.onclick = openLoginModal;
  btnLogout.onclick = function () {
    storeLogout();
  };

  document.getElementById('btnDiscordLogin').onclick = function () {
    openDiscordLogin();
  };

  btnLinkDiscord.onclick = function () {
    openDiscordLogin(storeUserId() || null);
  };

  btnLink.onclick = async function () {
    if (!isStoreLoggedIn()) {
      openLoginModal();
      return;
    }
    if (!isStoreDiscordLinked()) {
      showToast('Koppel eerst Discord.');
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

  document.querySelectorAll('.store-auth-tab').forEach(function (tab) {
    tab.onclick = function () {
      document.querySelectorAll('.store-auth-tab').forEach(function (t) {
        t.classList.remove('active');
      });
      tab.classList.add('active');
      const isDiscord = tab.dataset.authTab === 'discord';
      document.getElementById('authPanelDiscord').classList.toggle('hidden', !isDiscord);
      document.getElementById('authPanelEmail').classList.toggle('hidden', isDiscord);
    };
  });

  document.getElementById('emailLoginForm').onsubmit = async function (e) {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await emailStoreAuth('login', {
        email: fd.get('email'),
        password: fd.get('password'),
      });
      closeLoginModal();
      showToast('Ingelogd met e-mail — koppel Discord + FiveM om te kopen.');
      await loadCatalog();
    } catch (err) {
      showToast(err.message);
    }
  };

  document.getElementById('emailRegisterForm').onsubmit = async function (e) {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await emailStoreAuth('register', {
        email: fd.get('email'),
        password: fd.get('password'),
        displayName: fd.get('displayName'),
      });
      closeLoginModal();
      showToast('Account aangemaakt! Koppel nu Discord + FiveM.');
      await loadCatalog();
    } catch (err) {
      showToast(err.message);
    }
  };

  searchInput.addEventListener('input', function () {
    searchQuery = searchInput.value;
    renderProducts();
  });

  modalClose.onclick = closeProductModal;
  loginModalClose.onclick = closeLoginModal;
  productModal.addEventListener('click', function (e) {
    if (e.target === productModal) closeProductModal();
  });
  loginModal.addEventListener('click', function (e) {
    if (e.target === loginModal) closeLoginModal();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      closeProductModal();
      closeLoginModal();
    }
  });

  (async function init() {
    try {
      await handleStoreOAuthCallback();
    } catch (e) {
      showToast(e.message);
    }
    try {
      await loadCatalog();
    } catch (e) {
      showToast(e.message);
    }
  })();
})();
