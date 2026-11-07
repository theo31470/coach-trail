/* Monotrace · service worker : notifications et page hors ligne. */
const CACHE = 'monotrace-v7';
const HORS_LIGNE = '/hors-ligne';

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll([HORS_LIGNE, '/icones/icone-192.png'])).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((cles) => Promise.all(cles.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

// Navigation : réseau d'abord, page hors ligne si pas de connexion (sur le sentier…)
self.addEventListener('fetch', (e) => {
  if (e.request.mode !== 'navigate') return;
  e.respondWith(fetch(e.request).catch(() => caches.match(HORS_LIGNE)));
});

self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { corps: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.titre || 'Monotrace', {
    body: d.corps || '',
    icon: '/icones/icone-192.png',
    badge: '/icones/icone-192.png',
    tag: d.tag || 'monotrace',
    data: { url: d.url || '/app' },
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/app';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((fenetres) => {
    for (const f of fenetres) if ('focus' in f) { f.navigate(url); return f.focus(); }
    return self.clients.openWindow(url);
  }));
});
