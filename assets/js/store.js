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
  const modalCloseBtn = document.getElementById('modalCloseBtn');
  const loginModalClose = document.getElementById('loginModalClose');
  const heroActions = document.getElementById('heroActions');
  const btnLoginHero = document.getElementById('btnLoginHero');
  const sessionMenu = document.getElementById('sessionMenu');
  const sessionChipToggle = document.getElementById('sessionChipToggle');
  const sessionDropdown = document.getElementById('sessionDropdown');
  const chipName = document.getElementById('chipName');
  const chipStatus = document.getElementById('chipStatus');
  const chipCoins = document.getElementById('chipCoins');
  const chipAvatar = document.getElementById('chipAvatar');
  const dropdownName = document.getElementById('dropdownName');
  const dropdownStatus = document.getElementById('dropdownStatus');
  const dropdownCoins = document.getElementById('dropdownCoins');
  const dropdownAvatar = document.getElementById('dropdownAvatar');
  const dropdownAdmin = document.getElementById('dropdownAdmin');
  const btnDropdownLinkDiscord = document.getElementById('btnDropdownLinkDiscord');
  const btnDropdownLinkFivem = document.getElementById('btnDropdownLinkFivem');
  const loggedBanner = document.getElementById('loggedBanner');
  const loggedBannerText = document.getElementById('loggedBannerText');
  const btnCart = document.getElementById('btnCart');
  const cartBadge = document.getElementById('cartBadge');
  const cartDrawer = document.getElementById('cartDrawer');
  const cartBackdrop = document.getElementById('cartBackdrop');
  const cartClose = document.getElementById('cartClose');
  const cartList = document.getElementById('cartList');
  const cartEmpty = document.getElementById('cartEmpty');
  const cartItemCount = document.getElementById('cartItemCount');
  const cartTotal = document.getElementById('cartTotal');
  const cartCheckout = document.getElementById('cartCheckout');
  const camoPanel = document.getElementById('camoPanel');
  const storeLayout = document.getElementById('storeLayout');
  const camoWeaponGroups = document.getElementById('camoWeaponGroups');
  const camoGrid = document.getElementById('camoGrid');
  const camoPreviewBox = document.getElementById('camoPreviewBox');
  const camoSceneInner = document.getElementById('camoSceneInner');
  const camoWeaponImg = document.getElementById('camoWeaponImg');
  const camoSkinLayer = document.getElementById('camoSkinLayer');
  const camoPreviewPlaceholder = document.getElementById('camoPreviewPlaceholder');
  const camoPreviewActive = document.getElementById('camoPreviewActive');
  const camoPreviewActiveImg = document.getElementById('camoPreviewActiveImg');
  const camoPreviewActiveName = document.getElementById('camoPreviewActiveName');
  const camoPreviewWeapon = document.getElementById('camoPreviewWeapon');
  const camoSelectedName = document.getElementById('camoSelectedName');
  const camoSelectedPrice = document.getElementById('camoSelectedPrice');
  const camoAddCart = document.getElementById('camoAddCart');
  const camoWeaponSearch = document.getElementById('camoWeaponSearch');
  const camoUserName = document.getElementById('camoUserName');
  const camoCoinBalance = document.getElementById('camoCoinBalance');

  let catalog = { categories: [], products: [], me: null, recentPurchases: [], topBuyer: null };
  let activeCat = 'all';
  let searchQuery = '';
  let cart = [];
  let camoSelectedWeapon = null;
  let camoSelectedCamo = null;
  let camoWeaponFilter = '';
  let camoPreviewRotation = 0;
  let camoPreviewScale = 1;
  let camoPreviewTilt = -8;
  const CART_KEY = 'urpStoreCart';

  function loadCart() {
    try {
      const raw = sessionStorage.getItem(CART_KEY);
      cart = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(cart)) cart = [];
    } catch (_) {
      cart = [];
    }
  }

  function saveCart() {
    sessionStorage.setItem(CART_KEY, JSON.stringify(cart));
    updateCartUI();
  }

  function pruneCart() {
    const valid = cart.filter(function (id) {
      return Boolean(getProductById(id));
    });
    if (valid.length !== cart.length) {
      cart = valid;
      sessionStorage.setItem(CART_KEY, JSON.stringify(cart));
    }
  }

  function getProductById(id) {
    return catalog.products.find(function (p) {
      return p.id === id;
    });
  }

  function isExternalLinkProduct(p) {
    return p && p.type === 'external_link';
  }

  function externalLinkUrl(p) {
    return (p && p.meta && (p.meta.externalUrl || p.meta.url)) || '';
  }

  function externalLinkLabel(p) {
    return (p && p.meta && p.meta.buttonLabel) || 'Naar Discord';
  }

  function externalPriceUnit(p) {
    var unit = p && p.meta && p.meta.priceUnit;
    return unit == null || unit === '' ? '€' : String(unit);
  }

  function formatExternalPriceText(p) {
    var price = Number(p.price) || 0;
    var orig = Number(p.originalPrice) || 0;
    var unit = externalPriceUnit(p);
    if (price <= 0 && orig <= 0) return '';
    var main = price > 0 ? price : orig;
    var suffix = unit === '€' ? ' €' : unit ? ' ' + unit : '';
    return main + suffix;
  }

  function externalPriceHtml(p) {
    var price = Number(p.price) || 0;
    var orig = Number(p.originalPrice) || 0;
    var unit = externalPriceUnit(p);
    if (price <= 0 && orig <= 0) {
      return '<span class="store-price store-price-external">Via link</span>';
    }
    var suffix = unit === '€' ? ' €' : unit ? ' ' + unit : '';
    var html = '<span class="store-price">' + (price > 0 ? price : orig) + suffix + '</span>';
    if (orig > 0 && price > 0 && orig > price) {
      html += '<span class="store-price-old">' + orig + suffix + '</span>';
    }
    return html;
  }

  function externalModalPriceText(p) {
    var text = formatExternalPriceText(p);
    return text || 'Via externe link';
  }

  function typeLabel(p) {
    if (isExternalLinkProduct(p)) return 'doorverwijzing';
    if (p.type === 'weapon_camo') return 'camo';
    return p.type || 'item';
  }

  function isCamoCategory(catId) {
    if (!catId || catId === 'all') return false;
    var cat = catalog.categories.find(function (c) {
      return c.id === catId;
    });
    if (!cat) return false;
    if (cat.slug === 'camo' || cat.id === 'camo' || /camo/i.test(cat.name || '')) return true;
    return catalog.products.some(function (p) {
      return p.categoryId === catId && p.type === 'weapon_camo' && p.active !== false;
    });
  }

  function getCamoCatalog() {
    return window.URP_CAMO_CATALOG || { weapons: [], camos: [], groupOrder: [] };
  }

  function getCamoProducts() {
    return catalog.products.filter(function (p) {
      if (p.active === false) return false;
      if (activeCat !== 'all' && p.categoryId !== activeCat) return false;
      return p.type === 'weapon_camo' || (p.meta && p.meta.camoId && p.meta.weapon);
    });
  }

  function findCamoProduct(weapon, camoId) {
    var w = String(weapon || '').toUpperCase();
    var c = String(camoId || '').toLowerCase();
    return getCamoProducts().find(function (p) {
      var meta = p.meta || {};
      return String(meta.weapon || '').toUpperCase() === w && String(meta.camoId || '').toLowerCase() === c;
    });
  }

  function getCatalogWeapons() {
    var cat = getCamoCatalog();
    var list = cat.weapons || [];
    var q = camoWeaponFilter.trim().toLowerCase();
    if (!q) return list;
    return list.filter(function (w) {
      return (
        w.label.toLowerCase().includes(q) ||
        w.weapon.toLowerCase().includes(q) ||
        w.group.toLowerCase().includes(q)
      );
    });
  }

  function weaponThumbSrc(weapon) {
    var cat = getCamoCatalog();
    if (cat.weaponImage) return cat.weaponImage(weapon);
    return (cat.weaponImageBase || 'assets/images/weapons/') + weapon + '.png';
  }

  function camoThumbStyle(camo) {
    if (camo.css) return 'background:' + camo.css;
    return '';
  }

  function camoThumbHtml(camo) {
    var cat = getCamoCatalog();
    var img = cat.camoImage ? cat.camoImage(camo.camoId) : (cat.camoImageBase || '') + camo.camoId + '.png';
    return (
      '<span class="store-camo-tile-thumb">' +
      '<span class="store-camo-tile-thumb-inner" style="' +
      esc(camoThumbStyle(camo)) +
      '"><img src="' +
      esc(img) +
      '" alt="" onerror="this.style.display=\'none\'"></span></span>'
    );
  }

  function updateCamoEditorHeader() {
    if (camoUserName) {
      camoUserName.textContent =
        catalog.me?.globalName || catalog.me?.username || catalog.me?.displayName || 'Gast';
    }
    if (camoCoinBalance) {
      camoCoinBalance.textContent = String(catalog.me?.coins ?? 0);
    }
  }

  function updateCamoBuyBar() {
    if (!camoAddCart) return;
    var product = camoSelectedWeapon && camoSelectedCamo
      ? findCamoProduct(camoSelectedWeapon.weapon, camoSelectedCamo.camoId)
      : null;

    if (!camoSelectedCamo || !camoSelectedWeapon) {
      if (camoSelectedName) camoSelectedName.textContent = 'Geen camo';
      if (camoSelectedPrice) camoSelectedPrice.textContent = '';
      camoAddCart.disabled = true;
      camoAddCart.textContent = '🛒 Toevoegen';
      return;
    }

    var label = camoSelectedCamo.name + ' — ' + camoSelectedWeapon.label;
    if (camoSelectedName) camoSelectedName.textContent = label;

    if (!product) {
      if (camoSelectedPrice) {
        camoSelectedPrice.textContent = 'Nog niet in store (' + camoSelectedCamo.price + ' coins voorstel)';
      }
      camoAddCart.disabled = true;
      camoAddCart.textContent = 'Nog niet te koop';
      return;
    }

    if (camoSelectedPrice) camoSelectedPrice.textContent = product.price + ' coins';
    var inCart = isInCart(product.id);
    camoAddCart.disabled = inCart || !canAddToCart(product.id);
    camoAddCart.textContent = inCart ? 'In winkelwagen ✓' : '🛒 Toevoegen';
  }

  function applyCamoSceneTransform() {
    if (!camoSceneInner) return;
    camoSceneInner.style.transform =
      'rotateX(' +
      camoPreviewTilt +
      'deg) rotateY(' +
      camoPreviewRotation +
      'deg) scale(' +
      camoPreviewScale +
      ')';
  }

  function updateCamoPreview() {
    if (!camoWeaponImg || !camoPreviewPlaceholder) return;
    applyCamoSceneTransform();

    if (camoPreviewWeapon) {
      camoPreviewWeapon.textContent = camoSelectedWeapon
        ? camoSelectedWeapon.label
        : '—';
    }

    if (!camoSelectedWeapon) {
      camoWeaponImg.hidden = true;
      if (camoSkinLayer) camoSkinLayer.hidden = true;
      camoPreviewPlaceholder.hidden = false;
      if (camoPreviewActive) camoPreviewActive.hidden = true;
      updateCamoBuyBar();
      return;
    }

    camoPreviewPlaceholder.hidden = true;
    var weaponSrc = weaponThumbSrc(camoSelectedWeapon.weapon);
    camoWeaponImg.onload = function () {
      camoWeaponImg.hidden = false;
      camoPreviewPlaceholder.hidden = true;
    };
    camoWeaponImg.onerror = function () {
      camoWeaponImg.hidden = true;
      camoPreviewPlaceholder.hidden = false;
      var hint = camoPreviewPlaceholder.querySelector('p');
      if (hint) {
        hint.innerHTML =
          'PNG ontbreekt op server<br><code>assets/images/weapons/' +
          camoSelectedWeapon.weapon +
          '.png</code><br><small>Upload + redeploy Vercel</small>';
      }
    };
    camoWeaponImg.src = weaponSrc;
    camoWeaponImg.alt = camoSelectedWeapon.label;

    if (camoSkinLayer && camoSelectedCamo) {
      var cat = getCamoCatalog();
      var camoImg = cat.camoImage ? cat.camoImage(camoSelectedCamo.camoId) : '';
      camoSkinLayer.hidden = false;
      camoSkinLayer.style.background = camoSelectedCamo.css || 'transparent';
      camoSkinLayer.style.backgroundImage = camoImg ? 'url("' + camoImg + '"), ' + (camoSelectedCamo.css || 'none') : (camoSelectedCamo.css || 'none');
    } else if (camoSkinLayer) {
      camoSkinLayer.hidden = true;
    }

    if (camoPreviewActive && camoPreviewActiveImg && camoPreviewActiveName && camoSelectedCamo) {
      camoPreviewActiveImg.src = (getCamoCatalog().camoImage && getCamoCatalog().camoImage(camoSelectedCamo.camoId)) || '';
      camoPreviewActiveImg.onerror = function () {
        camoPreviewActiveImg.style.background = camoSelectedCamo.css || '#333';
      };
      camoPreviewActiveName.textContent = camoSelectedCamo.name;
      camoPreviewActive.hidden = false;
    } else if (camoPreviewActive) {
      camoPreviewActive.hidden = true;
    }

    updateCamoBuyBar();
  }

  function selectCamoWeapon(entry) {
    camoSelectedWeapon = entry;
    if (!camoSelectedCamo) {
      var camos = getCamoCatalog().camos || [];
      if (camos.length) camoSelectedCamo = camos[0];
    }
    renderCamoWeaponList();
    renderCamoGrid();
    updateCamoPreview();
  }

  function selectCamoSkin(camo) {
    camoSelectedCamo = camo;
    renderCamoGrid();
    updateCamoPreview();
  }

  function renderCamoWeaponList() {
    if (!camoWeaponGroups) return;
    var cat = getCamoCatalog();
    var weapons = getCatalogWeapons();
    var groupOrder = cat.groupOrder || [];
    var grouped = {};

    weapons.forEach(function (w) {
      if (!grouped[w.group]) grouped[w.group] = [];
      grouped[w.group].push(w);
    });

    var groupNames = groupOrder.filter(function (g) {
      return grouped[g] && grouped[g].length;
    });
    Object.keys(grouped).forEach(function (g) {
      if (groupNames.indexOf(g) === -1) groupNames.push(g);
    });

    if (!camoSelectedWeapon && weapons.length) {
      camoSelectedWeapon = weapons[0];
    }

    camoWeaponGroups.innerHTML = weapons.length
      ? groupNames
          .map(function (groupName) {
            var list = grouped[groupName].sort(function (a, b) {
              return a.label.localeCompare(b.label, 'nl');
            });
            return (
              '<div class="store-camo-group"><div class="store-camo-group-label">' +
              esc(groupName) +
              '</div><div class="store-camo-weapon-list">' +
              list
                .map(function (w) {
                  var active =
                    camoSelectedWeapon && camoSelectedWeapon.weapon === w.weapon ? ' active' : '';
                  return (
                    '<button type="button" class="store-camo-weapon-btn' +
                    active +
                    '" data-weapon="' +
                    esc(w.weapon) +
                    '"><span class="store-camo-weapon-thumb"><img src="' +
                    esc(weaponThumbSrc(w.weapon)) +
                    '" alt="" loading="lazy" onerror="this.parentElement.classList.add(\'fallback\')"></span><span class="store-camo-weapon-label">' +
                    esc(w.label) +
                    '</span></button>'
                  );
                })
                .join('') +
              '</div></div>'
            );
          })
          .join('')
      : '<p class="store-camo-empty">Geen wapens gevonden.</p>';

    camoWeaponGroups.querySelectorAll('.store-camo-weapon-btn').forEach(function (btn) {
      btn.onclick = function () {
        var weapon = btn.dataset.weapon;
        var found = (cat.weapons || []).find(function (w) {
          return w.weapon === weapon;
        });
        if (found) selectCamoWeapon(found);
      };
    });
  }

  function renderCamoGrid() {
    if (!camoGrid) return;
    var camos = getCamoCatalog().camos || [];

    if (!camoSelectedCamo && camos.length) camoSelectedCamo = camos[0];

    camoGrid.innerHTML = camos.length
      ? camos
          .map(function (c) {
            var active = camoSelectedCamo && camoSelectedCamo.camoId === c.camoId ? ' active' : '';
            var product = camoSelectedWeapon ? findCamoProduct(camoSelectedWeapon.weapon, c.camoId) : null;
            var price = product ? product.price + ' 🪙' : c.price + ' 🪙';
            return (
              '<button type="button" class="store-camo-tile' +
              active +
              '" data-camo-id="' +
              esc(c.camoId) +
              '">' +
              camoThumbHtml(c) +
              '<span class="store-camo-tile-name">' +
              esc(c.name) +
              '</span><span class="store-camo-tile-price">' +
              price +
              '</span></button>'
            );
          })
          .join('')
      : '<p class="store-camo-empty">Geen camo\'s geconfigureerd.</p>';

    camoGrid.querySelectorAll('.store-camo-tile').forEach(function (tile) {
      tile.onclick = function () {
        var id = tile.dataset.camoId;
        var camo = camos.find(function (c) {
          return c.camoId === id;
        });
        if (camo) selectCamoSkin(camo);
      };
    });
  }

  function renderCamoPanel() {
    if (!camoPanel) return;
    updateCamoEditorHeader();
    renderCamoWeaponList();
    renderCamoGrid();
    updateCamoPreview();
  }

  function initCamoPreviewControls() {
    if (!camoPreviewBox || camoPreviewBox.dataset.bound) return;
    camoPreviewBox.dataset.bound = '1';
    var dragging = false;
    var lastX = 0;

    camoPreviewBox.addEventListener('mousedown', function (e) {
      dragging = true;
      lastX = e.clientX;
      camoPreviewBox.classList.add('dragging');
    });
    window.addEventListener('mouseup', function () {
      dragging = false;
      camoPreviewBox.classList.remove('dragging');
    });
    window.addEventListener('mousemove', function (e) {
      if (!dragging) return;
      camoPreviewRotation += (e.clientX - lastX) * 0.5;
      lastX = e.clientX;
      applyCamoSceneTransform();
    });
    camoPreviewBox.addEventListener(
      'wheel',
      function (e) {
        e.preventDefault();
        camoPreviewScale = Math.min(1.8, Math.max(0.55, camoPreviewScale + (e.deltaY < 0 ? 0.06 : -0.06)));
        applyCamoSceneTransform();
      },
      { passive: false }
    );

    if (camoWeaponSearch) {
      camoWeaponSearch.addEventListener('input', function () {
        camoWeaponFilter = camoWeaponSearch.value || '';
        renderCamoWeaponList();
      });
    }

    if (camoAddCart) {
      camoAddCart.onclick = function () {
        if (!camoSelectedWeapon || !camoSelectedCamo) return;
        var product = findCamoProduct(camoSelectedWeapon.weapon, camoSelectedCamo.camoId);
        if (!product) return showToast('Dit camo is nog niet als product in de store gezet.');
        addToCart(product.id);
        updateCamoBuyBar();
      };
    }
  }

  function openExternalLink(p) {
    const url = externalLinkUrl(p);
    if (!url) {
      showToast('Geen link geconfigureerd voor dit product.');
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  function cartTotalCoins() {
    return cart.reduce(function (sum, id) {
      const p = getProductById(id);
      return sum + (p ? Number(p.price) || 0 : 0);
    }, 0);
  }

  function isInCart(productId) {
    return cart.indexOf(productId) !== -1;
  }

  function updateCartUI() {
    const count = cart.length;
    cartBadge.textContent = count;
    cartBadge.classList.toggle('hidden', count === 0);
    btnCart.classList.toggle('has-items', count > 0);

    const total = cartTotalCoins();
    cartItemCount.textContent = count;
    cartTotal.textContent = total + ' coins';
    cartEmpty.style.display = count ? 'none' : 'block';
    cartList.style.display = count ? 'block' : 'none';

    cartList.innerHTML = cart
      .map(function (id, index) {
        const p = getProductById(id);
        if (!p) {
          return (
            '<li class="store-cart-row store-cart-row-missing"><span>Product niet meer beschikbaar</span><button type="button" class="store-cart-remove" data-index="' +
            index +
            '" aria-label="Verwijderen">&times;</button></li>'
          );
        }
        return (
          '<li class="store-cart-row"><div class="store-cart-row-info"><strong>' +
          esc(p.name) +
          '</strong><span>' +
          p.price +
          ' coins</span></div><button type="button" class="store-cart-remove" data-index="' +
          index +
          '" aria-label="Verwijderen">&times;</button></li>'
        );
      })
      .join('');

    cartList.querySelectorAll('.store-cart-remove').forEach(function (btn) {
      btn.onclick = function () {
        cart.splice(Number(btn.dataset.index), 1);
        saveCart();
        renderProducts();
      };
    });

    const canCheckout = count > 0 && canUseCoins() && (catalog.me?.coins || 0) >= total;
    cartCheckout.disabled = !canCheckout;
    cartCheckout.textContent = checkoutLabel(total);
    if (typeof updateCamoBuyBar === 'function') updateCamoBuyBar();
  }

  function checkoutLabel(total) {
    if (!cart.length) return 'Afrekenen';
    if (!isStoreLoggedIn()) return 'Log in om af te rekenen';
    if (!isStoreDiscordLinked()) return 'Koppel Discord';
    if (!isStoreFivemLinked()) return 'Koppel FiveM';
    if ((catalog.me?.coins || 0) < total) return 'Onvoldoende coins';
    return 'Afrekenen (' + total + ' coins)';
  }

  function cartActionLabel() {
    return 'In winkelwagen';
  }

  function canAddToCart(productId) {
    const product = getProductById(productId);
    if (!product || isExternalLinkProduct(product)) return false;
    return !isInCart(productId);
  }

  function openCart() {
    updateCartUI();
    cartDrawer.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function closeCart() {
    cartDrawer.hidden = true;
    if (productModal.hidden && loginModal.hidden) document.body.style.overflow = '';
  }

  function addToCart(productId) {
    const product = getProductById(productId);
    if (!product) {
      showToast('Product niet gevonden.');
      return;
    }
    if (isExternalLinkProduct(product)) {
      openExternalLink(product);
      return;
    }
    if (isInCart(productId)) {
      showToast('Staat al in je winkelwagen.');
      openCart();
      return;
    }
    cart.push(productId);
    saveCart();
    renderProducts();
    showToast('Toegevoegd aan winkelwagen');
  }

  async function checkoutCart() {
    if (!cart.length) {
      showToast('Winkelwagen is leeg.');
      return;
    }
    if (!isStoreLoggedIn()) {
      openLoginModal();
      return;
    }
    if (!canUseCoins()) {
      showToast('Koppel Discord + FiveM om te kunnen kopen.');
      return;
    }
    const total = cartTotalCoins();
    if ((catalog.me?.coins || 0) < total) {
      showToast('Onvoldoende coins.');
      return;
    }
    const ids = cart.filter(function (id) {
      return Boolean(getProductById(id));
    });
    if (!ids.length) {
      showToast('Geen geldige producten in winkelwagen.');
      cart = [];
      saveCart();
      return;
    }
    cartCheckout.disabled = true;
    try {
      const res = await storeApi('/api/store-purchase-cart', {
        method: 'POST',
        body: { productIds: ids },
      });
      cart = [];
      saveCart();
      closeCart();
      closeProductModal();
      showToast(res.message || 'Aankoop gelukt!');
      catalog.me.coins = res.coins;
      updateAuthUI();
      renderProducts();
      await loadCatalog();
    } catch (e) {
      showToast(e.message);
    } finally {
      cartCheckout.disabled = false;
      updateCartUI();
    }
  }

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

  function closeSessionMenu() {
    sessionDropdown.hidden = true;
    sessionChipToggle.setAttribute('aria-expanded', 'false');
    sessionMenu.classList.remove('open');
  }

  function toggleSessionMenu() {
    const open = sessionDropdown.hidden;
    if (open) {
      sessionDropdown.hidden = false;
      sessionChipToggle.setAttribute('aria-expanded', 'true');
      sessionMenu.classList.add('open');
    } else {
      closeSessionMenu();
    }
  }

  function updateAuthUI() {
    const me = catalog.me;
    const loggedIn = isStoreLoggedIn();
    const discordOk = me?.discordLinked || isStoreDiscordLinked();
    const fivemOk = me?.fivemLinked || me?.linked || isStoreFivemLinked();

    btnLogin.style.display = loggedIn ? 'none' : 'inline-flex';
    userBar.style.display = loggedIn ? 'flex' : 'none';
    if (heroActions) heroActions.style.display = loggedIn ? 'none' : 'flex';

    if (loggedIn) {
      loggedBanner.classList.remove('hidden');
      sessionMenu.classList.remove('hidden');

      const name = me?.username || storeUserName();
      const coins = me?.coins ?? sessionStorage.getItem('urpStoreCoins') ?? 0;
      const statusText =
        (discordOk ? 'Discord ✓' : 'Discord ✗') + ' · ' + (fivemOk ? 'FiveM ✓' : 'FiveM ✗');

      coinEl.textContent = coins;
      chipCoins.textContent = coins + ' 🪙';
      chipName.textContent = name;
      userName.textContent = name;
      dropdownName.textContent = name;
      dropdownCoins.textContent = coins + ' 🪙';
      dropdownStatus.textContent = statusText;

      sessionStorage.setItem('urpStoreCoins', String(coins));
      sessionStorage.setItem('urpStoreFivemLinked', fivemOk ? 'true' : 'false');
      sessionStorage.setItem('urpStoreDiscordLinked', discordOk ? 'true' : 'false');

      statusBadges.innerHTML = badge(discordOk, 'Discord') + badge(fivemOk, 'FiveM');
      chipStatus.textContent = statusText;

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
        dropdownAvatar.src = avatar;
        dropdownAvatar.style.display = 'block';
      } else {
        userAvatar.style.display = 'none';
        chipAvatar.style.display = 'none';
        dropdownAvatar.style.display = 'none';
      }

      btnLinkDiscord.classList.toggle('hidden', discordOk);
      btnLink.classList.toggle('hidden', !discordOk || fivemOk);
      btnDropdownLinkDiscord.classList.toggle('hidden', discordOk);
      btnDropdownLinkFivem.classList.toggle('hidden', !discordOk || fivemOk);
      updateCartUI();
    } else {
      loggedBanner.classList.add('hidden');
      sessionMenu.classList.add('hidden');
      closeSessionMenu();
      stopLiveRefresh();
    }
    updateCamoEditorHeader();
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

  function setModalPriceDisplay(product) {
    var priceEl = document.getElementById('modalPrice');
    var oldEl = document.getElementById('modalPriceOld');
    var external = isExternalLinkProduct(product);

    if (external) {
      priceEl.textContent = externalModalPriceText(product);
      var orig = Number(product.originalPrice) || 0;
      var price = Number(product.price) || 0;
      var suffix = externalPriceUnit(product) === '€' ? ' €' : externalPriceUnit(product) ? ' ' + externalPriceUnit(product) : '';
      if (orig > 0 && price > 0 && orig > price) {
        oldEl.textContent = orig + suffix;
        oldEl.hidden = false;
      } else {
        oldEl.hidden = true;
        oldEl.textContent = '';
      }
    } else {
      priceEl.textContent = product.price + ' coins';
      if (product.originalPrice && product.originalPrice > product.price) {
        oldEl.textContent = product.originalPrice + ' coins';
        oldEl.hidden = false;
      } else {
        oldEl.hidden = true;
        oldEl.textContent = '';
      }
    }
  }

  function openProductModal(product) {
    document.getElementById('modalImage').innerHTML = imageBlock(product.image, product.name);
    document.getElementById('modalTitle').textContent = product.name;
    document.getElementById('modalDesc').textContent = product.description || 'Geen beschrijving.';
    setModalPriceDisplay(product);
    const buyBtn = document.getElementById('modalAddCart');
    const external = isExternalLinkProduct(product);

    if (external) {
      buyBtn.textContent = externalLinkLabel(product);
      buyBtn.className = 'btn-buy btn-external';
      buyBtn.disabled = !externalLinkUrl(product);
      buyBtn.onclick = function () {
        openExternalLink(product);
      };
    } else {
      buyBtn.textContent = isInCart(product.id) ? 'In winkelwagen ✓' : '🛒 Toevoegen';
      buyBtn.className = 'btn-buy';
      buyBtn.disabled = !canAddToCart(product.id);
      buyBtn.onclick = function () {
        addToCart(product.id);
        buyBtn.textContent = 'In winkelwagen ✓';
        buyBtn.disabled = true;
      };
    }
    productModal.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function closeProductModal() {
    productModal.hidden = true;
    if (loginModal.hidden && cartDrawer.hidden) document.body.style.overflow = '';
  }

  function renderProducts() {
    const camoMode = isCamoCategory(activeCat);
    const emptyMsg = document.getElementById('emptyMsg');

    if (camoPanel) {
      camoPanel.classList.toggle('hidden', !camoMode);
      camoPanel.setAttribute('aria-hidden', camoMode ? 'false' : 'true');
    }
    if (grid) grid.style.display = camoMode ? 'none' : '';

    if (storeLayout) storeLayout.classList.toggle('store-layout-camo', camoMode);

    if (camoMode) {
      initCamoPreviewControls();
      renderCamoPanel();
      var wCount = (getCamoCatalog().weapons || []).length;
      var cCount = (getCamoCatalog().camos || []).length;
      productCount.textContent = wCount + ' wapens · ' + cCount + ' camo\u2019s';
      if (emptyMsg) emptyMsg.style.display = 'none';
      return;
    }

    const items = filteredProducts();
    if (emptyMsg) {
      emptyMsg.style.display = items.length ? 'none' : 'block';
      emptyMsg.textContent = 'Geen producten gevonden in deze categorie.';
    }
    productCount.textContent = items.length + ' producten';
    grid.innerHTML = '';

    items.forEach(function (p) {
      const external = isExternalLinkProduct(p);
      const card = document.createElement('article');
      card.className = 'store-card store-card-clickable' + (external ? ' store-card-external' : '');
      const pct = !external && p.originalPrice ? discountPercent(p.price, p.originalPrice) : 0;
      const priceHtml = external
        ? externalPriceHtml(p)
        : '<span class="store-price">' +
          p.price +
          ' coins</span>' +
          (p.originalPrice && p.originalPrice > p.price
            ? '<span class="store-price-old">' + p.originalPrice + ' coins</span>'
            : '');
      const actionsHtml = external
        ? '<button type="button" class="btn-view">Bekijken</button><button type="button" class="btn-external">' +
          esc(externalLinkLabel(p)) +
          '</button>'
        : '<button type="button" class="btn-view">Bekijken</button><button type="button" class="btn-buy">' +
          (isInCart(p.id) ? 'In winkelwagen ✓' : cartActionLabel()) +
          '</button>';
      card.innerHTML =
        '<div class="store-card-image">' +
        (pct && !external ? '<span class="store-card-badge">-' + pct + '%</span>' : '') +
        imageBlock(p.image, p.name) +
        '</div><div class="store-card-body"><span class="type-badge">' +
        esc(typeLabel(p)) +
        '</span><h4>' +
        esc(p.name) +
        '</h4><p>' +
        esc(p.description || '') +
        '</p><div class="store-price-row">' +
        priceHtml +
        '</div><div class="store-card-actions">' +
        actionsHtml +
        '</div></div>';

      if (external) {
        card.querySelector('.btn-external').disabled = !externalLinkUrl(p);
        card.querySelector('.btn-external').onclick = function (e) {
          e.stopPropagation();
          openExternalLink(p);
        };
      } else {
        card.querySelector('.btn-buy').disabled = !canAddToCart(p.id);
        card.querySelector('.btn-buy').onclick = function (e) {
          e.stopPropagation();
          addToCart(p.id);
        };
      }
      card.querySelector('.btn-view').onclick = function (e) {
        e.stopPropagation();
        openProductModal(p);
      };
      card.addEventListener('click', function (e) {
        if (e.target.closest('.store-card-actions')) return;
        openProductModal(p);
      });
      grid.appendChild(card);
    });
  }

  async function loadCatalog() {
    catalog = await storeApi('/api/store');
    pruneCart();
    if (catalog.me) {
      setStoreSession(Object.assign({}, catalog.me, { accessToken: storeAccessToken() }));
    }
    updateAuthUI();
    renderWidgets();
    renderCategoryTabs();
    renderProducts();
    updateCartUI();
    lastKnownCoins = catalog.me?.coins ?? null;
    startLiveRefresh();
  }

  let liveRefreshTimer = null;
  let liveFullTimer = null;
  let lastKnownCoins = null;

  async function refreshLiveData(full) {
    if (!isStoreLoggedIn()) return;
    try {
      const data = await storeApi('/api/store');
      const prevCoins = catalog.me?.coins;
      const prevLinked = catalog.me?.linked;

      if (full || !catalog.categories.length) {
        catalog.categories = data.categories || catalog.categories;
        catalog.products = data.products || catalog.products;
        renderCategoryTabs();
        renderProducts();
      }

      if (data.me) {
        catalog.me = data.me;
        setStoreSession(Object.assign({}, data.me, { accessToken: storeAccessToken() }));
      }
      catalog.recentPurchases = data.recentPurchases || catalog.recentPurchases;
      catalog.topBuyer = data.topBuyer || catalog.topBuyer;

      const newCoins = catalog.me?.coins;
      if (lastKnownCoins != null && newCoins != null && lastKnownCoins !== newCoins) {
        sessionChipToggle.classList.remove('coins-updated');
        void sessionChipToggle.offsetWidth;
        sessionChipToggle.classList.add('coins-updated');
      }
      if (newCoins != null) lastKnownCoins = newCoins;

      updateAuthUI();
      renderWidgets();
      updateCartUI();

      if (
        prevCoins !== catalog.me?.coins ||
        prevLinked !== catalog.me?.linked ||
        prevLinked !== catalog.me?.fivemLinked
      ) {
        renderProducts();
      }
    } catch (_) {
      /* stille retry bij volgende poll */
    }
  }

  function startLiveRefresh() {
    if (liveRefreshTimer) clearInterval(liveRefreshTimer);
    if (!isStoreLoggedIn()) return;

    liveRefreshTimer = setInterval(function () {
      refreshLiveData(false);
    }, 12000);

    liveFullTimer = setInterval(function () {
      refreshLiveData(true);
    }, 60000);

    document.addEventListener('visibilitychange', onStoreVisibility);
  }

  function stopLiveRefresh() {
    if (liveRefreshTimer) {
      clearInterval(liveRefreshTimer);
      liveRefreshTimer = null;
    }
    if (liveFullTimer) {
      clearInterval(liveFullTimer);
      liveFullTimer = null;
    }
    document.removeEventListener('visibilitychange', onStoreVisibility);
  }

  function onStoreVisibility() {
    if (document.visibilityState === 'visible' && isStoreLoggedIn()) {
      refreshLiveData(true);
    }
  }

  btnCart.onclick = openCart;
  cartClose.onclick = closeCart;
  cartBackdrop.onclick = closeCart;
  cartCheckout.onclick = checkoutCart;

  btnLogin.onclick = openLoginModal;
  if (btnLoginHero) btnLoginHero.onclick = openLoginModal;

  sessionChipToggle.onclick = function (e) {
    e.stopPropagation();
    toggleSessionMenu();
  };

  document.addEventListener('click', function () {
    closeSessionMenu();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeSessionMenu();
  });

  sessionDropdown.addEventListener('click', function (e) {
    e.stopPropagation();
  });

  btnLogout.onclick = function () {
    closeSessionMenu();
    storeLogout();
  };

  btnDropdownLinkDiscord.onclick = function () {
    closeSessionMenu();
    openDiscordLogin(storeUserId() || null);
  };

  btnDropdownLinkFivem.onclick = async function () {
    closeSessionMenu();
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

  if (modalCloseBtn) modalCloseBtn.onclick = closeProductModal;
  loginModalClose.onclick = closeLoginModal;
  productModal.addEventListener('click', function (e) {
    if (e.target === productModal) closeProductModal();
  });
  var productModalInner = productModal.querySelector('.store-product-modal');
  if (productModalInner) {
    productModalInner.addEventListener('click', function (e) {
      e.stopPropagation();
    });
  }
  loginModal.addEventListener('click', function (e) {
    if (e.target === loginModal) closeLoginModal();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      closeProductModal();
      closeLoginModal();
      closeCart();
    }
  });

  loadCart();

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
