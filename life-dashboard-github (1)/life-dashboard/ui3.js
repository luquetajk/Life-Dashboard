/* ===== LIFE DASHBOARD: armazenamento, modais e formulários ===== */
const $ = (s, r) => (r || document).querySelector(s);
const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
const byId = (list, id) => list.find(x => x.id === id);

/* ---------- armazenamento local ---------- */
function probeStorage() { try { localStorage.setItem('lifedash.probe', '1'); localStorage.removeItem('lifedash.probe'); return true; } catch (e) { return false; } }
function loadStored() {
  let raw = null;
  try { raw = localStorage.getItem(STORE_KEY); } catch (e) { return null; }
  if (!raw) return null;
  try { return normalizeDB(JSON.parse(raw)); }
  catch (e) { try { localStorage.setItem(STORE_KEY + '.corrompido-' + Date.now(), raw); } catch (_) { } ui.recovered = true; return null; }
}
function persist() {
  try { db.meta.updatedAt = new Date().toISOString(); localStorage.setItem(STORE_KEY, JSON.stringify(db)); ui.storageOk = true; }
  catch (e) { ui.storageOk = false; }
}
function save() { persist(); render(); }
function markBackup() { db.settings.lastBackupAt = new Date().toISOString(); save(); }

/* ---------- aviso rápido ---------- */
let toastTimer = 0;
function toast(msg, undo) {
  ui.undoFn = undo || null;
  const r = $('#toast-root'); if (!r) return;
  r.innerHTML = '<div class="toast" role="status"><span>' + esc(msg) + '</span>' + (undo ? '<button class="link" data-act="toast-undo" style="color:inherit;margin-left:14px;text-decoration:underline">Desfazer</button>' : '') + '</div>';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { r.innerHTML = ''; ui.undoFn = null; }, undo ? 5500 : 2800);
}

/* ---------- peças de formulário ---------- */
const fld = (label, id, inner, hint) => '<div class="fld"><label for="' + id + '">' + label + '</label>' + inner + (hint ? '<small>' + hint + '</small>' : '') + '</div>';
const inp = (id, name, val, extra) => '<input class="in" id="' + id + '" name="' + name + '" value="' + esc(val == null ? '' : val) + '" ' + (extra || '') + '>';
const radios = (name, opts, cur, cls) => '<div class="' + (cls || 'segc fill') + '" role="radiogroup">' + opts.map(o => '<label class="cb"><input type="radio" name="' + name + '" value="' + esc(o[0]) + '"' + (String(cur) === String(o[0]) ? ' checked' : '') + '><span>' + esc(o[1]) + '</span></label>').join('') + '</div>';
const formErr = () => '<p class="err" id="form-err" role="alert"></p>';
function formError(f, msg, field) {
  const e = $('#form-err', f); if (e) e.textContent = msg;
  const el = field ? f.elements[field] : null; if (el && el.focus) el.focus();
}
function modalShell(title, body, o) {
  o = o || {};
  return '<div class="overlay' + (o.drawer ? ' drawer-o' : '') + '" data-act="overlay"><div class="modal' + (o.wide ? ' wide' : '') + '" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modal-h"><h2 id="modal-title">' + title + '</h2><button class="icon-btn" data-act="close-modal" aria-label="Fechar">' + ic('x', 20) + '</button></div><div class="modal-b">' + body + '</div></div></div>';
}
function askConfirm(o, fn) {
  ui.backModal = ui.modal && ui.modal.type !== 'confirm' ? ui.modal : null;
  ui.confirmFn = fn;
  openModal('confirm', o);
}

/* ---------- construtores de modal ---------- */
const MODALS = {};
const LIVE = new Set(['notifs', 'gymday', 'subjects']);

MODALS.assignment = d => {
  const a = d.id ? byId(db.assignments, d.id) : null;
  if (d.id && !a) return null;
  const v = a || { title: '', subjectId: '', description: '', teacher: '', publishedAt: ymd(now()), dueAt: d.date || '', url: '', status: 'pendente', source: 'manual' };
  const dueDate = v.dueAt ? String(v.dueAt).slice(0, 10) : '', dueTime = v.dueAt && String(v.dueAt).includes('T') ? String(v.dueAt).slice(11, 16) : '';
  const noSubj = !db.subjects.length;
  const opts = '<option value="">Sem matéria</option>' + db.subjects.map(s => '<option value="' + esc(s.id) + '"' + (s.id === v.subjectId ? ' selected' : '') + '>' + esc(s.name) + '</option>').join('') + '<option value="__new__"' + (noSubj && !a ? ' selected' : '') + '>+ Nova matéria…</option>';
  const body = '<form class="form" data-form="assignment" novalidate><input type="hidden" name="id" value="' + esc(a ? a.id : '') + '">' +
    (a && a.source === 'teams' ? '<div class="banner" style="padding:10px 14px"><p style="font-size:13px">Esta atividade vem do Teams. Título e prazo são atualizados a cada sincronização.</p></div>' : '') +
    fld('Nome da atividade', 'a-title', inp('a-title', 'title', v.title, 'maxlength="160" required autocomplete="off"')) +
    fld('Matéria', 'a-subject', '<select class="in" id="a-subject" name="subject">' + opts + '</select>') +
    '<div class="fld" id="a-newsub"' + (noSubj && !a ? '' : ' hidden') + '><label for="a-newname">Nome da nova matéria</label>' + inp('a-newname', 'newsubject', '', 'maxlength="60" autocomplete="off"') + '</div>' +
    '<div class="two">' + fld('Prazo de entrega', 'a-due', '<input class="in" type="date" id="a-due" name="dueDate" value="' + esc(dueDate) + '">') + fld('Horário', 'a-duetime', '<input class="in" type="time" id="a-duetime" name="dueTime" value="' + esc(dueTime) + '">') + '</div>' +
    '<div class="fld"><span class="lbl">Status</span>' + radios('status', [['pendente', 'Pendente'], ['andamento', 'Em andamento'], ['concluida', 'Concluída']], v.status === 'concluida' ? 'concluida' : v.status === 'andamento' ? 'andamento' : 'pendente') + '</div>' +
    '<div class="two">' + fld('Professor', 'a-teacher', inp('a-teacher', 'teacher', v.teacher, 'maxlength="80" autocomplete="off"')) + fld('Data de publicação', 'a-pub', '<input class="in" type="date" id="a-pub" name="publishedAt" value="' + esc(v.publishedAt ? String(v.publishedAt).slice(0, 10) : '') + '">') + '</div>' +
    fld('Descrição', 'a-desc', '<textarea class="in" id="a-desc" name="description" maxlength="2000">' + esc(v.description) + '</textarea>') +
    fld('Link da atividade (opcional)', 'a-url', inp('a-url', 'url', v.url, 'inputmode="url" placeholder="https://" autocomplete="off"')) +
    formErr() + '<div class="form-a">' + (a ? '<button type="button" class="btn danger grow" data-act="del-assignment" data-id="' + a.id + '">' + ic('trash', 16) + ' Excluir</button>' : '') + '<button type="button" class="btn ghost" data-act="close-modal">Cancelar</button><button class="btn primary" type="submit">' + (a ? 'Salvar' : 'Criar atividade') + '</button></div></form>';
  return { title: a ? 'Editar atividade' : 'Nova atividade', body, focus: a ? '' : '#a-title' };
};

MODALS.task = d => {
  const t = d.id ? byId(db.tasks, d.id) : null;
  if (d.id && !t) return null;
  const v = t || { title: '', description: '', date: d.date || ymd(now()), time: '', priority: 'media', category: d.cat || 'pessoal' };
  const body = '<form class="form" data-form="task" novalidate><input type="hidden" name="id" value="' + esc(t ? t.id : '') + '">' +
    fld('Título', 't-title', inp('t-title', 'title', v.title, 'maxlength="140" required autocomplete="off"')) +
    '<div class="two">' + fld('Data', 't-date', '<input class="in" type="date" id="t-date" name="date" value="' + esc(v.date) + '">') + fld('Horário', 't-time', '<input class="in" type="time" id="t-time" name="time" value="' + esc(v.time) + '">') + '</div>' +
    '<div class="fld"><span class="lbl">Prioridade</span>' + radios('priority', PRIORITIES.map(p => [p.id, p.label]), v.priority) + '</div>' +
    '<div class="fld"><span class="lbl">Categoria</span>' + radios('category', CATEGORIES.map(c => [c.id, c.label]), v.category, 'chips wrap') + '</div>' +
    fld('Descrição', 't-desc', '<textarea class="in" id="t-desc" name="description" maxlength="1000">' + esc(v.description) + '</textarea>') +
    formErr() + '<div class="form-a">' + (t ? '<button type="button" class="btn danger grow" data-act="del-task" data-id="' + t.id + '">' + ic('trash', 16) + ' Excluir</button>' : '') + '<button type="button" class="btn ghost" data-act="close-modal">Cancelar</button><button class="btn primary" type="submit">' + (t ? 'Salvar' : 'Criar tarefa') + '</button></div></form>';
  return { title: t ? 'Editar tarefa' : 'Nova tarefa', body, focus: t ? '' : '#t-title' };
};

MODALS.workout = d => {
  const w = d.id ? byId(db.workouts, d.id) : null;
  if (d.id && !w) return null;
  const today = ymd(now());
  const date = w ? w.date : (d.date || today);
  const kind = w ? w.kind : (d.kind || (date > today ? 'programado' : 'treino'));
  const v = w || { date, time: date === today && kind !== 'programado' ? hhmm(now()) : '', muscles: [], type: 'Musculação', duration: '', notes: '' };
  const muscles = MUSCLES.map(m => '<label class="cb"><input type="checkbox" name="muscles" value="' + esc(m) + '"' + ((v.muscles || []).includes(m) ? ' checked' : '') + '><span>' + esc(m) + '</span></label>').join('');
  const types = WORKOUT_TYPES.map(t => '<option' + (t === v.type ? ' selected' : '') + '>' + esc(t) + '</option>').join('');
  const body = '<form class="form" data-form="workout" novalidate><input type="hidden" name="id" value="' + esc(w ? w.id : '') + '">' +
    '<div class="fld"><span class="lbl">Tipo de registro</span>' + radios('kind', [['treino', 'Fui à academia'], ['programado', 'Programado'], ['descanso', 'Descanso']], kind) + '</div>' +
    '<div class="two">' + fld('Data', 'w-date', '<input class="in" type="date" id="w-date" name="date" value="' + esc(v.date) + '" required>') + fld('Horário', 'w-time', '<input class="in" type="time" id="w-time" name="time" value="' + esc(v.time || '') + '">') + '</div>' +
    '<div id="w-fields" class="form"' + (kind === 'descanso' ? ' hidden' : '') + '><div class="fld"><span class="lbl">Grupo muscular treinado</span><div class="chips wrap">' + muscles + '</div></div>' +
    '<div class="two">' + fld('Tipo de treino', 'w-type', '<select class="in" id="w-type" name="type">' + types + '</select>') + fld('Duração (minutos)', 'w-dur', '<input class="in" type="number" id="w-dur" name="duration" min="1" max="600" inputmode="numeric" value="' + esc(v.duration || '') + '" placeholder="60">') + '</div></div>' +
    fld('Observações', 'w-notes', '<textarea class="in" id="w-notes" name="notes" maxlength="1000" placeholder="Cargas, sensações, o que melhorar">' + esc(v.notes || '') + '</textarea>') +
    formErr() + '<div class="form-a">' + (w ? '<button type="button" class="btn danger grow" data-act="del-workout" data-id="' + w.id + '">' + ic('trash', 16) + ' Excluir</button>' : '') + '<button type="button" class="btn ghost" data-act="close-modal">Cancelar</button><button class="btn primary" type="submit">' + (w ? 'Salvar' : 'Registrar') + '</button></div></form>';
  return { title: w ? 'Editar registro' : 'Registrar treino', body, focus: '' };
};

MODALS.subject = d => {
  const s = d.id ? byId(db.subjects, d.id) : null;
  if (d.id && !s) return null;
  const v = s || { name: '', teacher: '', color: nextColor(db) };
  const sw = SUBJECT_COLORS.map(c => '<label class="swatch" style="--c:' + c + '"><input type="radio" name="color" value="' + c + '"' + (v.color === c ? ' checked' : '') + ' aria-label="Cor ' + c + '"><span></span></label>').join('');
  const body = '<form class="form" data-form="subject" novalidate><input type="hidden" name="id" value="' + esc(s ? s.id : '') + '">' +
    fld('Nome da matéria', 's-name', inp('s-name', 'name', v.name, 'maxlength="60" required autocomplete="off"')) +
    fld('Professor (opcional)', 's-teacher', inp('s-teacher', 'teacher', v.teacher, 'maxlength="80" autocomplete="off"')) +
    '<div class="fld"><span class="lbl">Cor</span><div class="swatches">' + sw + '</div></div>' + formErr() +
    '<div class="form-a"><button type="button" class="btn ghost" data-act="subjects-back">Voltar</button><button class="btn primary" type="submit">Salvar matéria</button></div></form>';
  return { title: s ? 'Editar matéria' : 'Nova matéria', body, focus: s ? '' : '#s-name' };
};

MODALS.subjects = () => {
  const rows = db.subjects.map(s => '<div class="li compact"><span class="ico-t" style="--c:' + safeColor(s.color) + '">' + ic('book', 18) + '</span><div class="li-b"><div class="li-t">' + esc(s.name) + '</div><div class="li-m">' + (s.teacher ? '<span>' + esc(s.teacher) + '</span>' : '') + (s.source === 'teams' ? '<span class="pill info">Teams</span>' : '') + (s.demo ? '<span class="pill ex">Exemplo</span>' : '') + '<span>' + pl(db.assignments.filter(a => a.subjectId === s.id).length, 'atividade', 'atividades') + '</span></div></div><div class="li-r"><div class="li-a"><button class="icon-btn sm" data-act="subject-edit" data-id="' + s.id + '" aria-label="Editar ' + esc(s.name) + '">' + ic('edit', 16) + '</button><button class="icon-btn sm" data-act="subject-del" data-id="' + s.id + '" aria-label="Excluir ' + esc(s.name) + '">' + ic('trash', 16) + '</button></div></div></div>').join('');
  return { title: 'Matérias', body: (rows ? '<div class="list">' + rows + '</div>' : emptyState('book', 'Nenhuma matéria cadastrada.', '')) + '<div class="form-a" style="margin-top:14px"><button class="btn primary" data-act="subject-new">' + ic('plus', 16) + ' Nova matéria</button></div>', focus: '' };
};

MODALS.gymday = d => {
  const n = now(), today = ymd(n), date = d.date, recs = db.workouts.filter(w => w.date === date).sort((a, b) => (a.time || '').localeCompare(b.time || ''));
  const hasRest = recs.some(w => w.kind === 'descanso');
  const st = dayGymState(db, date, n);
  const stText = { ok: 'Treino realizado', plan: 'Treino programado', rest: 'Dia de descanso', none: 'Sem registro de treino', future: 'Nenhum treino programado' }[st];
  const body = '<p class="muted" style="margin-bottom:12px">' + stText + '</p>' + (recs.length ? '<div class="card flush" style="margin-bottom:14px">' + recs.map(workoutRow).join('') + '</div>' : '') +
    '<div class="form-a" style="justify-content:flex-start">' + (date <= today ? '<button class="btn primary" data-act="new-workout" data-date="' + date + '" data-kind="treino">' + ic('plus', 16) + ' Registrar treino</button>' : '') +
    (date >= today ? '<button class="btn ' + (date > today ? 'primary' : '') + '" data-act="new-workout" data-date="' + date + '" data-kind="programado">' + ic('clock', 16) + ' Programar treino</button>' : '') +
    (hasRest ? '' : '<button class="btn" data-act="quick-rest" data-date="' + date + '">' + ic('moon', 16) + ' Marcar descanso</button>') + '</div>';
  return { title: esc(cap(fmtLong(parseYmd(date)))), body, focus: '' };
};

MODALS.notifs = () => {
  const list = buildNotifications(db, now()), tone = { bad: 'var(--bad)', warn: 'var(--warn)', info: 'var(--info)', ok: 'var(--ok)' };
  const body = list.length ? '<div class="notif-l">' + list.map(x => '<button class="notif' + (db.readNotifs[x.id] ? ' read' : '') + '" data-act="notif-open" data-id="' + esc(x.id) + '"><span class="ico-t" style="--c:' + tone[x.level] + '">' + ic(x.icon, 18) + '</span><div style="min-width:0"><b>' + esc(x.title) + '</b>' + (x.text ? '<p>' + esc(x.text) + '</p>' : '') + '</div></button>').join('') + '</div><div class="form-a" style="margin-top:14px"><button class="btn" data-act="notif-readall">' + ic('check', 16) + ' Marcar todas como lidas</button></div>' : emptyState('bell', 'Nenhum aviso por enquanto. Quando algo precisar da sua atenção, aparece aqui.', '');
  return { title: 'Notificações', body, drawer: true, focus: '' };
};

MODALS.more = () => ({ title: 'Mais seções', body: '<nav class="nav" aria-label="Mais seções">' + NAV.filter(i => !i.tab).map(i => '<a href="#' + i.id + '" data-act="go" data-route="' + i.id + '">' + ic(i.icon, 20) + '<span>' + i.label + '</span></a>').join('') + '</nav>', focus: '' });

MODALS.confirm = d => ({ title: esc(d.title), body: '<p style="color:var(--fg-2);margin-bottom:18px">' + esc(d.text || '') + '</p><div class="form-a"><button class="btn ghost" data-act="confirm-no">Cancelar</button><button class="btn ' + (d.danger === false ? 'primary' : 'danger') + '" data-act="confirm-yes">' + esc(d.ok || 'Confirmar') + '</button></div>', focus: '[data-act="confirm-no"]' });

MODALS.export = d => ({ title: 'Exportar dados', wide: true, body: '<p class="muted" style="margin-bottom:12px;font-size:14px">Este navegador não deixou baixar o arquivo. Copie o texto abaixo e cole em um arquivo com final .json para guardar como backup.</p><textarea class="in" id="exp-text" readonly rows="10" style="font:12px/1.5 ui-monospace,Menlo,Consolas,monospace">' + esc(d.json) + '</textarea><div class="form-a" style="margin-top:12px"><button class="btn" data-act="exp-select">Selecionar tudo</button><button class="btn primary" data-act="copy-export">' + ic('copy', 16) + ' Copiar</button></div>', focus: '#exp-text' });

MODALS.import = d => {
  let inner;
  if (d.stage === 'ready') {
    const x = d.parsed;
    inner = '<div class="banner"><p><b>Pronto para importar:</b> ' + pl(x.assignments.length, 'atividade', 'atividades') + ', ' + pl(x.workouts.length, 'registro de academia', 'registros de academia') + ', ' + pl(x.tasks.length, 'tarefa', 'tarefas') + ' e ' + pl(x.subjects.length, 'matéria', 'matérias') + '. Isto substitui os dados atuais. Uma cópia dos dados atuais fica guardada neste navegador.</p></div><div class="form-a" style="margin-top:14px"><button class="btn ghost" data-act="import">Escolher outro</button><button class="btn primary" data-act="import-apply">Substituir meus dados</button></div>';
  } else {
    inner = '<p class="muted" style="margin-bottom:12px;font-size:14px">Escolha um arquivo exportado por este app ou cole o conteúdo dele abaixo.</p><div class="fld"><label for="imp-file">Arquivo JSON</label><input class="in" type="file" id="imp-file" accept=".json,application/json" style="padding-top:10px"></div><div class="fld" style="margin-top:12px"><label for="imp-text">Ou cole o conteúdo</label><textarea class="in" id="imp-text" rows="6" placeholder="{ &quot;app&quot;: &quot;life-dashboard&quot;, … }" style="font:12px/1.5 ui-monospace,Menlo,Consolas,monospace"></textarea></div><p class="err" id="imp-err" role="alert" style="margin-top:8px">' + esc(d.error || '') + '</p><div class="form-a" style="margin-top:8px"><button class="btn ghost" data-act="close-modal">Cancelar</button><button class="btn primary" data-act="import-check">Verificar arquivo</button></div>';
  }
  return { title: 'Importar dados', wide: true, body: inner, focus: '' };
};

/* ---------- abrir e fechar ---------- */
function openModal(type, data) {
  if (!ui.modal) ui.prevFocus = document.activeElement;
  ui.modal = { type, data: data || {} };
  drawModal(true);
}
function closeModal() {
  ui.modal = null; ui.confirmFn = null; ui.backModal = null;
  const r = $('#modal-root'); if (r) r.innerHTML = '';
  document.body.style.overflow = '';
  const p = ui.prevFocus; ui.prevFocus = null;
  if (p && p.isConnected && typeof p.focus === 'function') { try { p.focus(); } catch (e) { } }
}
function drawModal(first) {
  const m = ui.modal, root = $('#modal-root');
  if (!root) return;
  if (!m) { root.innerHTML = ''; document.body.style.overflow = ''; return; }
  const o = MODALS[m.type] ? MODALS[m.type](m.data || {}) : null;
  if (!o) { closeModal(); return; }
  root.innerHTML = modalShell(o.title, o.body, o);
  document.body.style.overflow = 'hidden';
  if (first) { const f = (o.focus && root.querySelector(o.focus)) || root.querySelector('[data-act="close-modal"]'); if (f) f.focus(); }
}

/* ---------- envio dos formulários ---------- */
const FORMS = {};
FORMS.assignment = f => {
  const fd = new FormData(f), title = String(fd.get('title') || '').trim();
  if (!title) return formError(f, 'Informe o nome da atividade.', 'title');
  let subjectId = String(fd.get('subject') || '');
  if (subjectId === '__new__') {
    const nm = String(fd.get('newsubject') || '').trim();
    if (!nm) return formError(f, 'Informe o nome da nova matéria.', 'newsubject');
    const ex = db.subjects.find(s => s.name.toLowerCase() === nm.toLowerCase());
    if (ex) subjectId = ex.id; else { const s = { id: uid(), name: nm, teacher: '', color: nextColor(db), source: 'manual', demo: false }; db.subjects.push(s); subjectId = s.id; }
  }
  const date = String(fd.get('dueDate') || ''), time = String(fd.get('dueTime') || '');
  if (time && !date) return formError(f, 'Escolha a data do prazo ou apague o horário.', 'dueDate');
  const url = String(fd.get('url') || '').trim();
  if (url && !safeUrl(url)) return formError(f, 'O link precisa começar com http:// ou https://.', 'url');
  const id = String(fd.get('id') || ''), status = String(fd.get('status') || 'pendente'), stamp = new Date().toISOString();
  let a = id ? byId(db.assignments, id) : null;
  if (!a) { a = { id: uid(), source: 'manual', demo: false, createdAt: stamp, doneBy: null, completedAt: null }; db.assignments.push(a); }
  Object.assign(a, { title, subjectId, description: String(fd.get('description') || '').trim(), teacher: String(fd.get('teacher') || '').trim(), publishedAt: String(fd.get('publishedAt') || ''), dueAt: date ? (time ? date + 'T' + time : date) : '', url, updatedAt: stamp, demo: false });
  if (status === 'concluida') { if (a.status !== 'concluida') { a.completedAt = stamp; a.doneBy = 'user'; } } else { a.completedAt = null; a.doneBy = null; }
  a.status = status;
  closeModal(); save(); toast(id ? 'Atividade atualizada' : 'Atividade criada');
};
FORMS.task = f => {
  const fd = new FormData(f), title = String(fd.get('title') || '').trim();
  if (!title) return formError(f, 'Informe o título da tarefa.', 'title');
  const time = String(fd.get('time') || ''), date = String(fd.get('date') || '');
  if (time && !date) return formError(f, 'Escolha uma data ou apague o horário.', 'date');
  const id = String(fd.get('id') || ''), stamp = new Date().toISOString();
  let t = id ? byId(db.tasks, id) : null;
  if (!t) { t = { id: uid(), demo: false, done: false, doneAt: null, createdAt: stamp }; db.tasks.push(t); }
  Object.assign(t, { title, description: String(fd.get('description') || '').trim(), date, time, priority: String(fd.get('priority') || 'media'), category: String(fd.get('category') || 'outros'), updatedAt: stamp, demo: false });
  closeModal(); save(); toast(id ? 'Tarefa atualizada' : 'Tarefa criada');
};
FORMS.workout = f => {
  const fd = new FormData(f), kind = String(fd.get('kind') || 'treino'), date = String(fd.get('date') || ''), today = ymd(now());
  if (!date) return formError(f, 'Escolha a data.', 'date');
  if (kind === 'treino' && date > today) return formError(f, 'Não dá para registrar um treino já realizado em data futura. Use Programado.', 'date');
  const dur = parseInt(fd.get('duration'), 10);
  if (kind !== 'descanso' && fd.get('duration') && (isNaN(dur) || dur < 1 || dur > 600)) return formError(f, 'A duração deve ficar entre 1 e 600 minutos.', 'duration');
  const id = String(fd.get('id') || ''), stamp = new Date().toISOString();
  let w = id ? byId(db.workouts, id) : null;
  if (!w) { w = { id: uid(), demo: false, createdAt: stamp }; db.workouts.push(w); }
  const rest = kind === 'descanso';
  Object.assign(w, { kind, date, time: String(fd.get('time') || ''), muscles: rest ? [] : fd.getAll('muscles').map(String), type: rest ? '' : String(fd.get('type') || ''), duration: rest || isNaN(dur) ? null : dur, notes: String(fd.get('notes') || '').trim(), updatedAt: stamp, demo: false });
  closeModal(); save(); toast(id ? 'Registro atualizado' : kind === 'treino' ? 'Treino registrado' : kind === 'programado' ? 'Treino programado' : 'Descanso registrado');
};
FORMS.subject = f => {
  const fd = new FormData(f), name = String(fd.get('name') || '').trim();
  if (!name) return formError(f, 'Informe o nome da matéria.', 'name');
  const id = String(fd.get('id') || '');
  if (db.subjects.some(s => s.id !== id && s.name.toLowerCase() === name.toLowerCase())) return formError(f, 'Já existe uma matéria com esse nome.', 'name');
  let s = id ? byId(db.subjects, id) : null;
  if (!s) { s = { id: uid(), source: 'manual', demo: false }; db.subjects.push(s); }
  Object.assign(s, { name, teacher: String(fd.get('teacher') || '').trim(), color: String(fd.get('color') || nextColor(db)), demo: false });
  persist(); ui.modal = { type: 'subjects', data: {} }; render(); drawModal(true); toast('Matéria salva');
};
FORMS['f-name'] = f => {
  const name = String(new FormData(f).get('name') || '').trim().slice(0, 40);
  if (!name) return;
  db.settings.name = name; save(); toast('Prazer, ' + name);
};
FORMS['f-quick'] = f => {
  const title = String(new FormData(f).get('title') || '').trim();
  if (!title) return;
  const cat = ui.tasks.cat !== 'all' ? ui.tasks.cat : 'pessoal', stamp = new Date().toISOString();
  db.tasks.push({ id: uid(), demo: false, title, description: '', date: ymd(now()), time: '', priority: 'media', category: cat, done: false, doneAt: null, createdAt: stamp, updatedAt: stamp });
  ui.refocus = '#quick-task'; save(); toast('Tarefa adicionada para hoje');
};
FORMS['f-ms'] = f => {
  const fd = new FormData(f), id = String(fd.get('clientId') || '').trim(), tenant = String(fd.get('tenant') || '').trim() || 'organizations';
  if (id && !/^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id)) return toast('O ID do aplicativo tem o formato 00000000-0000-0000-0000-000000000000');
  if (!/^[A-Za-z0-9.-]+$/.test(tenant)) return toast('Diretório inválido. Use organizations, common ou o ID do diretório.');
  db.settings.msClientId = id; db.settings.msTenant = tenant; ui.msError = ''; save(); toast('Configuração do Teams salva');
};
FORMS['f-ms-quick'] = f => {
  const id = String(new FormData(f).get('clientId') || '').trim();
  if (!/^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id)) return toast('O ID tem o formato 00000000-0000-0000-0000-000000000000');
  db.settings.msClientId = id; ui.msError = ''; save(); toast('ID do aplicativo salvo');
};
