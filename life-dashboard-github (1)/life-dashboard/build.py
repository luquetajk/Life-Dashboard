#!/usr/bin/env python3
"""Monta life-dashboard.html (página do artefato) e standalone.html (arquivo completo para hospedar)."""
import re, sys, os, shutil, hashlib, json, zipfile
D = os.path.dirname(os.path.abspath(__file__)) + '/'
rd = lambda f: open(D + f, encoding='utf-8').read()

head = rd('head.html')
js = '\n'.join(rd(f) for f in ['logic.js', 'ui1.js', 'ui2.js', 'ui3.js', 'ui4.js'])
assert '</script' not in js.lower(), 'JS contém fechamento de script'

# o bloco <style> do head recebe um id para o app poder se exportar sozinho
head_id = head.replace('<style>', '<style id="ld-css">', 1)
css = re.search(r'<style id="ld-css">(.*?)</style>', head_id, re.S).group(1)

page = head_id + '\n<div id="app"></div>\n<div id="modal-root"></div>\n<div id="toast-root" aria-live="polite"></div>\n<script id="ld-js">\n' + js + '\n</script>\n'
open(D + 'life-dashboard.html', 'w', encoding='utf-8').write(page)

fonts = re.search(r'<link rel="stylesheet" href="(https://fonts\.googleapis\.com[^"]+)">', head).group(1)
standalone = ('<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">'
              '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
              '<title>LIFE DASHBOARD</title><link rel="stylesheet" href="' + fonts + '"><style>' + css + '</style></head>'
              '<body><div id="app"></div><div id="modal-root"></div><div id="toast-root" aria-live="polite"></div>'
              '<script>\n' + js + '\n</script></body></html>')
open(D + 'standalone.html', 'w', encoding='utf-8').write(standalone)
print('page %.0f KB | standalone %.0f KB | js %d linhas' % (len(page) / 1024, len(standalone) / 1024, js.count('\n')))


# ------------------------------------------------------------------ pacote de hospedagem HTTPS
DIST = D + os.environ.get('LD_OUT', 'dist').strip('/') + '/'  # pasta de saída: dist (padrão) ou docs (GitHub Pages)
if os.path.isdir(DIST): shutil.rmtree(DIST)
os.makedirs(DIST + 'icons')
for f in ['icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png']:
    shutil.copy(D + 'icons/' + f, DIST + 'icons/' + f)

CSP = ("default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
       "font-src https://fonts.gstatic.com; img-src 'self' data:; "
       "connect-src 'self' https://login.microsoftonline.com https://graph.microsoft.com; "
       "manifest-src 'self'; worker-src 'self'; base-uri 'none'; form-action 'self'; object-src 'none'")
index = ('<!doctype html>\n<html lang="pt-BR">\n<head>\n<meta charset="utf-8">\n'
         '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
         '<meta http-equiv="Content-Security-Policy" content="' + CSP + '">\n'
         '<meta name="referrer" content="no-referrer">\n'
         '<meta name="color-scheme" content="dark light">\n<meta name="theme-color" content="#08080c">\n'
         '<meta name="mobile-web-app-capable" content="yes">\n<meta name="apple-mobile-web-app-capable" content="yes">\n'
         '<meta name="apple-mobile-web-app-title" content="LIFE DASHBOARD">\n'
         '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">\n'
         '<title>LIFE DASHBOARD</title>\n<meta name="description" content="Escola, academia, calendário e tarefas em um só lugar.">\n'
         '<link rel="manifest" href="manifest.webmanifest">\n<link rel="icon" type="image/png" href="icons/icon-192.png">\n'
         '<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">\n'
         '<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="stylesheet" href="' + fonts + '">\n'
         '<link rel="stylesheet" href="app.css">\n</head>\n<body>\n'
         '<div id="app"></div>\n<div id="modal-root"></div>\n<div id="toast-root" aria-live="polite"></div>\n'
         '<noscript><p style="padding:24px;font:16px system-ui;color:#eee;background:#08080c">O LIFE DASHBOARD precisa de JavaScript.</p></noscript>\n'
         '<script src="config.js"></script>\n<script src="app.js"></script>\n</body>\n</html>\n')
w = lambda n, t: open(DIST + n, 'w', encoding='utf-8').write(t)
w('index.html', index); w('app.css', css.strip() + '\n'); w('app.js', js + '\n')
cfg_default = '/* Depois de registrar o app no Microsoft Entra, cole o ID do aplicativo (cliente) abaixo e publique de novo.\n   O ID não é uma senha. Não cole segredos aqui: este app não usa segredo. */\nwindow.LIFEDASH_CONFIG = { msClientId: "", msTenant: "organizations" };\n'
w('config.js', open(D + 'config.js', encoding='utf-8').read() if os.path.exists(D + 'config.js') else cfg_default)
manifest = {
  'id': './', 'name': 'LIFE DASHBOARD', 'short_name': 'Life Dash', 'description': 'Escola, academia, calendário e tarefas em um só lugar.',
  'start_url': './', 'scope': './', 'display': 'standalone', 'orientation': 'any', 'lang': 'pt-BR', 'dir': 'ltr',
  'background_color': '#08080c', 'theme_color': '#08080c', 'categories': ['productivity', 'education'],
  'icons': [
    {'src': 'icons/icon-192.png', 'sizes': '192x192', 'type': 'image/png', 'purpose': 'any'},
    {'src': 'icons/icon-512.png', 'sizes': '512x512', 'type': 'image/png', 'purpose': 'any'},
    {'src': 'icons/icon-maskable-512.png', 'sizes': '512x512', 'type': 'image/png', 'purpose': 'maskable'}],
  'shortcuts': [
    {'name': 'Escola', 'url': './#escola', 'icons': [{'src': 'icons/icon-192.png', 'sizes': '192x192'}]},
    {'name': 'Academia', 'url': './#academia', 'icons': [{'src': 'icons/icon-192.png', 'sizes': '192x192'}]},
    {'name': 'Minhas tarefas', 'url': './#tarefas', 'icons': [{'src': 'icons/icon-192.png', 'sizes': '192x192'}]}]}
w('manifest.webmanifest', json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')

ver = hashlib.sha256((index + css + js).encode('utf-8')).hexdigest()[:10]
sw = r"""/* LIFE DASHBOARD: service worker. Só guarda arquivos do próprio site. Nunca toca em Microsoft, Google ou qualquer outro endereço. */
const VERSION = '__VER__';
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
""".replace('__VER__', ver)
w('sw.js', sw)
w('.nojekyll', '')
w('_headers', "/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: no-referrer\n  Permissions-Policy: camera=(), microphone=(), geolocation=()\n/sw.js\n  Cache-Control: no-cache\n/index.html\n  Cache-Control: no-cache\n")
w('LEIA-ME.txt', open(D + 'LEIA-ME.txt', encoding='utf-8').read() if os.path.exists(D + 'LEIA-ME.txt') else '')

zp = D + 'life-dashboard-hospedagem.zip'
with zipfile.ZipFile(zp, 'w', zipfile.ZIP_DEFLATED) as z:
    for root, _, files in os.walk(DIST):
        for f in sorted(files):
            full = os.path.join(root, f); z.write(full, os.path.relpath(full, DIST))
print('dist ok | versão %s | zip %.0f KB' % (ver, os.path.getsize(zp) / 1024))
