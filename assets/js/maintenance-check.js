/**
 * URP Store — onderhoud (beheer op admin.html slaat overlay over)
 */
(function () {
  var path = window.location.pathname || '';
  if (/admin\.html$/i.test(path)) return;

  function isStoreAdmin() {
    try {
      return !!sessionStorage.getItem('urpAdminToken');
    } catch (e) {
      return false;
    }
  }

  function showMaintenance(message) {
    if (document.getElementById('storeMaintOverlay')) return;
    var overlay = document.createElement('div');
    overlay.id = 'storeMaintOverlay';
    overlay.innerHTML =
      '<style>#storeMaintOverlay{position:fixed;inset:0;z-index:99999;background:#0a0a0f;display:flex;align-items:center;justify-content:center;padding:2rem;text-align:center;color:#eef2ff;font-family:Segoe UI,sans-serif}#storeMaintOverlay .box{max-width:420px}#storeMaintOverlay i{font-size:3rem;margin-bottom:1rem;display:block}#storeMaintOverlay h1{font-size:1.4rem;margin-bottom:0.75rem}#storeMaintOverlay p{color:#9ca3af;line-height:1.5}</style>' +
      '<div class="box"><span style="font-size:3rem">🛠️</span><h1>Store in onderhoud</h1><p></p></div>';
    overlay.querySelector('p').textContent = message;
    document.body.appendChild(overlay);
  }

  var apiBase = window.STORE_CONFIG && window.STORE_CONFIG.apiBase ? window.STORE_CONFIG.apiBase : '';

  fetch((apiBase || window.location.origin) + '/api/maintenance', { cache: 'no-store' })
    .then(function (r) {
      return r.json();
    })
    .then(function (state) {
      if (!state || !state.global || isStoreAdmin()) return;
      showMaintenance(
        state.message || 'De URP Store is momenteel in onderhoud. Probeer het later opnieuw.'
      );
    })
    .catch(function () {});
})();
