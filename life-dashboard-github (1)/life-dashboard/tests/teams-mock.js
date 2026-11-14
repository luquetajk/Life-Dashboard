const OUT = process.env.OUT || 'dist';
/* Teste do fluxo Microsoft contra uma Microsoft SIMULADA (não é uma conta real). Roda o pacote dist/ com CSP e service worker ativos. */
const { chromium } = require('playwright'); const crypto = require('crypto'); const assert = require('assert');
const ORIGIN = 'http://127.0.0.1:8765', DIR = ORIGIN + '/' + OUT + '/', APP = DIR + 'index.html', CID = '11111111-2222-3333-4444-555555555555', TID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const TOK = 'lifedash.ms.tokens', PKCE = 'lifedash.ms.pkce';
const b64u = b => Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const jwt = o => 'h.' + b64u(JSON.stringify(o)) + '.s';
const results = []; let failed = 0;
const step = async (n, fn) => { try { await fn(); console.log('ok   ' + n); results.push(1); } catch (e) { failed++; console.log('FALHA ' + n + '\n       ' + String(e.message).split('\n')[0]); results.push(0); } };

const M = { mode: 'ok', calls: [], authz: [], tokenReqs: [], evil: 0, dueA1: '2026-11-20T02:59:00Z', a1Status: 'working', tokenErr: null, n: 0, good: null, refresh: null, dropA2: false, emptyC1: false, c2forbidden: false, expireIn: 3599, graphAuth: [] };
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization,content-type', 'access-control-allow-methods': 'GET,POST,OPTIONS' };
const json = (route, status, body) => route.fulfill({ status, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify(body) });
const idTok = () => jwt({ name: 'João da Silva', preferred_username: 'joao@escola.edu.br', tid: TID });
async function mockRoutes(ctx) {
  await ctx.route(u => u.hostname !== '127.0.0.1', async route => {
    const req = route.request(), u = new URL(req.url());
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    if (u.hostname === 'login.microsoftonline.com') {
      if (u.pathname.endsWith('/authorize')) {
        M.authz.push(u.searchParams); const st = u.searchParams.get('state'), ru = u.searchParams.get('redirect_uri');
        return route.fulfill({ status: 302, headers: { location: ru + '?code=mock-code&state=' + encodeURIComponent(st) } });
      }
      if (u.pathname.endsWith('/token')) {
        const body = new URLSearchParams(req.postData()); M.tokenReqs.push({ path: u.pathname, body });
        if (M.tokenErr) return json(route, 400, M.tokenErr);
        const g = body.get('grant_type');
        if (g === 'refresh_token' && body.get('refresh_token') !== M.refresh) return json(route, 400, { error: 'invalid_grant', error_description: 'AADSTS70000: refresh token inválido' });
        M.n++; M.good = 'mock-token-' + M.n; M.refresh = 'mock-refresh-' + M.n;
        const o = { access_token: M.good, refresh_token: M.refresh, expires_in: M.expireIn, token_type: 'Bearer' };
        if (g === 'authorization_code') o.id_token = idTok();
        return json(route, 200, o);
      }
    }
    if (u.hostname === 'graph.microsoft.com') {
      M.calls.push(u.pathname + u.search); const auth = req.headers()['authorization']; M.graphAuth.push(auth);
      if (auth !== 'Bearer ' + M.good) return json(route, 401, { error: { code: 'InvalidAuthenticationToken', message: 'bad token' } });
      if (M.mode === 'forbidden') return json(route, 403, { error: { code: 'Forbidden', message: 'Insufficient privileges' } });
      if (M.mode === 'offline') return route.abort('failed');
      const p = u.pathname.replace('/v1.0', '');
      if (p === '/education/me/classes' && !u.searchParams.get('$skiptoken')) return json(route, 200, { value: [{ id: 'c1', displayName: '9A - Matemática' }], '@odata.nextLink': M.mode === 'evil' ? 'https://evil.example/steal' : 'https://graph.microsoft.com/v1.0/education/me/classes?$skiptoken=2' });
      if (p === '/education/me/classes') return json(route, 200, { value: [{ id: 'c2', displayName: '9A - História' }] });
      if (p === '/education/classes/c1/assignments') {
        if (M.emptyC1) return json(route, 200, { value: [] });
        const v = [
          { id: 'a1', displayName: 'Lista de exercícios: funções', status: 'assigned', assignedDateTime: '2026-11-05T13:00:00Z', dueDateTime: M.dueA1, webUrl: 'https://teams.microsoft.com/l/entity/a1', instructions: { contentType: 'html', content: '<p>Resolver <b>1 a 12</b></p><script>alert(1)</script>' }, createdBy: { user: { displayName: 'Prof. Almeida' } }, submissions: [{ id: 's1', status: M.a1Status }] },
          { id: 'a2', displayName: 'Redação', status: 'assigned', assignedDateTime: '2026-11-01T13:00:00Z', dueDateTime: '2026-11-10T02:59:00Z', webUrl: 'https://teams.microsoft.com/l/entity/a2', createdBy: { user: { displayName: 'Prof. Almeida' } }, submissions: [{ id: 's2', status: 'submitted', submittedDateTime: '2026-11-08T12:00:00Z' }] },
          { id: 'a3', displayName: 'Rascunho do professor', status: 'draft', dueDateTime: '2026-11-25T02:59:00Z', submissions: [] },
          { id: 'a4', displayName: 'Sem prazo definido', status: 'assigned', dueDateTime: null, webUrl: 'https://teams.microsoft.com/l/entity/a4', submissions: [{ id: 's4', status: 'returned', submittedDateTime: '2026-11-03T12:00:00Z' }] }];
        return json(route, 200, { value: M.dropA2 ? v.filter(x => x.id !== 'a2') : v });
      }
      if (p === '/education/classes/c2/assignments') {
        if (M.c2forbidden) return json(route, 403, { error: { code: 'Forbidden', message: 'class denied' } });
        if (u.searchParams.get('$expand')) return json(route, 400, { error: { code: 'BadRequest', message: 'expand not supported' } });
        return json(route, 200, { value: [{ id: 'a5', displayName: 'Resumo do capítulo', status: 'assigned', assignedDateTime: '2026-11-09T13:00:00Z', dueDateTime: '2026-11-30T14:00:00Z', webUrl: 'https://teams.microsoft.com/l/entity/a5', createdBy: { user: { displayName: 'Profa. Lima' } } }] });
      }
      if (p === '/education/classes/c2/assignments/a5/submissions') return json(route, 200, { value: [{ id: 's5', status: 'submitted', submittedDateTime: '2026-11-11T12:00:00Z' }] });
      return json(route, 404, { error: { message: 'not mocked ' + p } });
    }
    if (u.hostname === 'evil.example') { M.evil++; return route.abort(); }
    return route.abort();
  });
}
const reset = () => { Object.assign(M, { mode: 'ok', calls: [], authz: [], tokenReqs: [], evil: 0, dueA1: '2026-11-20T02:59:00Z', a1Status: 'working', tokenErr: null, n: 0, good: null, refresh: null, dropA2: false, emptyC1: false, c2forbidden: false, expireIn: 3599, graphAuth: [] }); };
const fresh = async (b, url) => {
  const c = await b.newContext({ viewport: { width: 1280, height: 900 }, timezoneId: 'America/Sao_Paulo', locale: 'pt-BR' }); await mockRoutes(c);
  const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && /Content Security Policy|Refused to/i.test(m.text())) errs.push('CSP: ' + m.text()); });
  p._errs = errs; await p.goto(url || APP); await p.waitForSelector('#view'); return [c, p];
};
const waitSync = p => p.waitForFunction(() => { try { return !location.search && !ui.syncing && (db.settings.msLastSync || ui.msError); } catch (e) { return false; } }, null, { timeout: 8000 });
const idle = p => p.waitForFunction(() => { try { return !ui.syncing; } catch (e) { return false; } }, null, { timeout: 8000 });

(async () => {
  const b = await chromium.launch(); let [c, p] = await fresh(b); const ev = (f, a) => p.evaluate(f, a);

  await step('pacote hospedado: HTTPS/localhost aceito, sem ID do app não finge conexão e pede o ID', async () => {
    await p.click('.nav a[data-route="escola"]'); assert.match(await p.locator('.teams-b').innerText(), /ID do aplicativo/); assert.equal(await p.locator('[data-act="ms-connect"]').count(), 0); assert.equal(await p.locator('#f-ms-quick').count(), 1);
  });
  await step('ID digitado no próprio cartão é validado e salvo; botão Conectar Microsoft Teams aparece', async () => {
    await p.fill('#f-ms-quick input[name=clientId]', 'abc'); await p.click('#f-ms-quick button[type=submit]'); assert.match(await p.locator('.toast').innerText(), /formato/); assert.equal(await ev(() => db.settings.msClientId), '');
    await p.fill('#f-ms-quick input[name=clientId]', CID); await p.click('#f-ms-quick button[type=submit]'); await p.waitForSelector('[data-act="ms-connect"]');
    assert.equal((await p.locator('[data-act="ms-connect"]').innerText()).trim(), 'Conectar Microsoft Teams'); assert.equal(await ev(() => db.settings.msClientId), CID);
  });
  await step('pedido ao administrador: mensagem e link de consentimento corretos, sem segredo', async () => {
    const m = await ev(() => adminMessage()), u = new URL(await ev(() => adminConsentUrl()));
    for (const s of ['EduRoster.ReadBasic', 'EduAssignments.ReadBasic', 'User.Read', CID]) assert.ok(m.includes(s), s);
    assert.equal(u.origin + u.pathname, 'https://login.microsoftonline.com/organizations/v2.0/adminconsent'); assert.equal(u.searchParams.get('client_id'), CID); assert.equal(u.searchParams.get('scope'), 'https://graph.microsoft.com/.default'); assert.equal(u.searchParams.get('redirect_uri'), DIR);
    assert.ok(await p.locator('[data-act="copy-admin-msg"]').count() > 0);
  });

  await step('conectar: pedido OAuth correto (PKCE S256, escopos, redirect sem index.html, sem senha)', async () => {
    await Promise.all([p.waitForURL(/\?code=|#escola/, { timeout: 8000 }).catch(() => { }), p.click('[data-act="ms-connect"]')]);
    await waitSync(p);
    const q = M.authz[0]; assert.ok(q, 'não chamou o authorize');
    assert.equal(q.get('client_id'), CID); assert.equal(q.get('response_type'), 'code'); assert.equal(q.get('code_challenge_method'), 'S256'); assert.equal(q.get('redirect_uri'), DIR); assert.equal(q.get('response_mode'), 'query'); assert.equal(q.get('prompt'), 'select_account'); assert.equal(q.get('login_hint'), null);
    for (const s of ['openid', 'offline_access', 'User.Read', 'EduRoster.ReadBasic', 'EduAssignments.ReadBasic']) assert.ok(q.get('scope').split(' ').includes(s), s);
    assert.ok(!/senha|password|secret/i.test(q.toString()));
  });
  await step('troca do código: code_verifier confere com o code_challenge e não há client_secret', async () => {
    const t = M.tokenReqs[0]; assert.match(t.path, /\/organizations\/oauth2\/v2\.0\/token$/); const x = t.body;
    assert.equal(x.get('grant_type'), 'authorization_code'); assert.equal(x.get('code'), 'mock-code'); assert.equal(x.get('client_id'), CID); assert.equal(x.get('redirect_uri'), DIR); assert.equal(x.get('client_secret'), null);
    assert.equal(b64u(crypto.createHash('sha256').update(x.get('code_verifier')).digest()), M.authz[0].get('code_challenge')); assert.ok(x.get('code_verifier').length >= 43);
  });
  await step('URL limpa (sem code/state), conta com acentos e diretório (tid) guardados', async () => {
    assert.equal(await ev(() => location.search), ''); assert.equal(await ev(() => location.hash), '#escola'); assert.equal(await ev(() => location.pathname), '/' + OUT + '/');
    assert.deepEqual(await ev(() => db.settings.msAccount), { name: 'João da Silva', email: 'joao@escola.edu.br' }); assert.equal(await ev(() => db.settings.msTid), TID);
    assert.equal(await ev(() => localStorage.getItem('lifedash.ms.pkce')), null, 'verifier não foi apagado');
  });
  await step('tokens: só em lifedash.ms.tokens; nunca no JSON de dados, no backup, na URL, na tela ou em cookies', async () => {
    const t = await ev(() => JSON.parse(localStorage.getItem('lifedash.ms.tokens'))); assert.equal(t.a, M.good); assert.equal(t.r, M.refresh); assert.ok(t.re > Date.now() && t.re <= Date.now() + 24 * 3600 * 1000 + 5000);
    const secrets = [M.good, M.refresh, 'mock-code'];
    const hay = await ev(() => ({ db: localStorage.getItem('lifedash.v1'), exp: JSON.stringify(exportPayload()), html: document.documentElement.outerHTML, url: location.href, ck: document.cookie, ss: JSON.stringify(Object.assign({}, sessionStorage)) }));
    for (const [k, v] of Object.entries(hay)) for (const s of secrets) assert.ok(!String(v).includes(s), 'segredo em ' + k);
    assert.equal(JSON.parse(hay.exp).data.settings.msAccount, null); assert.equal(JSON.parse(hay.exp).data.settings.msTid, '');
  });
  await step('Graph: turmas com paginação e tarefas de cada turma, sempre com Bearer válido', async () => {
    const c = M.calls.join('\n'); assert.match(c, /\/education\/me\/classes$/m); assert.match(c, /skiptoken=2/); assert.match(c, /classes\/c1\/assignments\?\$expand=submissions/); assert.match(c, /classes\/c2\/assignments\/a5\/submissions/);
    assert.ok(M.graphAuth.every(a => /^Bearer mock-token-\d+$/.test(a)));
  });
  await step('turmas viram matérias', async () => { assert.deepEqual(await ev(() => db.subjects.filter(s => s.source === 'teams').map(s => s.name).sort()), ['9A - Matemática', '9A - História'].sort()); });
  await step('tarefas importadas: nome, matéria, professor, descrição sem HTML, prazo em Brasília, link', async () => {
    const a = await ev(() => db.assignments.find(x => x.id === 'teams-a1'));
    assert.equal(a.title, 'Lista de exercícios: funções'); assert.equal(a.subjectId, 'teams-c1'); assert.equal(a.teacher, 'Prof. Almeida');
    assert.equal(a.dueAt, '2026-11-19T23:59', 'prazo deveria virar horário de Brasília (UTC-3)'); assert.equal(a.publishedAt, '2026-11-05T10:00');
    assert.equal(a.url, 'https://teams.microsoft.com/l/entity/a1'); assert.equal(a.status, 'pendente'); assert.equal(a.source, 'teams');
    assert.equal(a.description, 'Resolver 1 a 12'); assert.ok(!/[<>]/.test(a.description));
  });
  await step('rascunho não entra; sem prazo entra sem prazo', async () => {
    assert.equal(await ev(() => db.assignments.some(x => x.id === 'teams-a3')), false); assert.equal((await ev(() => db.assignments.find(x => x.id === 'teams-a4'))).dueAt, '');
  });
  await step('entregue no Teams (submitted/returned) vira Concluída; "working" fica Pendente', async () => {
    const g = id => ev((i) => { const a = db.assignments.find(x => x.id === i); return [a.status, a.doneBy]; }, id);
    assert.deepEqual(await g('teams-a1'), ['pendente', null]); assert.deepEqual(await g('teams-a2'), ['concluida', 'teams']); assert.deepEqual(await g('teams-a4'), ['concluida', 'teams']);
  });
  await step('turma que recusa $expand cai no plano B e ainda descobre a entrega', async () => {
    const a = await ev(() => db.assignments.find(x => x.id === 'teams-a5')); assert.equal(a.status, 'concluida'); assert.equal(a.dueAt, '2026-11-30T11:00');
  });
  await step('na tela: etiqueta Teams, "Abrir no Teams", prazo em português, cartão conectado', async () => {
    await p.click('.nav a[data-route="escola"]'); const row = p.locator('#school-list .li', { hasText: 'Lista de exercícios: funções' });
    assert.match(await row.innerText(), /Teams/); assert.match(await row.innerText(), /19 nov às 23:59/); assert.equal(await row.locator('a[target=_blank]').getAttribute('href'), 'https://teams.microsoft.com/l/entity/a1'); assert.equal(await row.locator('a[target=_blank]').getAttribute('rel'), 'noopener noreferrer');
    const card = await p.locator('.teams-b').innerText(); assert.match(card, /Teams conectado/); assert.match(card, /João da Silva/); assert.ok(await p.locator('[data-act="sync-teams"]').count());
  });
  await step('segunda sincronização: sem duplicar, preserva o seu "em andamento", atualiza prazo e entrega', async () => {
    await ev(() => { db.assignments.find(x => x.id === 'teams-a1').status = 'andamento'; save(); }); const n0 = await ev(() => db.assignments.length);
    M.dueA1 = '2026-11-21T02:59:00Z'; await p.click('[data-act="sync-teams"]'); await idle(p); await p.waitForTimeout(100);
    assert.equal(await ev(() => db.assignments.length), n0); let a = await ev(() => db.assignments.find(x => x.id === 'teams-a1')); assert.equal(a.status, 'andamento'); assert.equal(a.dueAt, '2026-11-20T23:59');
    assert.match(await p.locator('.toast').innerText(), /0 novas/);
    M.a1Status = 'submitted'; await p.click('[data-act="sync-teams"]'); await idle(p); await p.waitForTimeout(100); a = await ev(() => db.assignments.find(x => x.id === 'teams-a1')); assert.equal(a.status, 'concluida'); assert.equal(a.doneBy, 'teams');
  });
  await step('tarefa apagada pelo professor some do app; as cadastradas à mão ficam', async () => {
    await ev(() => { db.assignments.push({ id: 'meu1', title: 'Manual', subjectId: 'teams-c1', dueAt: '2026-12-01', status: 'pendente', source: 'manual', demo: false }); save(); });
    M.a1Status = 'working'; M.dropA2 = true; await p.click('[data-act="sync-teams"]'); await idle(p); await p.waitForTimeout(100);
    assert.equal(await ev(() => db.assignments.some(x => x.id === 'teams-a2')), false, 'a2 deveria ter sido removida'); assert.equal(await ev(() => db.assignments.some(x => x.id === 'meu1')), true);
    assert.match(await p.locator('.toast').innerText(), /1 removida/); assert.equal(await ev(() => db.assignments.some(x => x.id === 'teams-a1')), true);
  });
  await step('resposta vazia da turma não apaga tudo por engano', async () => {
    M.emptyC1 = true; const n = await ev(() => db.assignments.filter(a => a.source === 'teams' && a.subjectId === 'teams-c1').length); await p.click('[data-act="sync-teams"]'); await idle(p);
    assert.equal(await ev(() => db.assignments.filter(a => a.source === 'teams' && a.subjectId === 'teams-c1').length), n); M.emptyC1 = false;
  });
  await step('403 em uma turma só: ela é ignorada, o resto sincroniza e não pede consentimento', async () => {
    M.c2forbidden = true; await p.click('[data-act="sync-teams"]'); await idle(p); await p.waitForTimeout(100);
    assert.match(await p.locator('.toast').innerText(), /Sem acesso a 1 turma/); assert.equal(await ev(() => !!ui.msConsentNeeded), false); assert.equal(await p.locator('.teams-b .err').count(), 0); assert.equal(await ev(() => db.assignments.some(x => x.id === 'teams-a5')), true); M.c2forbidden = false;
  });

  /* ---- sessão: renovação silenciosa ---- */
  await step('sessão sobrevive a recarregar a página e o SW não guarda código de login', async () => {
    await p.reload(); await p.waitForSelector('#view'); assert.ok(await ev(() => !!msTokens())); assert.ok((await ev(() => db.assignments.filter(a => a.source === 'teams').length)) >= 3);
    const keys = await ev(async () => { const out = []; for (const k of await caches.keys()) for (const r of await (await caches.open(k)).keys()) out.push(r.url); return out; });
    assert.ok(keys.length > 0, 'cache vazio'); assert.ok(keys.every(u => !/[?&](code|state)=/.test(u)), 'código no cache: ' + keys.join(','));
  });
  await step('token de acesso vencido: renova sozinho com o refresh token (sem abrir login) e sincroniza', async () => {
    await ev(() => { const t = JSON.parse(localStorage.getItem('lifedash.ms.tokens')); t.e = Date.now() - 1000; localStorage.setItem('lifedash.ms.tokens', JSON.stringify(t)); render(); });
    const before = M.authz.length, nTok = M.tokenReqs.length; await ev(() => go('escola')); await p.click('[data-act="sync-teams"]'); await idle(p); await p.waitForTimeout(100);
    const r = M.tokenReqs.slice(nTok); assert.equal(r.length, 1); assert.equal(r[0].body.get('grant_type'), 'refresh_token'); assert.equal(r[0].body.get('refresh_token'), M.refresh === r[0].body.get('refresh_token') ? M.refresh : r[0].body.get('refresh_token'));
    assert.match(r[0].path, new RegExp('/' + TID + '/oauth2/v2\\.0/token$')); assert.equal(M.authz.length, before); assert.equal(await p.locator('.teams-b .err').count(), 0);
    const t = await ev(() => JSON.parse(localStorage.getItem('lifedash.ms.tokens'))); assert.equal(t.a, M.good); assert.equal(t.r, M.refresh);
  });
  await step('a validade de 24 h do refresh token não é prorrogada pela renovação', async () => {
    const re0 = await ev(() => JSON.parse(localStorage.getItem('lifedash.ms.tokens')).re);
    await ev(() => { const t = JSON.parse(localStorage.getItem('lifedash.ms.tokens')); t.e = Date.now() - 1000; localStorage.setItem('lifedash.ms.tokens', JSON.stringify(t)); }); await p.click('[data-act="sync-teams"]'); await idle(p); await p.waitForTimeout(100);
    assert.equal(await ev(() => JSON.parse(localStorage.getItem('lifedash.ms.tokens')).re), re0);
  });
  await step('401 no meio do caminho: renova uma vez e repete a chamada', async () => {
    await ev(() => { const t = JSON.parse(localStorage.getItem('lifedash.ms.tokens')); t.a = 'revogado'; t.e = Date.now() + 3e6; localStorage.setItem('lifedash.ms.tokens', JSON.stringify(t)); });
    const nTok = M.tokenReqs.length; await p.click('[data-act="sync-teams"]'); await idle(p); await p.waitForTimeout(100); assert.equal(M.tokenReqs.length - nTok, 1); assert.equal(await p.locator('.teams-b .err').count(), 0);
  });
  await step('sincroniza sozinho (msAutoSync) quando passou mais de 30 min e a sessão é válida', async () => {
    await ev(() => { db.settings.msLastSync = new Date(Date.now() - 31 * 60000).toISOString(); persist(); }); const n = M.calls.length; await ev(() => msAutoSync()); await idle(p); await p.waitForTimeout(150);
    assert.ok(M.calls.length > n, 'não sincronizou sozinho'); assert.ok(Date.now() - new Date(await ev(() => db.settings.msLastSync)) < 60000);
    const n2 = M.calls.length; await ev(() => msAutoSync()); await p.waitForTimeout(150); assert.equal(M.calls.length, n2, 'sincronizou de novo cedo demais');
  });
  await step('erro 403 geral (escola não liberou): orienta pedir consentimento e abre o pedido ao administrador', async () => {
    M.mode = 'forbidden'; await p.click('[data-act="sync-teams"]'); await idle(p); assert.match(await p.locator('.teams-b .err').innerText(), /administrador/);
    assert.equal(await p.locator('details.guide[open] [data-act="copy-admin-msg"]').count(), 1); M.mode = 'ok';
  });
  await step('erro de rede: mensagem clara, app continua funcionando', async () => {
    M.mode = 'offline'; await p.click('[data-act="sync-teams"]'); await idle(p); assert.match(await p.locator('.teams-b .err').innerText(), /Não foi possível falar com a Microsoft/); M.mode = 'ok';
  });
  await step('link de paginação para outro domínio é bloqueado (token não vaza)', async () => {
    M.mode = 'evil'; await p.click('[data-act="sync-teams"]'); await idle(p); assert.match(await p.locator('.teams-b .err').innerText(), /inesperado/); assert.equal(M.evil, 0, 'chamou domínio estranho'); assert.ok(!M.calls.some(x => /steal/.test(x))); M.mode = 'ok';
  });
  await step('reconectar usa login_hint da conta já conhecida (sem escolher conta de novo)', async () => {
    await ev(() => { lsDel(MS_TOK); render(); }); await ev(() => go('escola')); const b0 = M.authz.length; assert.match(await p.locator('[data-act="ms-connect"]').innerText(), /Reconectar/);
    await Promise.all([p.waitForURL(/#escola/, { timeout: 8000 }).catch(() => { }), p.click('[data-act="ms-connect"]')]); await waitSync(p); await idle(p);
    const q = M.authz[b0]; assert.equal(q.get('login_hint'), 'joao@escola.edu.br'); assert.equal(q.get('prompt'), null); assert.ok(await ev(() => !!msTokens()));
  });
  await step('refresh token vencido (24 h): limpa a sessão e pede para reconectar', async () => {
    await ev(() => { const t = JSON.parse(localStorage.getItem('lifedash.ms.tokens')); t.e = 0; t.re = Date.now() - 1000; localStorage.setItem('lifedash.ms.tokens', JSON.stringify(t)); render(); });
    assert.match(await p.locator('[data-act="ms-connect"]').innerText(), /Reconectar/); assert.match(await p.locator('.teams-b').innerText(), /expirou/);
  });
  await step('refresh recusado pela Microsoft (invalid_grant): sessão limpa e mensagem de reconexão', async () => {
    await ev(() => { localStorage.setItem('lifedash.ms.tokens', JSON.stringify({ a: 'x', e: 0, r: 'errado', re: Date.now() + 3e6 })); render(); }); await p.click('[data-act="sync-teams"]'); await idle(p);
    assert.match(await p.locator('.teams-b .err').innerText(), /expirou/); assert.equal(await ev(() => localStorage.getItem('lifedash.ms.tokens')), null);
  });
  await step('desconectar remove conta e sessão, mas mantém as atividades importadas', async () => {
    await ev(() => { localStorage.setItem('lifedash.ms.tokens', JSON.stringify({ a: 'x', e: Date.now() + 3e6, r: 'r', re: Date.now() + 3e6 })); render(); }); await p.click('[data-act="ms-disconnect"]');
    assert.equal(await ev(() => db.settings.msAccount), null); assert.equal(await ev(() => localStorage.getItem('lifedash.ms.tokens')), null); assert.ok(await ev(() => db.assignments.some(a => a.source === 'teams')));
  });
  await step('apagar todos os dados também apaga os tokens', async () => {
    await ev(() => { localStorage.setItem('lifedash.ms.tokens', JSON.stringify({ a: 'x', e: Date.now() + 3e6, r: 'r', re: Date.now() + 3e6 })); }); await ev(() => go('configuracoes')); await p.click('[data-act="wipe"]'); await p.click('[data-act="confirm-ok"]').catch(async () => { await p.locator('.modal .btn.danger, .modal .btn.primary').last().click(); });
    await p.waitForTimeout(200); assert.equal(await ev(() => localStorage.getItem('lifedash.ms.tokens')), null); assert.equal(await ev(() => localStorage.getItem('lifedash.ms.pkce')), null);
  });
  assert.deepEqual(p._errs, [], 'erros de JS/CSP: ' + p._errs.join(' | ')); await c.close();

  /* ---- retornos de login com problema ---- */
  reset(); [c, p] = await fresh(b);
  const arm = (state) => p.evaluate(({ id, state }) => { db.settings.msClientId = id; persist(); localStorage.setItem('lifedash.ms.pkce', JSON.stringify({ verifier: 'v'.repeat(50), state, redirect: location.origin + location.pathname.replace(/index\.html$/, ''), t: Date.now() })); }, { id: CID, state });
  await arm('esperado');
  await step('state diferente (possível ataque) é recusado, sem trocar o código', async () => {
    await p.goto(DIR + '?code=abc&state=falso'); await p.waitForSelector('#view'); assert.match(await p.locator('.teams-b .err').innerText(), /não pôde ser validada/); assert.equal(M.tokenReqs.length, 0); assert.equal(await ev(() => location.search), ''); assert.equal(await ev(() => localStorage.getItem('lifedash.ms.pkce')), null);
  });
  await step('resposta de login com mais de 15 minutos é recusada', async () => {
    await ev(() => localStorage.setItem('lifedash.ms.pkce', JSON.stringify({ verifier: 'v'.repeat(50), state: 'velho', redirect: location.origin + location.pathname.replace(/index\.html$/, ''), t: Date.now() - 16 * 60000 }))); await p.goto(DIR + '?code=abc&state=velho'); await p.waitForSelector('#view');
    assert.match(await p.locator('.teams-b .err').innerText(), /demorou demais/); assert.equal(M.tokenReqs.length, 0);
  });
  await step('usuário nega o consentimento: mensagem em português com o código da Microsoft', async () => {
    await arm('ok1'); await p.goto(DIR + '?error=access_denied&error_description=' + encodeURIComponent('AADSTS65004: User declined to consent') + '&state=ok1'); await p.waitForSelector('#view'); const t = await p.locator('.teams-b .err').innerText(); assert.match(t, /consentimento foi recusado/); assert.match(t, /AADSTS65004/);
  });
  await step('escola não autorizou (AADSTS65001): explica e abre o pedido ao administrador', async () => {
    await arm('ok2'); await p.goto(DIR + '?error=consent_required&error_description=' + encodeURIComponent('AADSTS65001: The user or administrator has not consented to use the application') + '&state=ok2'); await p.waitForSelector('#view');
    assert.match(await p.locator('.teams-b .err').innerText(), /escola ainda não autorizou/); assert.equal(await p.locator('details.guide[open] [data-act="copy-admin-msg"]').count(), 1);
  });
  await step('"Need admin approval" (AADSTS90094) também cai no fluxo do administrador', async () => {
    await arm('ok3'); await p.goto(DIR + '?error=access_denied&error_description=' + encodeURIComponent('AADSTS90094: An administrator of the school must grant permission to this application. Need admin approval') + '&state=ok3'); await p.waitForSelector('#view');
    assert.match(await p.locator('.teams-b .err').innerText(), /escola ainda não autorizou/);
  });
  await step('URI de redirecionamento errado (AADSTS50011) mostra o URI exato a cadastrar', async () => {
    await arm('ok4'); await p.goto(DIR + '?error=invalid_request&error_description=' + encodeURIComponent('AADSTS50011: The redirect URI does not match') + '&state=ok4'); await p.waitForSelector('#view'); const t = await p.locator('.teams-b .err').innerText(); assert.ok(t.includes(DIR), t);
  });
  await step('plataforma Web em vez de SPA (AADSTS9002326) é explicada', async () => {
    await arm('ok5'); M.tokenErr = { error: 'invalid_request', error_description: 'AADSTS9002326: Cross-origin token redemption is permitted only for the Single-Page Application client-type.' };
    await p.goto(DIR + '?code=abc&state=ok5'); await p.waitForSelector('#view'); assert.match(await p.locator('.teams-b .err').innerText(), /Aplicativo de página única \(SPA\)/); assert.equal(await ev(() => db.settings.msAccount), null); assert.equal(await ev(() => localStorage.getItem('lifedash.ms.tokens')), null); M.tokenErr = null;
  });
  await step('ID de aplicativo errado (AADSTS700016) e acesso condicional (AADSTS53003) têm mensagens próprias', async () => {
    await arm('ok6'); M.tokenErr = { error: 'unauthorized_client', error_description: 'AADSTS700016: Application not found in the directory.' }; await p.goto(DIR + '?code=abc&state=ok6'); await p.waitForSelector('#view'); assert.match(await p.locator('.teams-b .err').innerText(), /não encontrou esse ID/);
    await arm('ok7'); M.tokenErr = { error: 'access_denied', error_description: 'AADSTS53003: Access has been blocked by Conditional Access policies.' }; await p.goto(DIR + '?code=abc&state=ok7'); await p.waitForSelector('#view'); assert.match(await p.locator('.teams-b .err').innerText(), /acesso condicional/); M.tokenErr = null;
  });
  await step('retorno do consentimento do administrador: aviso de sucesso, URL limpa; recusa mostra o motivo', async () => {
    await p.goto(DIR + '?admin_consent=True&tenant=' + TID + '&state=consent'); await p.waitForSelector('#view'); assert.match(await p.locator('.card .banner').innerText(), /administrador autorizou/); assert.equal(await ev(() => location.search), '');
    await p.goto(DIR + '?error=access_denied&error_description=' + encodeURIComponent('AADSTS65004: declined') + '&admin_consent=False&state=consent'); await p.waitForSelector('#view'); assert.ok(await p.locator('.card .banner.bad').count());
  });
  assert.deepEqual(p._errs, [], 'erros de JS/CSP: ' + p._errs.join(' | ')); await c.close();

  /* ---- Chrome e app instalado compartilham a sessão ---- */
  reset(); [c, p] = await fresh(b); await p.evaluate((id) => { db.settings.msClientId = id; persist(); go('escola'); }, CID);
  await step('segunda janela (ex.: app instalado) recebe a conexão feita na outra sem recarregar', async () => {
    const p2 = await c.newPage(); p2.on('pageerror', e => p._errs.push(e.message)); await p2.goto(APP + '#escola'); await p2.waitForSelector('#view');
    await Promise.all([p2.waitForURL(/#escola/, { timeout: 8000 }).catch(() => { }), p2.click('[data-act="ms-connect"]')]); await p2.waitForFunction(() => { try { return !location.search && !ui.syncing && db.settings.msLastSync; } catch (e) { return false; } }, null, { timeout: 8000 });
    await p.waitForFunction(() => /Teams conectado/.test(document.querySelector('.teams-b') ? document.querySelector('.teams-b').innerText : ''), null, { timeout: 5000 }); assert.ok(await p.evaluate(() => db.assignments.some(a => a.source === 'teams'))); await p2.close();
  });
  assert.deepEqual(p._errs, [], 'erros: ' + p._errs.join(' | ')); await c.close(); await b.close();
  console.log('\n' + (results.length - failed) + '/' + results.length + ' ok'); process.exit(failed ? 1 : 0);
})().catch(e => { console.log('ERRO FATAL', e.stack || e.message); process.exit(2); });
