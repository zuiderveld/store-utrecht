(function () {
  const grid = document.getElementById('productGrid');
  const catList = document.getElementById('categoryList');
  const userBar = document.getElementById('userBar');
  const coinEl = document.getElementById('coinBalance');
  const userName = document.getElementById('userName');
  const btnLogin = document.getElementById('btnLogin');
  const btnLogout = document.getElementById('btnLogout');
  const btnLink = document.getElementById('btnLinkFivem');
  const linkBox = document.getElementById('linkBox');
  const linkCode = document.getElementById('linkCode');
  const navAdmin = document.getElementById('navAdmin');
  const toast = document.getElementById('toast');

  let catalog = { categories: [], products: [], me: null };
  let activeCat = 'all';

  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 4500);
  }

  function updateAuthUI() {
    const me = catalog.me;
    const discordIn = isStoreLoggedIn();
    const fivemIn = me?.linked || isStoreFivemLinked();

    btnLogin.style.display = discordIn ? 'none' : 'inline-flex';
    btnLogout.style.display = discordIn ? 'inline-flex' : 'none';
    userBar.style.display = discordIn ? 'flex' : 'none';

    if (discordIn && me) {
      coinEl.textContent = me.coins ?? 0;
      sessionStorage.setItem('urpStoreCoins', String(me.coins ?? 0));
      sessionStorage.setItem('urpStoreFivemLinked', fivemIn ? 'true' : 'false');
      let status = 'Discord ✓';
      status += fivemIn ? ' · FiveM ✓' : ' · FiveM ✗ (koppel in-game)';
      userName.textContent = (me.username || storeUserName()) + ' — ' + status;
      btnLink.style.display = fivemIn ? 'none' : 'inline-flex';
      navAdmin.style.display = me.isAdmin ? 'inline' : 'none';
    }
  }

  function renderCategories() {
    catList.innerHTML = '';
    const allBtn = document.createElement('button');
    allBtn.type = 'button';
    allBtn.className = 'store-cat-btn' + (activeCat === 'all' ? ' active' : '');
    allBtn.textContent = 'Alles';
    allBtn.onclick = () => {
      activeCat = 'all';
      renderCategories();
      renderProducts();
    };
    catList.appendChild(allBtn);

    catalog.categories.forEach((c) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'store-cat-btn' + (activeCat === c.id ? ' active' : '');
      btn.textContent = c.name;
      btn.onclick = () => {
        activeCat = c.id;
        renderCategories();
        renderProducts();
      };
      catList.appendChild(btn);
    });
  }

  function buyLabel() {
    if (!isStoreLoggedIn()) return 'Log in met Discord';
    if (!canUseCoins()) return 'Koppel FiveM (Discord + FiveM vereist)';
    return 'Kopen';
  }

  function renderProducts() {
    const items = catalog.products.filter((p) => activeCat === 'all' || p.categoryId === activeCat);
    document.getElementById('emptyMsg').style.display = items.length ? 'none' : 'block';
    grid.innerHTML = '';

    items.forEach((p) => {
      const card = document.createElement('article');
      card.className = 'store-card';
      const canBuy = canUseCoins() && (catalog.me?.coins || 0) >= p.price;
      card.innerHTML =
        '<div class="type-badge">' +
        esc(p.type || 'item') +
        '</div><h4>' +
        esc(p.name) +
        '</h4><p>' +
        esc(p.description || '') +
        '</p><div class="store-price">' +
        p.price +
        ' coins</div>';
      const buy = document.createElement('button');
      buy.type = 'button';
      buy.className = 'btn-buy';
      buy.textContent = buyLabel();
      buy.disabled = !canBuy;
      buy.onclick = () => purchase(p.id);
      card.appendChild(buy);
      grid.appendChild(card);
    });
  }

  function esc(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  async function loadCatalog() {
    catalog = await storeApi('/api/store');
    if (catalog.me) setStoreSession({ ...catalog.me, accessToken: storeAccessToken(), linked: catalog.me.linked });
    updateAuthUI();
    renderCategories();
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
    } catch (e) {
      showToast(e.message);
    }
  }

  btnLogin.onclick = () => {
    window.location.href = getStoreDiscordAuthUrl(discordRedirectUri());
  };

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

  (async function init() {
    try {
      await handleStoreOAuthCallback();
    } catch (e) {
      showToast(e.message);
    }
    await loadCatalog();
  })();
})();
