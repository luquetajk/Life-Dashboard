const OUT = process.env.OUT || 'dist';
const { chromium, devices } = require('playwright'); const assert = require('assert'); const fs = require('fs');
const DIR = 'http://127.0.0.1:8765/' + OUT + '/', APP = DIR + 'index.html', DISK = require('path').join(__dirname, '..', OUT) + '/';
const LOCAL = r => /^http:\/\/127\.0\.0\.1:8765\//.test(r.request().url()) ? r.continue() : r.abort();
let failed = 0, total = 0; const step = async (n, fn) => { total++; try { await fn(); console.log('ok   ' + n); } catch (e) { failed++; console.log('FALHA ' + n + '\n       ' + String(e.message).split('\n')[0]); } };
(async () => {
  /* ---- arquivos do pacote ---- */
  await step('manifest: campos exigidos para instalar no Android e ícones com o tamanho declarado', async () => {
    const m = JSON.parse(fs.readFileSync(DISK + 'manifest.webmanifest', 'utf8'));
    assert.equal(m.display, 'standalone'); assert.equal(m.start_url, './'); assert.equal(m.scope, './'); assert.ok(m.name && m.short_name); assert.match(m.theme_color, /^#/); assert.match(m.background_color, /^#/);
    const need = { '192x192': 'any', '512x512': 'any' }; for (const i of m.icons) { const b = fs.readFileSync(DISK + i.src); const w = b.readUInt32BE(16), h = b.readUInt32BE(20); assert.equal(w + 'x' + h, i.sizes, i.src); }
    assert.ok(m.icons.some(i => i.sizes === '192x192' && i.purpose === 'any')); assert.ok(m.icons.some(i => i.sizes === '512x512' && i.purpose === 'any')); assert.ok(m.icons.some(i => i.purpose === 'maskable'));
  });
  await step('index.html: CSP restritiva, sem script inline, sem segredo, ligações corretas', async () => {
    const h = fs.readFileSync(DISK + 'index.html', 'utf8');
    assert.match(h, /Content-Security-Policy/); assert.match(h, /script-src 'self'(;|")/); assert.ok(!/script-src[^;]*unsafe/.test(h)); assert.match(h, /connect-src 'self' https:\/\/login\.microsoftonline\.com https:\/\/graph\.microsoft\.com/);
    assert.ok(!/<script(?![^>]*\bsrc=)[^>]*>/i.test(h), 'script inline'); assert.match(h, /rel="manifest"/); assert.match(h, /apple-touch-icon/); assert.match(h, /viewport-fit=cover/);
    const cfg = fs.readFileSync(DISK + 'config.js', 'utf8'); assert.match(cfg, /LIFEDASH_CONFIG\s*=\s*\{\s*msClientId:\s*"",\s*msTenant:\s*"organizations"\s*\}/, 'config.js deve ter só msClientId e msTenant');
    for (const f of fs.readdirSync(DISK)) if (fs.statSync(DISK + f).isFile()) assert.ok(!/client_secret\s*[:=]\s*["'][^"']+/i.test(fs.readFileSync(DISK + f, 'utf8')), 'segredo em ' + f);
  });

  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices['Pixel 7'], locale: 'pt-BR', timezoneId: 'America/Sao_Paulo', serviceWorkers: 'allow' }); await ctx.route(/^https?:/, LOCAL);
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && /Content Security Policy|Refused to/i.test(m.text())) errs.push('CSP: ' + m.text()); });
  await p.goto(APP); await p.waitForSelector('#view'); const ev = (f, a) => p.evaluate(f, a);

  await step('service worker registra, assume o controle e guarda os arquivos do app', async () => {
    await p.evaluate(() => navigator.serviceWorker.ready); await p.reload(); await p.waitForSelector('#view'); await p.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 8000 });
    const keys = await ev(async () => { const out = []; for (const k of await caches.keys()) for (const r of await (await caches.open(k)).keys()) out.push(new URL(r.url).pathname); return out; });
    for (const f of ['/' + OUT + '/index.html', '/' + OUT + '/app.js', '/' + OUT + '/app.css', '/' + OUT + '/manifest.webmanifest', '/' + OUT + '/icons/icon-192.png']) assert.ok(keys.includes(f), 'faltou no cache: ' + f + ' | ' + keys.join(','));
  });
  await step('sem internet: o app abre pelo cache e os dados continuam lá', async () => {
    await ev(() => { db.tasks.push({ id: 'offline1', title: 'Tarefa offline', date: '', done: false, category: 'outros', priority: 'baixa', demo: false }); save(); });
    await ctx.setOffline(true); await p.reload(); await p.waitForSelector('#view', { timeout: 8000 }); assert.ok(await ev(() => db.tasks.some(t => t.id === 'offline1'))); assert.match(await p.locator('.hero h1').innerText(), /Bom dia|Boa tarde|Boa noite|Boa madrugada/);
    await ev(() => go('tarefas')); assert.match(await p.locator('#view').innerText(), /Tarefa offline/); await ctx.setOffline(false);
  });
  await step('atalhos do manifest (#escola, #academia, #tarefas) abrem a tela certa', async () => {
    for (const r of ['escola', 'academia', 'tarefas']) { await p.goto(DIR + '#' + r); await p.waitForSelector('#view'); assert.equal(await ev(() => ui.route), r); }
  });
  await step('celular (Pixel 7): nenhuma tela com rolagem horizontal, com o guia aberto e com o cartão do Teams em cada estado', async () => {
    const over = () => ev(() => document.documentElement.scrollWidth - window.innerWidth);
    for (const r of ['visao-geral', 'escola', 'academia', 'calendario', 'tarefas', 'estatisticas', 'configuracoes']) { await ev(x => go(x), r); await p.waitForTimeout(120); assert.ok(await over() <= 0, 'overflow em ' + r + ': ' + await over()); }
    await ev(() => { ui.guideOpen = true; go('configuracoes'); render(); }); await p.waitForTimeout(150); assert.ok(await over() <= 0, 'guia aberto: ' + await over());
    await ev(() => { go('escola'); ui.msConsentNeeded = true; ui.msError = 'A escola ainda não autorizou este aplicativo. Um administrador do Microsoft 365 precisa dar o consentimento. (AADSTS65001)'; db.settings.msClientId = '11111111-2222-3333-4444-555555555555'; render(); });
    await p.waitForTimeout(150); assert.ok(await over() <= 0, 'cartão com erro: ' + await over()); await p.screenshot({ path: require('path').join(require('os').tmpdir(), 'pixel-escola-erro.png'), fullPage: false });
  });
  await step('botão Conectar Microsoft Teams é fácil de tocar (>= 44 px) e visível', async () => {
    await ev(() => { ui.msError = ''; ui.msConsentNeeded = false; db.settings.msAccount = null; localStorage.removeItem('lifedash.ms.tokens'); go('escola'); render(); }); const bt = p.locator('[data-act="ms-connect"]'); await bt.scrollIntoViewIfNeeded(); const bb = await bt.boundingBox();
    assert.ok(bb.height >= 44, 'altura ' + bb.height); assert.ok(bb.width <= 412); assert.equal((await bt.innerText()).trim(), 'Conectar Microsoft Teams'); await p.screenshot({ path: require('path').join(require('os').tmpdir(), 'pixel-escola-conectar.png') });
  });
  await step('instalar: com o evento beforeinstallprompt aparece o botão e ele chama o prompt do navegador', async () => {
    await ev(() => { go('configuracoes'); window.__asked = 0; const e = new Event('beforeinstallprompt'); e.prompt = () => { window.__asked++; return Promise.resolve(); }; e.userChoice = Promise.resolve({ outcome: 'accepted' }); window.dispatchEvent(e); });
    await p.waitForSelector('[data-act="install-app"]'); await p.click('[data-act="install-app"]'); await p.waitForTimeout(150); assert.equal(await ev(() => window.__asked), 1); assert.equal(await p.locator('[data-act="install-app"]').count(), 0);
    await p.screenshot({ path: require('path').join(require('os').tmpdir(), 'pixel-config.png'), fullPage: true });
  });
  await step('sem o evento, mostra o caminho manual do Chrome (menu ⋮ > Instalar app)', async () => {
    const c2 = await b.newContext({ ...devices['Pixel 7'] }); await c2.route(/^https?:/, LOCAL); const q = await c2.newPage(); await q.goto(DIR + '#configuracoes'); await q.waitForSelector('#view');
    assert.match(await q.locator('#view').innerText(), /Instalar app/); assert.equal(await q.locator('[data-act="install-app"]').count(), 0); await c2.close();
  });
  await step('app já instalado (modo standalone): avisa e não oferece instalar de novo', async () => {
    const c3 = await b.newContext({ ...devices['Pixel 7'] }); await c3.route(/^https?:/, LOCAL); await c3.addInitScript(() => { const mm = window.matchMedia.bind(window); window.matchMedia = q => /display-mode:\s*standalone/.test(q) ? { matches: true, media: q, addEventListener() { }, removeEventListener() { }, addListener() { }, removeListener() { } } : mm(q); });
    const q = await c3.newPage(); await q.goto(DIR + '#configuracoes'); await q.waitForSelector('#view'); assert.match(await q.locator('#view').innerText(), /já está usando o LIFE DASHBOARD como aplicativo instalado/); await c3.close();
  });
  await step('config.js preenche o ID do app quando é um GUID válido (e ignora lixo)', async () => {
    const c4 = await b.newContext({ ...devices['Pixel 7'] }); await c4.route(/^https?:/, async r => { const u = r.request().url(); if (new RegExp('/' + OUT + '/config\\.js').test(u)) return r.fulfill({ contentType: 'text/javascript', body: 'window.LIFEDASH_CONFIG={msClientId:"99999999-8888-7777-6666-555555555555",msTenant:"organizations"};' }); return LOCAL(r); });
    let q = await c4.newPage(); await q.goto(DIR); await q.waitForSelector('#view'); assert.equal(await q.evaluate(() => db.settings.msClientId), '99999999-8888-7777-6666-555555555555'); await q.close(); await c4.close();
    const c5 = await b.newContext({ ...devices['Pixel 7'] }); await c5.route(/^https?:/, async r => { const u = r.request().url(); if (new RegExp('/' + OUT + '/config\\.js').test(u)) return r.fulfill({ contentType: 'text/javascript', body: 'window.LIFEDASH_CONFIG={msClientId:"<img onerror=x>",msTenant:"organizations"};' }); return LOCAL(r); });
    q = await c5.newPage(); await q.goto(DIR); await q.waitForSelector('#view'); assert.equal(await q.evaluate(() => db.settings.msClientId), ''); await c5.close();
  });
  await step('nenhum erro de JavaScript nem violação de CSP', async () => { assert.deepEqual(errs, []); });
  await b.close(); console.log('\n' + (total - failed) + '/' + total + ' ok'); process.exit(failed ? 1 : 0);
})().catch(e => { console.log('ERRO FATAL', e.stack || e.message); process.exit(2); });
