(function () {
  'use strict';
  const A = window.A;
  A.views.more = A.views.settings;
  if (A.db.user) A.ui.view = 'home';
  A.render();
  // Android back button hook (used by the native wrapper): returns true when handled
  window.__back = function () {
    const ui = A.ui;
    if (ui.modal && ui.view !== 'live') { ui.modal = null; A.render(); return true; }
    if (ui.stack.length) { A.back(); return true; }
    if (ui.view !== 'home' && ui.view !== 'login') { ui.view = 'home'; ui.modal = null; A.render(); return true; }
    return false;
  };
  // PWA service worker (only on http/https, not inside the Android WebView file:// origin)
  if ('serviceWorker' in navigator && /^https?:/.test(location.protocol)) navigator.serviceWorker.register('sw.js').catch(() => { });
})();
