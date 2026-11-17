const CACHE = 'night-studios-dev';
const SHELL = ['./', './run/', './watch/', './heist/', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png', './icons/favicon-32.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameSite = url.origin === self.location.origin;
  const font = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (!sameSite && !font) return; // logins, saves and leaderboards go straight to the network
  if (sameSite && url.pathname.endsWith('/versions.json')) return;

  if (font) { // fonts never change: cache first
    e.respondWith(caches.open(CACHE).then(async c => (await c.match(req)) || fetch(req).then(res => { c.put(req, res.clone()); return res; })));
    return;
  }
  // Pages and files: network first, saved copy if offline or the network takes too long.
  // A page is saved under its own address without the ?query, so each game keeps its own copy.
  e.respondWith(caches.open(CACHE).then(async cache => {
    const key = req.mode === 'navigate' ? url.origin + url.pathname : req;
    try {
      const res = await Promise.race([fetch(req, { cache: 'no-cache' }), new Promise((_, rej) => setTimeout(() => rej(new Error('slow')), 4000))]);
      if (res && res.ok) cache.put(key, res.clone());
      return res;
    } catch (err) {
      const hit = await cache.match(key, { ignoreSearch: true });
      return hit || Response.error();
    }
  }));
});
