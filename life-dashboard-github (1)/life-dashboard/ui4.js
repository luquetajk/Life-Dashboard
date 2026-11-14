/* ===== LIFE DASHBOARD: Microsoft Graph, exportar/importar, ações, eventos e inicialização ===== */

/* ---------- Microsoft: OAuth 2.0 com PKCE e Graph (sem senha no app, tokens nunca saem do aparelho) ---------- */
const MS_SCOPES = 'openid profile offline_access User.Read EduRoster.ReadBasic EduAssignments.ReadBasic';
const MS_TOK = 'lifedash.ms.tokens', MS_PKCE = 'lifedash.ms.pkce';
const GUID_RE = /^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const STALE_MS = 30 * 60 * 1000, REFRESH_LIFE = 24 * 3600 * 1000;
/* O Entra compara o endereço de redirecionamento letra por letra: index.html é tratado como a pasta. */
function msRedirectUri() { return location.origin + location.pathname.replace(/index\.html$/i, ''); }
function secureContextOk() { return location.protocol === 'https:' || /^(localhost|127\.0\.0\.1)$/.test(location.hostname); }
function lsGet(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
function lsDel(k) { try { localStorage.removeItem(k); } catch (e) { } }
/* Tokens ficam só em localStorage deste site (compartilhado entre o Chrome e o app instalado), nunca no JSON de dados, na URL ou em backups. */
function msStore() { return lsGet(MS_TOK); }
function msTokens() { const t = msStore(); return t && t.a && t.e > Date.now() + 30000 ? t : null; }
function msHasSession() { const t = msStore(); return !!t && ((t.a && t.e > Date.now() + 30000) || (t.r && t.re > Date.now() + 60000)); }
function msSaveTokens(j, interactive) {
  const prev = msStore() || {};
  lsSet(MS_TOK, { a: j.access_token, e: Date.now() + (j.expires_in || 3600) * 1000, r: j.refresh_token || prev.r || '', re: interactive || !prev.re ? Date.now() + REFRESH_LIFE : prev.re });
}
function parseJwt(t) { try { return JSON.parse(decodeURIComponent(escape(atob(String(t).split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))))); } catch (e) { return {}; } }
function b64url(buf) { let s = ''; new Uint8Array(buf).forEach(b => { s += String.fromCharCode(b); }); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function msFail(text, code) { return Object.assign(new Error(text), { code }); }

/* Traduz os erros mais comuns da Microsoft para o que fazer. O código original vai junto, entre parênteses. */
function aadHelp(raw) {
  const t = String(raw || ''), code = (t.match(/AADSTS\d+/) || [''])[0], tag = code ? ' (' + code + ')' : '';
  const rules = [
    [/AADSTS(65001|90094|900941|90008|65002)|consent_required|need admin approval|admin approval|Need admin consent/i, 'A escola ainda não autorizou este aplicativo. Um administrador do Microsoft 365 precisa dar o consentimento. Use o pedido ao administrador abaixo.', 'consent'],
    [/AADSTS50011|redirect_uri|reply url/i, 'O endereço de redirecionamento não confere com o cadastrado no Entra. Cadastre exatamente este, respeitando maiúsculas e a barra final: ' + msRedirectUri(), 'redirect'],
    [/AADSTS9002326|AADSTS9002327|AADSTS7000218|cross-origin token redemption|client_secret|client_assertion/i, 'No Entra, o endereço de redirecionamento precisa estar na plataforma "Aplicativo de página única (SPA)", não em "Web".', 'spa'],
    [/AADSTS700016|AADSTS700082|Application with identifier .* was not found/i, 'A Microsoft não encontrou esse ID de aplicativo. Confira o ID e se o registro aceita contas de qualquer diretório organizacional.', 'appid'],
    [/AADSTS530003|AADSTS53003|conditional access|blocked by conditional/i, 'Uma regra de segurança da escola bloqueou este login (acesso condicional). Só o administrador pode liberar.', 'policy'],
    [/AADSTS50020|AADSTS50034|AADSTS50105|AADSTS50177/i, 'Esta conta não pode entrar neste aplicativo. Use a conta da escola, e o app precisa aceitar o diretório dela.', 'account'],
    [/access_denied|AADSTS65004|declined to consent/i, 'O consentimento foi recusado. Toque em Conectar e aceite as permissões, ou peça ao administrador.', 'denied'],
    [/AADSTS70000|AADSTS70008|AADSTS700084|invalid_grant|expired/i, 'A autorização expirou. Toque em Conectar para entrar de novo.', 'expired']
  ];
  for (const r of rules) if (r[0].test(t)) { ui.msConsentNeeded = r[2] === 'consent'; return r[1] + tag; }
  ui.msConsentNeeded = false;
  return (t || 'Erro desconhecido na integração com o Teams.') + (tag && !t.includes(code) ? tag : '');
}
function msErrText(e) {
  if (e && e.code) return e.message;
  if (e instanceof TypeError) return 'Não foi possível falar com a Microsoft. Confira a conexão com a internet e se o endereço do app está cadastrado como aplicativo de página única (SPA) no Entra.';
  return aadHelp((e && e.message) || '');
}

/* Pedido pronto para o administrador da escola */
function adminConsentUrl() {
  const s = db.settings, tenant = s.msTenant && !/^(common|consumers)$/i.test(s.msTenant) ? s.msTenant : 'organizations';
  const u = new URL('https://login.microsoftonline.com/' + encodeURIComponent(tenant) + '/v2.0/adminconsent');
  u.search = new URLSearchParams({ client_id: s.msClientId || '', scope: 'https://graph.microsoft.com/.default', redirect_uri: msRedirectUri(), state: 'consent' }).toString();
  return u.href;
}
function adminMessage() {
  return 'Olá! Sou aluno(a) da escola e criei um aplicativo pessoal, só de leitura, para ver as minhas tarefas e prazos do Teams em um só lugar.\n\n' +
    'Para ele funcionar, um administrador do Microsoft 365 precisa dar consentimento a estas permissões (todas delegadas e somente leitura):\n' +
    '• EduRoster.ReadBasic: ver as minhas turmas\n• EduAssignments.ReadBasic: ver as minhas tarefas, prazos e se já entreguei, sem notas\n• User.Read: ver o meu nome\n\n' +
    'O app não altera nada no Teams e não acessa mensagens, arquivos nem notas. Para aprovar, abra o link abaixo com uma conta de administrador e aceite:\n' + adminConsentUrl() + '\n\n' +
    'ID do aplicativo: ' + (db.settings.msClientId || '(ainda não configurado)') + '\nObrigado!';
}

/* ---- login ---- */
async function msConnect() {
  ui.msError = ''; ui.msNotice = null;
  const s = db.settings;
  if (ui.embedded) { ui.msError = 'A conexão não funciona dentro do Claude. Abra o app hospedado em HTTPS, conforme o guia em Configurações.'; return render(); }
  if (!secureContextOk()) { ui.msError = 'Este endereço não usa HTTPS. A Microsoft só aceita HTTPS (ou localhost para testes).'; return render(); }
  if (!GUID_RE.test(s.msClientId || '')) { ui.msError = 'Informe o ID do aplicativo antes de conectar.'; return render(); }
  if (!(window.crypto && crypto.subtle)) { ui.msError = 'Este navegador não oferece a criptografia necessária. Abra o app por HTTPS.'; return render(); }
  try {
    const verifier = b64url(crypto.getRandomValues(new Uint8Array(48)).buffer);
    const challenge = b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
    const state = b64url(crypto.getRandomValues(new Uint8Array(16)).buffer);
    lsSet(MS_PKCE, { verifier, state, redirect: msRedirectUri(), t: Date.now() });
    const q = { client_id: s.msClientId, response_type: 'code', redirect_uri: msRedirectUri(), response_mode: 'query', scope: MS_SCOPES, state, code_challenge: challenge, code_challenge_method: 'S256' };
    if (s.msAccount && s.msAccount.email) q.login_hint = s.msAccount.email; else q.prompt = 'select_account';
    const u = new URL('https://login.microsoftonline.com/' + encodeURIComponent(s.msTenant || 'organizations') + '/oauth2/v2.0/authorize');
    u.search = new URLSearchParams(q).toString();
    location.assign(u.href);
  } catch (e) { ui.msError = msErrText(e); render(); }
}
async function msTokenRequest(params, authority) {
  const r = await fetch('https://login.microsoftonline.com/' + encodeURIComponent(authority || db.settings.msTid || db.settings.msTenant || 'organizations') + '/oauth2/v2.0/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(Object.assign({ client_id: db.settings.msClientId, scope: MS_SCOPES }, params)) });
  let j = {}; try { j = await r.json(); } catch (e) { }
  if (!r.ok) throw msFail(aadHelp(j.error_description || j.error || 'Falha ao falar com a Microsoft (' + r.status + ').'), 'auth');
  return j;
}
async function msRefresh() {
  const t = msStore(), expired = () => msFail('Sua sessão expirou. Toque em Reconectar para entrar de novo.', 'expired');
  if (!t || !t.r || t.re <= Date.now() + 60000) throw expired();
  try { msSaveTokens(await msTokenRequest({ grant_type: 'refresh_token', refresh_token: t.r }), false); }
  catch (e) { if (e.code === 'auth') { lsDel(MS_TOK); throw expired(); } throw e; }
}
async function msHandleRedirect() {
  const q = new URLSearchParams(location.search);
  if (!q.has('code') && !q.has('error') && !q.has('admin_consent')) return false;
  const clean = () => { try { history.replaceState(null, '', msRedirectUri() + '#escola'); } catch (e) { } };
  if (q.has('admin_consent')) {
    clean(); ui.route = 'escola';
    ui.msNotice = q.get('admin_consent') === 'True' && !q.get('error') ? { ok: true, text: 'O administrador autorizou o aplicativo. Agora toque em Conectar Microsoft Teams.' } : { ok: false, text: aadHelp(q.get('error_description') || q.get('error') || 'O consentimento não foi concluído.') };
    return true;
  }
  const p = lsGet(MS_PKCE), err = q.get('error'), desc = q.get('error_description'), code = q.get('code'), st = q.get('state');
  clean(); ui.route = 'escola';
  if (!p || !p.t || Date.now() - p.t > 15 * 60 * 1000 || st !== p.state) { lsDel(MS_PKCE); ui.msError = 'A resposta de login não pôde ser validada ou demorou demais. Tente conectar de novo.'; return true; }
  lsDel(MS_PKCE);
  if (err) { ui.msError = aadHelp((desc || err)); return true; }
  try {
    const j = await msTokenRequest({ grant_type: 'authorization_code', code, redirect_uri: p.redirect, code_verifier: p.verifier }, db.settings.msTenant || 'organizations');
    msSaveTokens(j, true);
    const c = parseJwt(j.id_token);
    db.settings.msAccount = { name: c.name || '', email: c.preferred_username || c.email || '' }; db.settings.msTid = c.tid || '';
    persist();
    return 'ok';
  } catch (e) { ui.msError = msErrText(e); return true; }
}

/* ---- Graph ---- */
async function graph(path, retried) {
  let t = msTokens();
  if (!t) { await msRefresh(); t = msTokens(); }
  if (!t) throw msFail('Sua sessão expirou. Toque em Reconectar para entrar de novo.', 'expired');
  const url = /^https:/.test(path) ? path : 'https://graph.microsoft.com/v1.0' + path;
  if (new URL(url).hostname !== 'graph.microsoft.com') throw msFail('Endereço inesperado devolvido pela Microsoft. A sincronização foi interrompida.', 'bad');
  const r = await fetch(url, { headers: { Authorization: 'Bearer ' + t.a } });
  if (r.status === 401) {
    if (!retried) { const st = msStore(); if (st) { st.e = 0; lsSet(MS_TOK, st); } try { await msRefresh(); return graph(path, true); } catch (e) { throw e; } }
    lsDel(MS_TOK); throw msFail('Sua sessão expirou. Toque em Reconectar para entrar de novo.', 'expired');
  }
  if (r.status === 403) { ui.msConsentNeeded = true; throw msFail('A escola não liberou o acesso a turmas e tarefas para este aplicativo. Um administrador do Microsoft 365 precisa dar o consentimento. Use o pedido ao administrador abaixo.', 'forbidden'); }
  if (!r.ok) { let m = ''; try { m = (await r.json()).error.message; } catch (e) { } throw msFail('O Microsoft Graph respondeu ' + r.status + (m ? ': ' + m : '') + '.', 'http'); }
  return r.json();
}
async function graphAll(path) {
  let out = [], url = path, guard = 0;
  while (url && guard++ < 25) { const j = await graph(url); out = out.concat(j.value || []); url = j['@odata.nextLink'] || null; }
  return out;
}
function htmlToText(h) {
  try {
    const doc = new DOMParser().parseFromString(String(h || ''), 'text/html');
    doc.querySelectorAll('script,style').forEach(n => n.remove());
    return (doc.body.textContent || '').replace(/\s+\n/g, '\n').trim().slice(0, 700);
  } catch (e) { return ''; }
}
async function msSync(opts) {
  opts = opts || {};
  if (ui.syncing) return;
  if (!msHasSession()) { if (!opts.silent) { ui.msError = 'Sua sessão expirou. Toque em Reconectar para entrar de novo.'; render(); } return; }
  ui.syncing = true; ui.msError = ''; ui.msConsentNeeded = false; render();
  try {
    const classes = await graphAll('/education/me/classes');
    const subjects = classes.map(c => ({ id: 'teams-' + c.id, name: c.displayName || 'Turma', teacher: '' }));
    const assignments = [], pending = [], skipped = [], synced = [];
    for (const c of classes) {
      const cid = encodeURIComponent(c.id);
      let list;
      try { list = await graphAll('/education/classes/' + cid + '/assignments?$expand=submissions'); }
      catch (e) {
        if (e.code === 'expired') throw e;
        try { list = await graphAll('/education/classes/' + cid + '/assignments'); } catch (e2) { if (e2.code === 'expired') throw e2; skipped.push(c.displayName || 'turma'); continue; }
      }
      if (list.length) synced.push('teams-' + c.id); /* lista vazia nunca apaga o que já foi importado: pode ser falha passageira */
      list.forEach(a => {
        if (a.status === 'draft') return;
        const row = { id: 'teams-' + a.id, subjectId: 'teams-' + c.id, title: a.displayName || 'Atividade sem título', description: htmlToText(a.instructions && a.instructions.content), teacher: (a.assignedBy && a.assignedBy.user && a.assignedBy.user.displayName) || (a.createdBy && a.createdBy.user && a.createdBy.user.displayName) || '', publishedAt: a.assignedDateTime ? toLocalISO(a.assignedDateTime) : '', dueAt: a.dueDateTime ? toLocalISO(a.dueDateTime) : '', url: safeUrl(a.webUrl), submitted: null, submittedAt: null };
        if (Array.isArray(a.submissions) && a.submissions.length) { const sb = a.submissions[0]; row.submitted = sb.status === 'submitted' || sb.status === 'returned'; row.submittedAt = sb.submittedDateTime || null; }
        else if (!Array.isArray(a.submissions)) pending.push({ row, cid, aid: a.id });
        assignments.push(row);
      });
    }
    ui.msConsentNeeded = false; /* um 403 só em uma turma não significa falta de consentimento: a lista de turmas já foi lida */
    for (let i = 0; i < pending.length; i += 5) {
      await Promise.all(pending.slice(i, i + 5).map(async p => {
        try { const subs = await graphAll('/education/classes/' + p.cid + '/assignments/' + encodeURIComponent(p.aid) + '/submissions'); if (subs.length) { p.row.submitted = subs[0].status === 'submitted' || subs[0].status === 'returned'; p.row.submittedAt = subs[0].submittedDateTime || null; } } catch (e) { if (e.code === 'expired') throw e; }
      }));
    }
    const res = mergeTeams(db, { subjects, assignments, syncedSubjectIds: synced });
    persist();
    if (!opts.silent || res.added || res.removed) toast('Teams sincronizado: ' + pl(res.added, 'nova', 'novas') + ', ' + pl(res.updated, 'atualizada', 'atualizadas') + (res.removed ? ', ' + pl(res.removed, 'removida', 'removidas') + ' (apagadas no Teams)' : '') + (skipped.length ? '. Sem acesso a ' + skipped.length + ' turma(s).' : ''));
  } catch (e) { ui.msError = msErrText(e); }
  finally { ui.syncing = false; render(); }
}
function msAutoSync() {
  if (ui.embedded || ui.syncing || ui.modal || !secureContextOk()) return;
  const s = db.settings;
  if (!s.msAccount || !msHasSession()) return;
  if (s.msLastSync && Date.now() - new Date(s.msLastSync) < STALE_MS) return;
  msSync({ silent: true });
}
function msDisconnect() {
  lsDel(MS_TOK); lsDel(MS_PKCE);
  db.settings.msAccount = null; db.settings.msLastSync = null; db.settings.msTid = ''; ui.msError = ''; ui.msNotice = null; ui.msConsentNeeded = false;
  save(); toast('Conta desconectada. As atividades importadas continuam aqui.');
}

/* ---------- exportar e importar ---------- */
function exportPayload() {
  const copy = JSON.parse(JSON.stringify(db));
  copy.settings.msAccount = null; copy.settings.msLastSync = null; copy.settings.msTid = '';
  return { app: 'life-dashboard', schema: SCHEMA, exportedAt: new Date().toISOString(), data: copy };
}
async function getDownloads() { try { if (window.claude && typeof window.claude.use === 'function') return await window.claude.use('downloads'); } catch (e) { } return null; }
async function exportData() {
  const json = JSON.stringify(exportPayload(), null, 2), name = 'life-dashboard-' + ymd(now()) + '.json';
  const dl = await getDownloads();
  if (dl) {
    try { await dl.save({ filename: name, data: json }); markBackup(); toast('Backup exportado'); return; }
    catch (e) { if (e && e.code === 'declined') return toast('Exportação cancelada'); }
    return openModal('export', { json });
  }
  if (!ui.embedded) {
    try { const url = URL.createObjectURL(new Blob([json], { type: 'application/json' })), a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000); markBackup(); toast('Backup exportado'); return; } catch (e) { }
  }
  openModal('export', { json });
}
function parseImport(text) {
  let o; try { o = JSON.parse(text); } catch (e) { throw new Error('O texto não é um JSON válido.'); }
  const data = o && o.data && typeof o.data === 'object' ? o.data : o;
  if (!data || typeof data !== 'object' || !['assignments', 'workouts', 'tasks', 'subjects'].some(k => Array.isArray(data[k]))) throw new Error('Este arquivo não parece ser um backup do LIFE DASHBOARD.');
  if (o.app && o.app !== 'life-dashboard') throw new Error('Este arquivo pertence a outro aplicativo.');
  return normalizeDB(data);
}
function importCheck() {
  const t = ($('#imp-text') || {}).value || '';
  const fail = msg => { ui.modal.data = { error: msg }; drawModal(); };
  if (!t.trim()) return fail('Escolha um arquivo ou cole o conteúdo.');
  try { ui.modal.data = { stage: 'ready', parsed: parseImport(t) }; drawModal(); } catch (e) { fail(e.message); }
}

/* ---------- render e navegação ---------- */
const VIEWS = { 'visao-geral': viewOverview, escola: viewSchool, academia: viewGym, calendario: viewCalendar, tarefas: viewTasks, estatisticas: viewStats, configuracoes: viewSettings };
function applyTheme() {
  const r = document.documentElement;
  r.setAttribute('data-ld-theme', db.settings.theme === 'light' ? 'light' : 'dark');
  r.setAttribute('data-ld-accent', db.settings.accent === 'blue' ? 'blue' : 'violet');
}
function render() {
  const app = $('#app'); if (!app) return;
  let inner;
  try { inner = VIEWS[ui.route](); }
  catch (err) { console.error(err); inner = '<div class="card" role="alert"><b>Não foi possível desenhar esta tela.</b><p class="muted" style="margin:6px 0 12px">' + esc(err && err.message) + '</p><button class="btn sm" data-act="go" data-route="visao-geral">Voltar ao início</button></div>'; }
  app.innerHTML = shellHTML(inner);
  if (ui.scrollTop) { window.scrollTo(0, 0); ui.scrollTop = false; }
  ui.enter = false;
  if (ui.refocus) { const el = $(ui.refocus); if (el) el.focus(); ui.refocus = ''; }
  if (ui.modal && LIVE.has(ui.modal.type)) drawModal();
}
function routeFromHash() { const h = String(location.hash || '').replace('#', ''); return ROUTES.includes(h) ? h : null; }
function go(route) {
  if (!ROUTES.includes(route)) route = 'visao-geral';
  if (ui.modal) closeModal();
  ui.route = route; ui.enter = true; ui.scrollTop = true;
  try { if (location.hash !== '#' + route) location.hash = route; } catch (e) { }
  render();
}
function shiftMonth(ym, d) { const p = ym.split('-').map(Number), x = new Date(p[0], p[1] - 1 + d, 1); return x.getFullYear() + '-' + pad(x.getMonth() + 1); }
function userIsTyping() { const a = document.activeElement; return !!a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && !!a.closest('#app'); }

/* ---------- ações dos botões ---------- */
const A = {
  go: el => go(el.dataset.route),
  more: () => openModal('more'),
  bell: () => openModal('notifs'),
  'close-modal': () => closeModal(),
  'confirm-yes': () => { const fn = ui.confirmFn; ui.confirmFn = null; ui.backModal = null; if (fn) fn(); },
  'confirm-no': () => { const b = ui.backModal; ui.backModal = null; ui.confirmFn = null; if (b) { ui.modal = b; drawModal(true); } else closeModal(); },
  'toast-undo': () => { const fn = ui.undoFn; ui.undoFn = null; const r = $('#toast-root'); if (r) r.innerHTML = ''; if (fn) fn(); },
  'go-guide': () => { ui.guideOpen = true; go('configuracoes'); setTimeout(() => { const g = $('#guide'); if (g) g.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 80); },
  'go-calendar-school': () => { const t = ymd(now()); ui.cal.layers = { escola: true, academia: false, tarefas: false }; ui.cal.mode = 'mes'; ui.cal.cursor = t; ui.cal.sel = t; go('calendario'); },

  /* escola */
  'school-bucket': el => { const b = el.dataset.bucket; ui.school.bucket = ui.school.bucket === b ? null : b; if (ui.school.bucket && ui.school.status === 'concluida') ui.school.status = 'aberto'; render(); },
  'school-bucket-go': el => { Object.assign(ui.school, { bucket: el.dataset.bucket, status: 'aberto', subject: 'all', q: '' }); go('escola'); },
  'school-status': el => { ui.school.status = el.dataset.status; render(); },
  'school-view': el => { ui.school.view = el.dataset.view; render(); },
  'manage-subjects': () => openModal('subjects'),
  'subject-new': () => openModal('subject', {}),
  'subject-edit': el => openModal('subject', { id: el.dataset.id }),
  'subjects-back': () => { ui.modal = { type: 'subjects', data: {} }; drawModal(true); },
  'subject-del': el => {
    const s = byId(db.subjects, el.dataset.id); if (!s) return;
    const n = db.assignments.filter(a => a.subjectId === s.id).length;
    askConfirm({ title: 'Excluir matéria?', text: '“' + s.name + '” será removida.' + (n ? ' ' + pl(n, 'atividade fica', 'atividades ficam') + ' sem matéria.' : ''), ok: 'Excluir' }, () => {
      db.subjects = db.subjects.filter(x => x.id !== s.id);
      db.assignments.forEach(a => { if (a.subjectId === s.id) a.subjectId = ''; });
      if (ui.school.subject === s.id) ui.school.subject = 'all';
      ui.modal = { type: 'subjects', data: {} }; save(); drawModal(true); toast('Matéria excluída');
    });
  },
  'new-assignment': el => openModal('assignment', { date: el.dataset.date || '' }),
  'edit-assignment': el => openModal('assignment', { id: el.dataset.id }),
  'del-assignment': el => {
    const a = byId(db.assignments, el.dataset.id); if (!a) return;
    askConfirm({ title: 'Excluir atividade?', text: '“' + a.title + '” será removida.', ok: 'Excluir' }, () => { db.assignments = db.assignments.filter(x => x.id !== a.id); closeModal(); save(); toast('Atividade excluída'); });
  },
  'toggle-assignment': el => {
    const a = byId(db.assignments, el.dataset.id); if (!a) return;
    const before = { status: a.status, doneBy: a.doneBy, completedAt: a.completedAt }, stamp = new Date().toISOString();
    if (a.status === 'concluida') { a.status = 'pendente'; a.doneBy = null; a.completedAt = null; } else { a.status = 'concluida'; a.doneBy = 'user'; a.completedAt = stamp; }
    a.updatedAt = stamp; const done = a.status === 'concluida'; save();
    toast(done ? 'Atividade concluída' : 'Atividade reaberta', () => { Object.assign(a, before); save(); });
  },
  'progress-assignment': el => { const a = byId(db.assignments, el.dataset.id); if (!a) return; a.status = a.status === 'andamento' ? 'pendente' : 'andamento'; a.updatedAt = new Date().toISOString(); save(); },
  'sync-teams': () => msSync(),
  'ms-connect': () => msConnect(),
  'ms-disconnect': () => msDisconnect(),

  /* academia */
  'new-workout': el => openModal('workout', { date: el.dataset.date || '', kind: el.dataset.kind || '' }),
  'edit-workout': el => openModal('workout', { id: el.dataset.id }),
  'del-workout': el => {
    const w = byId(db.workouts, el.dataset.id); if (!w) return;
    askConfirm({ title: 'Excluir registro?', text: 'O registro de ' + fmtShort(w.date) + ' será removido.', ok: 'Excluir' }, () => { db.workouts = db.workouts.filter(x => x.id !== w.id); closeModal(); save(); toast('Registro excluído'); });
  },
  'complete-workout': el => { const w = byId(db.workouts, el.dataset.id); if (!w) return; const t = ymd(now()); w.kind = 'treino'; if (w.date > t) w.date = t; if (!w.time) w.time = hhmm(now()); w.updatedAt = new Date().toISOString(); w.demo = false; save(); toast('Treino marcado como realizado'); },
  'gym-day': el => openModal('gymday', { date: el.dataset.date }),
  'quick-rest': el => { const date = el.dataset.date, stamp = new Date().toISOString(); db.workouts.push({ id: uid(), demo: false, date, time: '', kind: 'descanso', muscles: [], type: '', duration: null, notes: '', createdAt: stamp, updatedAt: stamp }); save(); toast('Descanso registrado'); },
  'gym-prev': () => { ui.gym.month = shiftMonth(ui.gym.month, -1); render(); },
  'gym-next': () => { ui.gym.month = shiftMonth(ui.gym.month, 1); render(); },
  'gym-today': () => { ui.gym.month = ymd(now()).slice(0, 7); render(); },
  'gym-kind': el => { ui.gym.kind = el.dataset.kind; ui.gym.limit = 40; render(); },
  'gym-more': () => { ui.gym.limit += 40; render(); },
  'goal-minus': () => { db.settings.weeklyGoal = Math.max(1, (+db.settings.weeklyGoal || 4) - 1); save(); },
  'goal-plus': () => { db.settings.weeklyGoal = Math.min(7, (+db.settings.weeklyGoal || 4) + 1); save(); },

  /* tarefas */
  'new-task': el => openModal('task', { date: el.dataset.date || '', cat: el.dataset.cat || '' }),
  'edit-task': el => openModal('task', { id: el.dataset.id }),
  'del-task': el => {
    const t = byId(db.tasks, el.dataset.id); if (!t) return;
    askConfirm({ title: 'Excluir tarefa?', text: '“' + t.title + '” será removida.', ok: 'Excluir' }, () => { db.tasks = db.tasks.filter(x => x.id !== t.id); closeModal(); save(); toast('Tarefa excluída'); });
  },
  'toggle-task': el => {
    const t = byId(db.tasks, el.dataset.id); if (!t) return;
    const before = { done: t.done, doneAt: t.doneAt }, stamp = new Date().toISOString();
    t.done = !t.done; t.doneAt = t.done ? stamp : null; t.updatedAt = stamp; const done = t.done; save();
    toast(done ? 'Tarefa concluída' : 'Tarefa reaberta', () => { Object.assign(t, before); save(); });
  },
  'task-cat': el => { ui.tasks.cat = el.dataset.cat; render(); },

  /* calendário */
  'cal-prev': () => { const c = ui.cal, d = parseYmd(c.cursor); c.cursor = c.mode === 'mes' ? ymd(new Date(d.getFullYear(), d.getMonth() - 1, 1)) : ymd(addDays(d, -7)); render(); },
  'cal-next': () => { const c = ui.cal, d = parseYmd(c.cursor); c.cursor = c.mode === 'mes' ? ymd(new Date(d.getFullYear(), d.getMonth() + 1, 1)) : ymd(addDays(d, 7)); render(); },
  'cal-today': () => { const t = ymd(now()); ui.cal.cursor = t; ui.cal.sel = t; render(); },
  'cal-mode': el => { ui.cal.mode = el.dataset.mode; if (ui.cal.mode === 'semana') ui.cal.cursor = ui.cal.sel; render(); },
  'cal-layer': el => { const k = el.dataset.layer; ui.cal.layers[k] = !ui.cal.layers[k]; render(); },
  'cal-pick': el => {
    const d = el.dataset.date, c = ui.cal;
    c.sel = d;
    if (ui.route !== 'calendario') { c.cursor = d; c.mode = 'mes'; go('calendario'); return; }
    if (c.mode === 'mes' && d.slice(0, 7) !== c.cursor.slice(0, 7)) c.cursor = d;
    render();
    if (window.matchMedia('(max-width:1099px)').matches) { const p = $('.side-p'); if (p) p.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
  },
  'cal-open': el => { const t = el.dataset.type, id = el.dataset.id; if (t === 'assignment') openModal('assignment', { id }); else if (t === 'task') openModal('task', { id }); else openModal('workout', { id }); },
  'mini-prev': () => { ui.mini = shiftMonth(ui.mini, -1); render(); },
  'mini-next': () => { ui.mini = shiftMonth(ui.mini, 1); render(); },

  /* notificações */
  'notif-open': el => {
    const id = el.dataset.id, x = buildNotifications(db, now()).find(n => n.id === id);
    markRead([id]); if (!x) return drawModal();
    if (x.route === 'escola') { ui.school.bucket = x.filter || null; ui.school.status = 'aberto'; ui.school.subject = 'all'; ui.school.q = ''; }
    go(x.route);
  },
  'notif-readall': () => { markRead(buildNotifications(db, now()).map(n => n.id)); toast('Tudo marcado como lido'); },

  /* configurações e dados */
  'set-theme': el => { db.settings.theme = el.dataset.v; applyTheme(); save(); },
  'set-accent': el => { db.settings.accent = el.dataset.v; applyTheme(); save(); },
  'set-weekstart': el => { db.settings.weekStart = +el.dataset.v; save(); },
  copy: el => copyText(el.dataset.text),
  'copy-export': () => { const t = $('#exp-text'); copyText(t ? t.value : '', true); },
  'exp-select': () => { const t = $('#exp-text'); if (t) { t.focus(); t.select(); } },
  export: () => exportData(),
  import: () => openModal('import', {}),
  'import-check': () => importCheck(),
  'import-apply': () => {
    const parsed = ui.modal && ui.modal.data && ui.modal.data.parsed; if (!parsed) return;
    try { localStorage.setItem(STORE_KEY + '.antes-de-importar', JSON.stringify(db)); } catch (e) { }
    db = parsed; db.settings.demoSeeded = true; applyTheme(); closeModal(); save(); toast('Dados importados');
  },
  'clear-demo': () => askConfirm({ title: 'Remover dados de exemplo?', text: 'Só os itens com a etiqueta Exemplo serão apagados. O que você cadastrou fica.', ok: 'Remover exemplos' }, () => { removeDemo(db); closeModal(); save(); toast('Exemplos removidos'); }),
  wipe: () => askConfirm({ title: 'Apagar todos os dados?', text: 'Atividades, treinos, tarefas e configurações deste navegador serão apagados. Não tem volta. Exporte um backup antes se quiser guardar.', ok: 'Apagar tudo' }, () => {
    const keep = { theme: db.settings.theme, accent: db.settings.accent };
    db = defaultDB(); db.settings.demoSeeded = true; Object.assign(db.settings, keep);
    lsDel(MS_TOK); lsDel(MS_PKCE);
    ui.school = { status: 'aberto', subject: 'all', bucket: null, q: '', view: 'lista' }; ui.tasks.cat = 'all';
    closeModal(); save(); toast('Dados apagados');
  })
};
function markRead(ids) {
  const cur = new Set(buildNotifications(db, now()).map(n => n.id)), next = {};
  cur.forEach(id => { if (db.readNotifs[id] || ids.includes(id)) next[id] = true; });
  db.readNotifs = next; save();
}
function copyText(text, backup) {
  const done = () => { toast('Copiado'); if (backup) markBackup(); };
  const fallback = () => toast('Não foi possível copiar. Selecione o texto e copie manualmente.');
  try { navigator.clipboard.writeText(text).then(done, fallback); } catch (e) { fallback(); }
}

A['copy-admin-msg'] = () => copyText(adminMessage());
A['copy-admin-link'] = () => copyText(adminConsentUrl());
A['install-app'] = async () => { const ev = ui.installEvt; if (!ev) return; ui.installEvt = null; try { ev.prompt(); await ev.userChoice; } catch (e) { } render(); };
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); ui.installEvt = e; if (ui.route === 'configuracoes' && !ui.modal) render(); });
window.addEventListener('appinstalled', () => { ui.installEvt = null; toast('App instalado no celular'); render(); });

/* ---------- eventos ---------- */
document.addEventListener('pointerdown', e => { ui.downEl = e.target; }, true);
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]'); if (!el) return;
  const act = el.dataset.act;
  if (act === 'overlay') { if (e.target === el && ui.downEl === el) closeModal(); return; }
  const fn = A[act]; if (!fn) return;
  if (el.tagName === 'A') e.preventDefault();
  fn(el, e);
});
document.addEventListener('submit', e => {
  const f = e.target, h = FORMS[f.dataset.form || f.id];
  e.preventDefault(); if (h) h(f);
});
document.addEventListener('input', e => {
  const t = e.target;
  if (t.id === 'school-q') { ui.school.q = t.value; const l = $('#school-list'); if (l) l.innerHTML = schoolList(now()); }
});
document.addEventListener('change', e => {
  const t = e.target;
  if (t.id === 'school-subject') { ui.school.subject = t.value; const l = $('#school-list'); if (l) l.innerHTML = schoolList(now()); }
  else if (t.id === 'set-name') { db.settings.name = t.value.trim().slice(0, 40); persist(); toast('Nome salvo'); }
  else if (t.id === 'a-subject') { const f = $('#a-newsub'); if (f) { f.hidden = t.value !== '__new__'; if (!f.hidden) { const i = $('#a-newname'); if (i) i.focus(); } } }
  else if (t.name === 'kind' && t.closest('form[data-form="workout"]')) { const w = $('#w-fields'); if (w) w.hidden = t.value === 'descanso'; }
  else if (t.id === 'imp-file' && t.files && t.files[0]) {
    const fr = new FileReader();
    fr.onload = () => { const x = $('#imp-text'); if (x) { x.value = String(fr.result || ''); importCheck(); } };
    fr.onerror = () => { ui.modal.data = { error: 'Não foi possível ler o arquivo.' }; drawModal(); };
    fr.readAsText(t.files[0]);
  }
});
document.addEventListener('toggle', e => { if (e.target && e.target.id === 'guide') ui.guideOpen = e.target.open; }, true);
document.addEventListener('keydown', e => {
  if (!ui.modal) return;
  if (e.key === 'Escape') { e.preventDefault(); if (ui.modal.type === 'confirm') A['confirm-no'](); else closeModal(); return; }
  if (e.key === 'Tab') {
    const m = $('#modal-root .modal'); if (!m) return;
    const f = Array.from(m.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),select,textarea,[tabindex]:not([tabindex="-1"])')).filter(x => x.offsetParent !== null);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    else if (!m.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
  }
});
window.addEventListener('hashchange', () => { const r = routeFromHash(); if (r && r !== ui.route) { if (ui.modal) closeModal(); ui.route = r; ui.enter = true; ui.scrollTop = true; render(); } });
window.addEventListener('storage', e => {
  if (e.key === MS_TOK) { if (!ui.modal && !userIsTyping()) render(); return; }
  if (e.key !== STORE_KEY || !e.newValue || ui.modal) return;
  try { db = normalizeDB(JSON.parse(e.newValue)); applyTheme(); render(); } catch (err) { }
});

/* ---------- relógio e atualização ---------- */
let lastMinute = '';
function tick() {
  const n = now(), c = $('#clock');
  if (c) c.innerHTML = clockHTML(n);
  const key = ymd(n) + hhmm(n);
  if (key !== lastMinute) { const first = lastMinute === ''; lastMinute = key; if (!first && !ui.modal && !userIsTyping() && !ui.syncing) render(); }
}
document.addEventListener('visibilitychange', () => { if (!document.hidden && !ui.modal && !userIsTyping()) { render(); msAutoSync(); } });

/* ---------- inicialização ---------- */
async function init() {
  try { ui.embedded = window.self !== window.top || !!window.claude; } catch (e) { ui.embedded = true; }
  ui.storageOk = probeStorage();
  db = ui.storageOk ? loadStored() : null;
  if (!db) { db = defaultDB(); if (!db.settings.demoSeeded) seedDemo(db); persist(); }
  applyTheme();
  const cfg = window.LIFEDASH_CONFIG || {};
  if (!ui.embedded && cfg.msClientId && GUID_RE.test(cfg.msClientId) && !db.settings.msClientId) { db.settings.msClientId = cfg.msClientId; if (cfg.msTenant && /^[A-Za-z0-9.-]+$/.test(cfg.msTenant)) db.settings.msTenant = cfg.msTenant; persist(); }
  const t = ymd(now());
  ui.cal.cursor = t; ui.cal.sel = t; ui.gym.month = t.slice(0, 7); ui.mini = t.slice(0, 7);
  ui.route = routeFromHash() || 'visao-geral'; ui.enter = true;
  const redirected = ui.embedded ? false : await msHandleRedirect();
  render();
  if (ui.recovered) toast('Os dados salvos estavam corrompidos. Uma cópia foi guardada e o app começou limpo.');
  if (redirected === 'ok') { toast('Conta Microsoft conectada'); msSync(); }
  tick(); setInterval(tick, 1000);
  if (!ui.embedded && 'serviceWorker' in navigator && secureContextOk()) navigator.serviceWorker.register('sw.js').catch(() => { });
  if (redirected !== 'ok') msAutoSync();
  setInterval(msAutoSync, 10 * 60 * 1000);
}
init();
