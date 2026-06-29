const CACHE_NAME = 'desafiohv-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/script.js',
  '/manifest.json',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap'
];

// ─── INSTALL ───
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS)).then(() => self.skipWaiting())
  );
});

// ─── ACTIVATE ───
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ─── FETCH: cache-first para assets estáticos, network-first para el resto ───
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  // Firebase y APIs externas: siempre network
  if (url.hostname.includes('firebase') || url.hostname.includes('google') && url.pathname.includes('/token')) return;

  e.respondWith(
    caches.match(e.request).then(cached => {
      const network = fetch(e.request).then(res => {
        if (res && res.status === 200 && res.type === 'basic') {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});

// ─── PUSH NOTIFICATIONS ───
self.addEventListener('push', e => {
  const data = e.data ? e.data.json() : {};
  const title = data.title || 'DesafioHV ⭐';
  const options = {
    body: data.body || 'Tenés actividades pendientes hoy.',
    icon: data.icon || '/icon-192.png',
    badge: '/icon-192.png',
    tag: data.tag || 'desafiohv-reminder',
    renotify: true,
    data: { url: data.url || '/' },
    actions: [
      { action: 'open', title: '📋 Ver hoy' },
      { action: 'dismiss', title: 'Descartar' }
    ]
  };
  e.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  if (e.action === 'dismiss') return;
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const existing = list.find(c => c.url.includes(self.location.origin));
      if (existing) return existing.focus();
      return clients.openWindow(e.notification.data.url || '/');
    })
  );
});

// ─── BACKGROUND SYNC: recordatorio diario (alarma simulada via mensaje) ───
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SCHEDULE_REMINDER') {
    // el cliente nos pide programar un recordatorio en X ms
    const { delayMs, title, body } = e.data;
    setTimeout(() => {
      self.registration.showNotification(title || 'DesafioHV ⭐', {
        body: body || '¡No olvides completar tus actividades de hoy!',
        icon: '/icon-192.png',
        tag: 'dhv-daily',
        renotify: true,
        actions: [{ action: 'open', title: '📋 Abrir app' }]
      });
    }, delayMs || 0);
  }
});
