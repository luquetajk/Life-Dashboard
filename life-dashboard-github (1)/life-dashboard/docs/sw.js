/* LIFE DASHBOARD: service worker. Só guarda arquivos do próprio site. Nunca toca em Microsoft, Google ou qualquer outro endereço. */
const VERSION = '6153c9a225';
const CACHE = 'lifedash-' + VERSION;
const SCOPE = self.registration.scope;
const INDEX = new URL('index.html', SCOPE).href;
const CORE = ['index.html', 'app.js', 'app.css', 'config.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(CORE.map(p => fetch(new URL(p, SCOPE), { cache: 'reload' }).then(r => r.ok ? c.put(new URL(p, SCOPE).href, r) : null).catch(() => null)))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('lifedash-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin || !url.href.startsWith(SCOPE)) return;
  if (req.mode === 'navigate') {
    /* A página inicial é guardada sempre com o mesmo nome, sem ?code= nem ?state=, para o código de login nunca ir para o cache. */
    e.respondWith(fetch(req, { cache: 'no-cache' }).then(res => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(INDEX, copy)); } return res; }).catch(() => caches.match(INDEX).then(r => r || new Response('Sem internet e o app ainda não foi guardado neste aparelho.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }))));
    return;
  }
  e.respondWith(fetch(req, { cache: 'no-cache' }).then(res => { if (res.ok && res.type === 'basic' && !url.search) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); } return res; }).catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || Response.error())));
});
