const C = 'crictruf-v1';
const FILES = ['./', 'index.html', 'css/style.css', 'js/engine.js', 'js/core.js', 'js/live.js', 'js/views1.js', 'js/views2.js', 'js/views3.js', 'js/main.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(C).then(c => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== C).map(x => caches.delete(x))))); self.clients.claim(); });
self.addEventListener('fetch', e => { if (e.request.method !== 'GET') return; e.respondWith(caches.match(e.request).then(r => r || fetch(e.request))); });
