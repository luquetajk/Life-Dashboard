/* ===== LIFE DASHBOARD: estado, utilidades de interface, gráficos, estrutura, visão geral, escola e academia ===== */
let db = null;
const ui = {
  route: 'visao-geral', modal: null, drawer: false, more: false, toastMsg: '', storageOk: true, embedded: false, downloads: null,
  syncing: false, msError: '', confirmFn: null, refocus: '',
  school: { status: 'aberto', subject: 'all', bucket: null, q: '', view: 'lista' },
  tasks: { cat: 'all' },
  cal: { mode: 'mes', cursor: '', sel: '', layers: { escola: true, academia: true, tarefas: true } },
  gym: { month: '', kind: 'all', limit: 40 },
  mini: ''
};
const ROUTES = ['visao-geral', 'escola', 'academia', 'calendario', 'tarefas', 'estatisticas', 'configuracoes'];
const NAV = [
  { id: 'visao-geral', label: 'Visão geral', short: 'Início', icon: 'home', tab: true },
  { id: 'escola', label: 'Escola', short: 'Escola', icon: 'school', tab: true },
  { id: 'academia', label: 'Academia', short: 'Academia', icon: 'gym', tab: true },
  { id: 'calendario', label: 'Calendário', icon: 'calendar' },
  { id: 'tarefas', label: 'Minhas tarefas', short: 'Tarefas', icon: 'tasks', tab: true },
  { id: 'estatisticas', label: 'Estatísticas', icon: 'stats' },
  { id: 'configuracoes', label: 'Configurações', icon: 'settings' }
];

/* ---------- utilidades ---------- */
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const safeColor = c => /^#[0-9a-f]{3,8}$/i.test(String(c || '')) || /^var\(--[a-z-]+\)$/.test(String(c || '')) ? c : '#8b7bff';
const safeUrl = u => { try { const x = new URL(String(u || '')); return /^https?:$/.test(x.protocol) ? x.href : ''; } catch (e) { return ''; } };
const ICONS = {
  home: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
  school: '<path d="M22 10 12 5 2 10l10 5 10-5Z"/><path d="M6 12v5c3 2 9 2 12 0v-5"/><path d="M22 10v6"/>',
  gym: '<path d="M6.5 6.5v11"/><path d="M17.5 6.5v11"/><path d="M3.5 9v6"/><path d="M20.5 9v6"/><path d="M6.5 12h11"/>',
  calendar: '<path d="M8 2v4"/><path d="M16 2v4"/><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M3 10h18"/>',
  tasks: '<path d="m3 17 2 2 4-4"/><path d="m3 7 2 2 4-4"/><path d="M13 6h8"/><path d="M13 12h8"/><path d="M13 18h8"/>',
  stats: '<path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>',
  settings: '<path d="M4 21v-7"/><path d="M4 10V3"/><path d="M12 21v-9"/><path d="M12 8V3"/><path d="M20 21v-5"/><path d="M20 12V3"/><path d="M1 14h6"/><path d="M9 8h6"/><path d="M17 16h6"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  minus: '<path d="M5 12h14"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  trash: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
  edit: '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>',
  chevL: '<path d="m15 18-6-6 6-6"/>', chevR: '<path d="m9 18 6-6-6-6"/>',
  refresh: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  alert: '<circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/>',
  ext: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
  moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
  shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
  more: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
  play: '<path d="m7 4 13 8-13 8Z"/>',
  pause: '<path d="M8 5v14"/><path d="M16 5v14"/>',
  target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
  pulse: '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  book: '<path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>',
  cloud: '<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>'
};
const ic = (n, s, extra) => '<svg class="ic ' + (extra || '') + '" width="' + (s || 20) + '" height="' + (s || 20) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[n] || '') + '</svg>';

/* ---------- gráficos (HTML/CSS e SVG em escala única) ---------- */
function niceTicks(max) {
  const step = max <= 4 ? 1 : max <= 8 ? 2 : Math.ceil(max / 4);
  const top = Math.max(step * 2, Math.ceil(max / step) * step), ticks = [];
  for (let t = 0; t <= top; t += step) ticks.push(t);
  return { top, ticks };
}
function gridHTML(ticks, top) { return ticks.map(t => '<div class="gl" style="bottom:' + (t / top * 100) + '%"><span>' + t + '</span></div>').join(''); }
function xLabels(labels, every, current) {
  const n = labels.length;
  return '<div class="xl" style="grid-template-columns:repeat(' + n + ',minmax(0,1fr))">' + labels.map((l, i) => '<span class="' + (i === current ? 'now' : '') + '">' + (((n - 1 - i) % every === 0) ? esc(l) : '') + '</span>').join('') + '</div>';
}
function barChart(o) {
  const labels = o.labels, series = o.series, n = labels.length;
  const totals = labels.map((_, i) => series.reduce((s, x) => s + (x.values[i] || 0), 0));
  const t = niceTicks(Math.max(1, Math.max.apply(null, totals), o.goal || 0));
  const goal = o.goal ? '<div class="goal" style="bottom:' + (o.goal / t.top * 100) + '%"><span>meta ' + o.goal + '</span></div>' : '';
  const cols = labels.map((l, i) => {
    const tot = totals[i];
    const segs = series.map(s => s.values[i] > 0 ? '<i style="flex:' + s.values[i] + ';background:' + s.color + '"></i>' : '').join('');
    const tip = esc(l) + ': ' + series.map(s => s.name + ' ' + (s.values[i] || 0)).join(', ');
    return '<div class="col' + (o.current === i ? ' now' : '') + '" title="' + tip + '">' + (tot > 0 ? '<span class="v" style="bottom:calc(' + (tot / t.top * 100) + '% + 3px)">' + tot + '</span>' : '') +
      (tot > 0 ? '<div class="stk" style="height:' + (tot / t.top * 100) + '%;animation-delay:' + (i * 25) + 'ms">' + segs + '</div>' : '') + '</div>';
  }).join('');
  return '<div class="chart" style="--h:' + (o.h || 168) + 'px"><div class="plot">' + gridHTML(t.ticks, t.top) + goal + '<div class="cols" style="grid-template-columns:repeat(' + n + ',minmax(0,1fr))">' + cols + '</div></div>' + xLabels(labels, o.every || 1, o.current) + '</div>' +
    (o.legend ? '<div class="legend">' + series.map(s => '<span><i style="background:' + s.color + '"></i>' + esc(s.name) + '</span>').join('') + '</div>' : '');
}
let _gid = 0;
function areaChart(o) {
  const v = o.values, n = v.length, t = niceTicks(Math.max(1, Math.max.apply(null, v), o.goal || 0));
  const X = i => (i + 0.5) / n * 100, Y = x => 100 - x / t.top * 100;
  let d = 'M' + X(0) + ',' + Y(v[0]);
  for (let i = 1; i < n; i++) { const mx = (X(i - 1) + X(i)) / 2; d += ' C' + mx + ',' + Y(v[i - 1]) + ' ' + mx + ',' + Y(v[i]) + ' ' + X(i) + ',' + Y(v[i]); }
  const area = d + ' L' + X(n - 1) + ',100 L' + X(0) + ',100 Z', id = 'ag' + (++_gid);
  const goal = o.goal ? '<div class="goal" style="bottom:' + (o.goal / t.top * 100) + '%"><span>meta ' + o.goal + '</span></div>' : '';
  const pts = v.map((x, i) => '<span class="pt' + (i === n - 1 ? ' last' : '') + '" style="left:' + X(i) + '%;bottom:' + (x / t.top * 100) + '%" title="' + esc(o.labels[i]) + ': ' + x + '"></span>' + (x > 0 && (n <= 12 || i === n - 1) ? '<span class="pv" style="left:' + X(i) + '%;bottom:' + (x / t.top * 100) + '%">' + x + '</span>' : '')).join('');
  return '<div class="chart" style="--h:' + (o.h || 168) + 'px"><div class="plot">' + gridHTML(t.ticks, t.top) + goal +
    '<svg class="area" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--accent);stop-opacity:.38"/><stop offset="1" style="stop-color:var(--accent);stop-opacity:0"/></linearGradient></defs><path d="' + area + '" fill="url(#' + id + ')"/><path class="ln" d="' + d + '"/></svg>' + pts + '</div>' + xLabels(o.labels, o.every || 1, n - 1) + '</div>';
}
function hbars(items, unit) {
  if (!items.length) return '<div class="empty">Sem dados ainda.</div>';
  const max = Math.max.apply(null, items.map(i => i.value)) || 1;
  return '<div class="hb">' + items.map(i => '<div class="hb-r"><span title="' + esc(i.label) + '">' + esc(i.label) + '</span><div class="bar"><i style="width:' + (i.value / max * 100) + '%;' + (i.color ? '--c:' + safeColor(i.color) : '') + '"></i></div><b>' + i.value + '</b></div>').join('') + '</div>';
}
function ring(pct, size, center) {
  const p = Math.max(0, Math.min(100, pct));
  return '<div class="ring ' + (size || '') + '" role="img" aria-label="' + Math.round(pct) + '%"><svg viewBox="0 0 100 100"><circle class="trk" cx="50" cy="50" r="42"/>' + (p > 0 ? '<circle class="val" cx="50" cy="50" r="42" pathLength="100" stroke-dasharray="' + p + ' 100"/>' : '') + '</svg><div class="ring-c">' + (center || Math.round(pct) + '<small>%</small>') + '</div></div>';
}

/* ---------- peças de interface ---------- */
function subjectChip(id) {
  const s = subjectOf(db, id);
  return s ? '<span class="sc" style="--c:' + safeColor(s.color) + '"><i></i><span>' + esc(s.name) + '</span></span>' : '<span class="sc" style="--c:var(--muted)"><i></i><span>Sem matéria</span></span>';
}
function srcPill(a) { return a.demo ? '<span class="pill ex">Exemplo</span>' : a.source === 'teams' ? '<span class="pill info">Teams</span>' : ''; }
const statusTone = st => ({ atrasada: 'bad', andamento: 'info', concluida: 'ok', pendente: '' }[st] || '');
function pageHead(title, sub, actions) { return '<div class="ph"><div><h1>' + title + '</h1>' + (sub ? '<p>' + sub + '</p>' : '') + '</div>' + (actions ? '<div class="ph-actions">' + actions + '</div>' : '') + '</div>'; }
function emptyState(icon, text, btn) { return '<div class="empty">' + ic(icon, 40) + '<div>' + text + '</div>' + (btn || '') + '</div>'; }
function demoBanner() {
  return hasDemo(db) ? '<div class="banner">' + ic('info', 20) + '<p><b>Dados de exemplo.</b> Tudo que aparece com a etiqueta Exemplo foi criado para você conhecer o app e não representa sua vida real.</p><button class="btn sm" data-act="clear-demo">Remover exemplos</button></div>' : '';
}
function storageBanner() {
  return ui.storageOk ? '' : '<div class="banner bad">' + ic('alert', 20) + '<p><b>Armazenamento indisponível.</b> Este navegador não deixa salvar dados. O que você registrar vale só até fechar a página. Exporte um backup em Configurações antes de sair.</p></div>';
}
function unreadNotifs(n) { return buildNotifications(db, n).filter(x => !db.readNotifs[x.id]); }

/* ---------- estrutura ---------- */
function shellHTML(inner) {
  const n = now(), sc = schoolSummary(db, n), rs = routineSummary(db, n), unread = unreadNotifs(n).length;
  const badges = { escola: sc.late + sc.today, tarefas: rs.remainingToday + rs.late };
  const navItem = it => '<a href="#' + it.id + '" data-act="go" data-route="' + it.id + '"' + (ui.route === it.id ? ' aria-current="page"' : '') + '>' + ic(it.icon, 20) + '<span>' + it.label + '</span>' + (badges[it.id] ? '<span class="badge">' + badges[it.id] + '</span>' : '') + '</a>';
  const tab = it => '<button class="tab" data-act="go" data-route="' + it.id + '"' + (ui.route === it.id ? ' aria-current="page"' : '') + '><span class="tab-i">' + ic(it.icon, 22) + '</span>' + it.short + (badges[it.id] ? '<span class="badge">' + badges[it.id] + '</span>' : '') + '</button>';
  const moreActive = !NAV.some(i => i.tab && i.id === ui.route);
  const brand = '<div class="brand"><div class="brand-mark">' + ic('pulse', 20) + '</div><div class="brand-name"><b>LIFE</b><span>DASHBOARD</span></div></div>';
  return '<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs><linearGradient id="gradAccent" x1="0" y1="0" x2="1" y2="1"><stop offset="0" style="stop-color:var(--accent-2)"/><stop offset="1" style="stop-color:var(--accent)"/></linearGradient></defs></svg>' +
    '<div class="shell"><aside class="side">' + brand + '<nav class="nav" aria-label="Seções">' + NAV.map(navItem).join('') + '</nav><div class="side-foot"><button class="side-btn" data-act="bell">' + ic('bell', 20) + '<span>Notificações</span>' + (unread ? '<span class="badge">' + unread + '</span>' : '') + '</button><p class="side-note">' + (ui.storageOk ? 'Seus dados ficam salvos neste navegador.' : 'Armazenamento indisponível neste navegador.') + '</p></div></aside>' +
    '<div class="content"><header class="topbar">' + brand + '<button class="icon-btn bell" data-act="bell" aria-label="Notificações">' + ic('bell', 22) + (unread ? '<span class="badge">' + unread + '</span>' : '') + '</button></header><main class="main view' + (ui.enter ? ' enter' : '') + '" id="view">' + inner + '</main></div>' +
    '<nav class="tabbar" aria-label="Navegação">' + NAV.filter(i => i.tab).map(tab).join('') + '<button class="tab" data-act="more"' + (moreActive ? ' aria-current="page"' : '') + '><span class="tab-i">' + ic('more', 22) + '</span>Mais</button></nav></div>';
}

/* ---------- visão geral ---------- */
const greet = n => { const h = n.getHours(); return h < 5 ? 'Boa madrugada' : h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'; };
const clockHTML = n => pad(n.getHours()) + ':' + pad(n.getMinutes()) + '<small>:' + pad(n.getSeconds()) + '</small>';
function whenText(date, time, n) {
  const diff = dayDiff(ymd(n), date);
  const d = diff === 0 ? 'Hoje' : diff === 1 ? 'Amanhã' : fmtWeekdayShort(date) + ', ' + fmtShort(date);
  return d + (time ? ' às ' + time : '');
}
function overviewRow(lead, title, sub, right) {
  return '<div class="li compact">' + lead + '<div class="li-b"><div class="li-t">' + title + '</div>' + (sub ? '<div class="li-m">' + sub + '</div>' : '') + '</div>' + (right ? '<div class="li-r">' + right + '</div>' : '') + '</div>';
}
function miniCal() {
  const p = ui.mini.split('-').map(Number), ws = db.settings.weekStart, n = now(), today = ymd(n);
  const rows = monthMatrix(p[0], p[1] - 1, ws);
  const cells = rows.map(r => r.map(c => {
    const ev = dayEvents(db, c.date, null, n), cols = [];
    ev.forEach(e => { if (cols.length < 3 && !cols.includes(e.color)) cols.push(e.color); });
    return '<button class="day mini' + (c.inMonth ? '' : ' out') + (c.date === today ? ' today' : '') + '" data-act="cal-pick" data-date="' + c.date + '" aria-label="' + c.day + ' de ' + MONTHS[parseYmd(c.date).getMonth()] + (ev.length ? ', ' + pl(ev.length, 'item', 'itens') : '') + '"><span class="dn">' + c.day + '</span><span class="dots">' + cols.map(x => '<i style="--c:' + safeColor(x) + '"></i>').join('') + '</span></button>';
  }).join('')).join('');
  return '<div class="card-h"><h2>' + cap(MONTHS[p[1] - 1]) + ' de ' + p[0] + '</h2><div class="cal-nav"><button class="icon-btn sm" data-act="mini-prev" aria-label="Mês anterior">' + ic('chevL', 18) + '</button><button class="icon-btn sm" data-act="mini-next" aria-label="Próximo mês">' + ic('chevR', 18) + '</button></div></div><div class="dow-r">' + dowLabels(ws).map(d => '<span>' + d.slice(0, 3) + '</span>').join('') + '</div><div class="cal-g">' + cells + '</div>';
}
function viewOverview() {
  const n = now(), today = ymd(n), sc = schoolSummary(db, n), gs = gymSummary(db, n), rs = routineSummary(db, n), na = nextAppointment(db, n);
  const tasksToday = db.tasks.filter(t => !t.done && t.date === today), tasksLate = db.tasks.filter(t => !t.done && t.date && t.date < today);
  const dueToday = db.assignments.filter(a => dueBucket(a, n) === 'hoje');
  const planToday = db.workouts.find(w => w.date === today && w.kind === 'programado'), trainedToday = db.workouts.some(w => w.date === today && w.kind === 'treino');
  const gymWord = trainedToday ? ['Feito', 'Treino de hoje'] : planToday ? ['Previsto', 'Treino de hoje'] : ['Livre', 'Sem treino previsto'];
  const hero = '<section class="card hero"><div class="hero-t"><div><h1>' + greet(n) + (db.settings.name ? ', ' + esc(db.settings.name) : '') + '</h1><div class="date">' + fmtLong(n) + '</div></div><div class="clock num" id="clock" aria-label="Hora atual">' + clockHTML(n) + '</div></div>' +
    (db.settings.name ? '' : '<form class="name-form" id="f-name"><input class="in" name="name" placeholder="Como devo te chamar?" maxlength="40" aria-label="Seu nome"><button class="btn primary" type="submit">Salvar</button></form>') +
    '<div class="today-strip"><button class="ts" data-act="go" data-route="tarefas"><b>' + (tasksToday.length + tasksLate.length) + '</b><span>' + ((tasksToday.length + tasksLate.length) === 1 ? 'tarefa para hoje' : 'tarefas para hoje') + '</span></button><button class="ts" data-act="school-bucket-go" data-bucket="hoje"><b>' + dueToday.length + '</b><span>' + (dueToday.length === 1 ? 'entrega hoje' : 'entregas hoje') + '</span></button><button class="ts" data-act="go" data-route="academia"><b>' + gymWord[0] + '</b><span>' + gymWord[1] + '</span></button></div></section>';
  const next = '<section class="card next"><div class="card-h"><span class="eyebrow">' + ic('calendar', 16) + ' Próximo compromisso</span></div>' + (na ?
    '<div class="next-b"><div class="next-i">' + ic(na.kind === 'treino' ? 'gym' : 'calendar', 22) + '</div><div style="min-width:0"><div class="next-t">' + esc(na.title) + '</div><div class="muted" style="margin-top:4px">' + whenText(na.date, na.time, n) + '</div><div style="margin-top:10px"><span class="pill ' + (na.kind === 'treino' ? 'info' : 'acc') + '">' + (na.kind === 'treino' ? 'Treino programado' : 'Compromisso') + '</span></div></div></div>' :
    emptyState('calendar', 'Nenhum compromisso agendado.', '<button class="btn sm" data-act="new-task" data-cat="compromissos">' + ic('plus', 16) + ' Adicionar compromisso</button>')) + '</section>';
  const subj = sc.bySubject.slice(0, 4).map(x => '<span class="sc" style="--c:' + safeColor(x.subject ? x.subject.color : '#8b7bff') + '"><i></i><span>' + esc(x.subject ? x.subject.name : 'Sem matéria') + '</span><b style="color:var(--fg)">' + x.count + '</b></span>').join('');
  const modSchool = '<article class="card mod"><div class="card-h"><span class="eyebrow">' + ic('school', 16) + ' Escola</span><a class="link" href="#escola" data-act="go" data-route="escola">Abrir ' + ic('chevR', 14) + '</a></div><div class="mod-big"><strong class="num">' + sc.open + '</strong><span>' + (sc.open === 1 ? 'atividade pendente' : 'atividades pendentes') + '</span></div><ul class="kv"><li><span class="dot warn"></span><span><b>' + sc.soon + '</b> ' + (sc.soon === 1 ? 'próxima do prazo' : 'próximas do prazo') + ' (7 dias)</span></li><li><span class="dot ' + (sc.late ? 'bad' : 'ok') + '"></span><span><b>' + sc.late + '</b> ' + (sc.late === 1 ? 'atrasada' : 'atrasadas') + '</span></li></ul>' + (subj ? '<div class="mini-chips">' + subj + '</div>' : '') + '</article>';
  const wk = '<div class="wk-dots">' + gs.weekDays.map(d => '<div><i class="' + (d.state === 'ok' ? 'on' : d.state === 'plan' ? 'pl' : d.state === 'rest' ? 'rs' : '') + (d.today ? ' td' : '') + '">' + (d.state === 'ok' ? ic('check', 15) : d.state === 'rest' ? ic('moon', 14) : d.state === 'plan' ? ic('clock', 14) : '') + '</i>' + d.label + '</div>').join('') + '</div>';
  const modGym = '<article class="card mod"><div class="card-h"><span class="eyebrow">' + ic('gym', 16) + ' Academia</span><a class="link" href="#academia" data-act="go" data-route="academia">Abrir ' + ic('chevR', 14) + '</a></div><div class="gym-top">' + ring(gs.pct, '', '<span>' + gs.week + '<small>/' + gs.goal + '</small></span>') + '<ul class="kv"><li><b>' + pl(gs.week, 'treino', 'treinos') + '</b>&nbsp;nesta semana</li><li>Meta semanal: <b>' + pl(gs.goal, 'treino', 'treinos') + '</b></li><li>Progresso: <b>' + gs.pct + '%</b></li></ul></div>' + wk + '</article>';
  const tot = rs.doneToday + rs.remainingToday;
  const modRoutine = '<article class="card mod"><div class="card-h"><span class="eyebrow">' + ic('tasks', 16) + ' Rotina</span><a class="link" href="#tarefas" data-act="go" data-route="tarefas">Abrir ' + ic('chevR', 14) + '</a></div><div class="mod-big"><strong class="num">' + rs.remainingToday + '</strong><span>' + (rs.remainingToday === 1 ? 'tarefa restante hoje' : 'tarefas restantes hoje') + '</span></div><div class="bar" aria-hidden="true"><i style="width:' + (tot ? rs.doneToday / tot * 100 : 0) + '%"></i></div><ul class="kv" style="margin-top:14px"><li><span class="dot ok"></span><span><b>' + rs.doneToday + '</b> ' + (rs.doneToday === 1 ? 'concluída hoje' : 'concluídas hoje') + '</span></li><li><span class="dot ' + (rs.late ? 'bad' : 'ok') + '"></span><span><b>' + rs.late + '</b> ' + (rs.late === 1 ? 'atrasada' : 'atrasadas') + '</span></li></ul></article>';
  const urgent = sortByUrgency(db.assignments.filter(a => a.status !== 'concluida'), n).slice(0, 5);
  const deadl = '<section class="card deadl"><div class="card-h"><h2>Próximas entregas</h2><a class="link" href="#escola" data-act="go" data-route="escola">Ver todas ' + ic('chevR', 14) + '</a></div>' + (urgent.length ? '<div class="list">' + urgent.map(a => { const di = dueInfo(a, n); return overviewRow('<button class="chk" data-act="toggle-assignment" data-id="' + a.id + '" aria-label="Marcar como concluída">' + ic('check', 14) + '</button>', esc(a.title), subjectChip(a.subjectId) + srcPill(a), '<span class="pill ' + di.tone + '">' + esc(di.text) + '</span>'); }).join('') + '</div>' : emptyState('school', 'Nenhuma atividade em aberto.', '<button class="btn sm" data-act="new-assignment">' + ic('plus', 16) + ' Nova atividade</button>')) + '</section>';
  const todayItems = [];
  tasksLate.forEach(t => todayItems.push(overviewRow('<button class="chk" data-act="toggle-task" data-id="' + t.id + '" aria-label="Concluir">' + ic('check', 14) + '</button>', esc(t.title), '<span class="pill bad">Atrasada</span>' + srcPill(t), '')));
  tasksToday.sort((a, b) => (a.time || '24').localeCompare(b.time || '24')).forEach(t => todayItems.push(overviewRow('<button class="chk" data-act="toggle-task" data-id="' + t.id + '" aria-label="Concluir">' + ic('check', 14) + '</button>', esc(t.title), (t.time ? '<span>' + t.time + '</span>' : '') + '<span>' + esc(CAT_LABEL[t.category] || '') + '</span>' + srcPill(t), '')));
  dueToday.forEach(a => todayItems.push(overviewRow('<span class="ico-t" style="--c:var(--warn)">' + ic('school', 18) + '</span>', esc(a.title), subjectChip(a.subjectId) + '<span>entrega ' + (String(a.dueAt).includes('T') ? 'às ' + String(a.dueAt).slice(11, 16) : 'hoje') + '</span>', '')));
  if (planToday) todayItems.push(overviewRow('<span class="ico-t" style="--c:var(--info)">' + ic('gym', 18) + '</span>', esc(workoutTitle(planToday)), '<span>Treino programado' + (planToday.time ? ' às ' + planToday.time : '') + '</span>', ''));
  const today_ = '<section class="card todaycard"><div class="card-h"><h2>Hoje</h2><button class="link" data-act="new-task">' + ic('plus', 14) + ' Tarefa</button></div>' + (todayItems.length ? '<div class="list">' + todayItems.join('') + '</div>' : emptyState('check', 'Nada pendente para hoje.', '')) + '</section>';
  const ps = productivitySeries(db, n, 14), total14 = ps.reduce((s, d) => s + d.school + d.tasks + d.gym, 0);
  const prod = '<section class="card prod"><div class="card-h"><h2>Produtividade</h2><span class="muted" style="font-size:13px">Últimos 14 dias · ' + pl(total14, 'item', 'itens') + '</span></div>' + barChart({ labels: ps.map(d => String(parseYmd(d.date).getDate())), current: ps.length - 1, h: 150, legend: true, series: [{ name: 'Escola', color: 'var(--accent-2)', values: ps.map(d => d.school) }, { name: 'Rotina', color: 'var(--accent)', values: ps.map(d => d.tasks) }, { name: 'Academia', color: 'var(--ok)', values: ps.map(d => d.gym) }] }) + '</section>';
  const mini = '<section class="card minical">' + miniCal() + '</section>';
  return '<div class="stack-v" style="margin-bottom:16px">' + demoBanner() + storageBanner() + '</div><div class="ov">' + hero + next + modSchool + modGym + modRoutine + deadl + today_ + mini + prod + '</div>';
}

/* ---------- escola ---------- */
function filterAssignments(n) {
  const f = ui.school, q = f.q.trim().toLowerCase();
  return db.assignments.filter(a => {
    const st = effStatus(a, n), b = dueBucket(a, n);
    if (f.status === 'aberto' && st === 'concluida') return false;
    if (['pendente', 'andamento', 'concluida', 'atrasada'].includes(f.status) && st !== f.status) return false;
    if (f.subject !== 'all' && a.subjectId !== f.subject) return false;
    if (f.bucket && b !== f.bucket) return false;
    if (q) { const s = subjectOf(db, a.subjectId); if (!(a.title + ' ' + (a.description || '') + ' ' + (a.teacher || '') + ' ' + (s ? s.name : '')).toLowerCase().includes(q)) return false; }
    return true;
  });
}
function schoolRow(a, n) {
  const st = effStatus(a, n), done = a.status === 'concluida', link = safeUrl(a.url);
  const dp = done ? { text: a.doneBy === 'teams' ? 'Entregue no Teams' : (a.dueAt ? 'Prazo ' + fmtShort(String(a.dueAt).slice(0, 10)) : 'Sem prazo'), tone: a.doneBy === 'teams' ? 'ok' : '' } : dueInfo(a, n);
  return '<div class="li">' +
    '<button class="chk' + (done ? ' on' : '') + '" data-act="toggle-assignment" data-id="' + a.id + '" aria-label="' + (done ? 'Reabrir atividade' : 'Marcar como concluída') + '">' + ic('check', 14) + '</button>' +
    '<div class="li-b"><div class="li-t' + (done ? ' done' : '') + '">' + esc(a.title) + '</div><div class="li-m">' + subjectChip(a.subjectId) + (a.teacher ? '<span>' + esc(a.teacher) + '</span>' : '') + (a.publishedAt ? '<span>Publicada em ' + fmtShort(a.publishedAt) + '</span>' : '') + srcPill(a) + '</div>' +
    (a.description ? '<div class="li-d clamp2">' + esc(a.description) + '</div>' : '') +
    (link ? '<div><a class="link" href="' + esc(link) + '" target="_blank" rel="noopener noreferrer">' + (a.source === 'teams' ? 'Abrir no Teams' : 'Abrir link') + ' ' + ic('ext', 14) + '</a></div>' : '') + '</div>' +
    '<div class="li-r"><span class="pill ' + dp.tone + '">' + esc(dp.text) + '</span><span class="pill ' + statusTone(st) + '">' + STATUS_LABEL[st] + '</span><div class="li-a">' +
    (done ? '' : '<button class="icon-btn sm" data-act="progress-assignment" data-id="' + a.id + '" aria-label="' + (a.status === 'andamento' ? 'Voltar para pendente' : 'Marcar como em andamento') + '" title="' + (a.status === 'andamento' ? 'Voltar para pendente' : 'Marcar como em andamento') + '">' + ic(a.status === 'andamento' ? 'pause' : 'play', 16) + '</button>') +
    '<button class="icon-btn sm" data-act="edit-assignment" data-id="' + a.id + '" aria-label="Editar">' + ic('edit', 16) + '</button><button class="icon-btn sm" data-act="del-assignment" data-id="' + a.id + '" aria-label="Excluir">' + ic('trash', 16) + '</button></div></div></div>';
}
function schoolList(n) {
  const list = filterAssignments(n);
  if (!list.length) return '<div class="card">' + emptyState('school', db.assignments.length ? 'Nenhuma atividade com esses filtros.' : 'Você ainda não cadastrou atividades.', '<button class="btn primary sm" data-act="new-assignment">' + ic('plus', 16) + ' Nova atividade</button>') + '</div>';
  if (ui.school.view === 'materia') return schoolBySubject(list, n);
  const sorted = sortByUrgency(list, n), groups = [];
  sorted.forEach(a => { const b = dueBucket(a, n); let g = groups[groups.length - 1]; if (!g || g.b !== b) { g = { b, items: [] }; groups.push(g); } g.items.push(a); });
  const tone = { atrasada: 'bad', hoje: 'warn', amanha: 'warn', semana: 'info' };
  return '<div class="card flush">' + groups.map(g => '<div class="grp"><div class="grp-h"><span class="dot ' + (tone[g.b] || '') + '"></span>' + BUCKET_LABEL[g.b] + '<span class="pill ' + (tone[g.b] || '') + '">' + g.items.length + '</span></div>' + g.items.map(a => schoolRow(a, n)).join('') + '</div>').join('') + '</div>';
}
function schoolBySubject(list, n) {
  const ids = db.subjects.map(s => s.id).concat(['']);
  const cards = ids.map(id => {
    const items = list.filter(a => (a.subjectId || '') === id);
    if (!items.length && (id === '' || ui.school.subject !== 'all')) return '';
    const s = subjectOf(db, id), open = items.filter(a => a.status !== 'concluida'), late = open.filter(a => dueBucket(a, n) === 'atrasada').length, done = items.length - open.length;
    return { key: id, open: open.length, late, html: '<section class="card sub-card"><div class="sub-h"><div>' + subjectChip(id) + (s && s.teacher ? '<div class="muted" style="font-size:12.5px;margin-top:2px">' + esc(s.teacher) + '</div>' : '') + '</div><div class="sub-stats">' + (late ? '<span class="pill bad">' + late + ' atrasada' + (late > 1 ? 's' : '') + '</span>' : '') + '<span class="pill ' + (open.length ? 'warn' : 'ok') + '">' + open.length + ' em aberto</span>' + (done ? '<span class="pill ok">' + done + ' concluída' + (done > 1 ? 's' : '') + '</span>' : '') + '</div></div>' +
      (open.length ? '<div class="list">' + sortByUrgency(open, n).slice(0, 4).map(a => { const di = dueInfo(a, n); return overviewRow('<button class="chk" data-act="toggle-assignment" data-id="' + a.id + '" aria-label="Marcar como concluída">' + ic('check', 14) + '</button>', '<button class="link" style="color:var(--fg);text-align:left;font-size:14.5px" data-act="edit-assignment" data-id="' + a.id + '">' + esc(a.title) + '</button>', '', '<span class="pill ' + di.tone + '">' + esc(di.text) + '</span>'); }).join('') + (open.length > 4 ? '<div class="muted" style="font-size:12.5px;padding-top:8px">e mais ' + (open.length - 4) + '</div>' : '') + '</div>' : '<div class="muted" style="font-size:13.5px">Nenhuma pendência nesta matéria.</div>') + '</section>' };
  }).filter(Boolean).sort((a, b) => b.late - a.late || b.open - a.open);
  return '<div class="sub-grid">' + cards.map(c => c.html).join('') + '</div>';
}
function adminHelp(open) {
  return '<details class="guide" style="margin-top:14px"' + (open ? ' open' : '') + '><summary>Preciso da autorização da escola ' + ic('chevR', 18) + '</summary><div class="guide-b"><p>As permissões de turmas e tarefas do Teams exigem o consentimento de um administrador do Microsoft 365 da escola. Um aluno não consegue aprovar sozinho. Mande a mensagem abaixo para o responsável pela TI. O app só lê: não altera nada no Teams e não vê notas.</p><div class="teams-a"><button class="btn sm primary" data-act="copy-admin-msg">' + ic('copy', 15) + ' Copiar mensagem para o administrador</button><button class="btn sm" data-act="copy-admin-link">' + ic('link', 15) + ' Copiar só o link</button></div></div></details>';
}
function teamsCard() {
  const s = db.settings, connected = !!(msHasSession() && s.msAccount), had = !!s.msAccount, hasId = /^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(s.msClientId || '');
  let title = 'Microsoft Teams', text = '', actions = '', extra = '', admin = '';
  if (ui.embedded) {
    text = 'A conexão real não funciona aqui dentro do Claude: o login da Microsoft e a Graph API são bloqueados nesta janela. O pacote de hospedagem enviado no chat já tem tudo pronto. Depois de publicá-lo em HTTPS, o botão Conectar Microsoft Teams aparece aqui. Até lá, cadastre as atividades manualmente.';
    actions = '<button class="btn sm" data-act="go-guide">' + ic('book', 16) + ' Ver o passo a passo</button>';
  } else if (!secureContextOk()) {
    text = 'Este endereço não usa HTTPS. A Microsoft só aceita HTTPS (ou localhost para testes). Publique o app em uma hospedagem HTTPS gratuita.';
    actions = '<button class="btn sm" data-act="go-guide">' + ic('book', 16) + ' Ver o passo a passo</button>';
  } else if (!hasId) {
    text = 'Falta o ID do aplicativo que você registrou no Microsoft Entra. Ele não é uma senha.';
    extra = '<form class="name-form" id="f-ms-quick" style="margin-top:10px"><input class="in" name="clientId" placeholder="00000000-0000-0000-0000-000000000000" autocomplete="off" spellcheck="false" aria-label="ID do aplicativo"><button class="btn primary" type="submit">Salvar</button></form>';
    actions = '<button class="btn sm" data-act="go-guide">' + ic('book', 16) + ' Como registrar o app</button>';
  } else if (!connected) {
    text = had ? 'Sua sessão expirou. Toque em Reconectar: normalmente é só um toque, sem digitar nada.' : 'Você entra no site da Microsoft com a conta da escola. Este app nunca vê sua senha e só lê turmas, tarefas e prazos.';
    actions = '<button class="btn primary" data-act="ms-connect">' + ic('link', 18) + (had ? ' Reconectar Microsoft Teams' : ' Conectar Microsoft Teams') + '</button>';
    admin = adminHelp(ui.msConsentNeeded);
  } else {
    title = 'Teams conectado';
    text = 'Conta: ' + esc(s.msAccount.name || s.msAccount.email || '') + '. ' + (s.msLastSync ? 'Última sincronização: ' + fmtShort(ymd(new Date(s.msLastSync))) + ' às ' + hhmm(new Date(s.msLastSync)) + '.' : 'Ainda não sincronizado.') + ' Atualiza sozinho a cada 30 minutos com o app aberto.';
    actions = '<button class="btn sm primary" data-act="sync-teams"' + (ui.syncing ? ' disabled' : '') + '>' + ic('refresh', 16, ui.syncing ? 'spin' : '') + (ui.syncing ? ' Sincronizando' : ' Sincronizar agora') + '</button><button class="btn sm ghost" data-act="ms-disconnect">Desconectar</button>';
    if (ui.msConsentNeeded) admin = adminHelp(true);
  }
  const notice = ui.msNotice ? '<div class="banner' + (ui.msNotice.ok ? '' : ' bad') + '" style="margin-top:14px"><p>' + esc(ui.msNotice.text) + '</p></div>' : '';
  return '<section class="card"><div class="teams"><div class="teams-i">' + ic('cloud', 22) + '</div><div class="teams-b"><strong>' + title + '</strong><p>' + text + '</p>' + extra + (ui.msError ? '<p class="err" role="alert">' + esc(ui.msError) + '</p>' : '') + '</div><div class="teams-a">' + actions + '</div></div>' + notice + admin + '</section>';
}
function viewSchool() {
  const n = now(), sc = schoolSummary(db, n), f = ui.school;
  const dl = (b, label, count, tone) => '<button class="dl" data-act="school-bucket" data-bucket="' + b + '" aria-pressed="' + (f.bucket === b) + '"><b class="num">' + count + '</b><span><i class="dot ' + tone + '"></i>' + label + '</span></button>';
  const sts = [['aberto', 'Em aberto'], ['pendente', 'Pendente'], ['andamento', 'Em andamento'], ['atrasada', 'Atrasada'], ['concluida', 'Concluída'], ['todas', 'Todas']];
  const head = pageHead('Escola', 'Atividades, prazos e matérias em um só lugar.', '<button class="btn" data-act="go-calendar-school">' + ic('calendar', 18) + ' Calendário</button><button class="btn primary" data-act="new-assignment">' + ic('plus', 18) + ' Nova atividade</button>');
  const tools = '<div class="toolbar"><input class="in" id="school-q" type="search" placeholder="Buscar atividade, matéria ou professor" value="' + esc(f.q) + '" aria-label="Buscar"><select class="in" id="school-subject" style="flex:0 1 200px" aria-label="Matéria"><option value="all">Todas as matérias</option>' + db.subjects.map(s => '<option value="' + esc(s.id) + '"' + (f.subject === s.id ? ' selected' : '') + '>' + esc(s.name) + '</option>').join('') + '</select><div class="segc" role="group" aria-label="Visualização"><button data-act="school-view" data-view="lista" aria-pressed="' + (f.view === 'lista') + '">Lista</button><button data-act="school-view" data-view="materia" aria-pressed="' + (f.view === 'materia') + '">Por matéria</button></div><button class="btn" data-act="manage-subjects">Matérias</button></div>';
  return '<div class="stack-v">' + head + demoBanner() + teamsCard() +
    '<div class="dl-g">' + dl('atrasada', 'Atrasadas', sc.late, 'bad') + dl('hoje', 'Vencem hoje', sc.today, 'warn') + dl('amanha', 'Vencem amanhã', sc.tomorrow, 'warn') + dl('semana', 'Próximos 7 dias', sc.week, 'info') + '</div>' +
    tools + '<div class="chips" role="group" aria-label="Status">' + sts.map(x => '<button class="chip' + (f.status === x[0] ? ' on' : '') + '" data-act="school-status" data-status="' + x[0] + '">' + x[1] + '</button>').join('') + '</div><div id="school-list">' + schoolList(n) + '</div></div>';
}

/* ---------- academia ---------- */
function workoutRow(w) {
  const color = w.kind === 'treino' ? 'var(--ok)' : w.kind === 'programado' ? 'var(--info)' : 'var(--warn)';
  const pill = w.kind === 'treino' ? '<span class="pill ok">Treino</span>' : w.kind === 'programado' ? '<span class="pill info">Programado</span>' : '<span class="pill warn">Descanso</span>';
  return '<div class="li"><div class="ico-t" style="--c:' + color + '">' + ic(w.kind === 'descanso' ? 'moon' : 'gym', 18) + '</div><div class="li-b"><div class="li-t">' + esc(w.kind === 'descanso' ? 'Dia de descanso' : workoutTitle(w)) + (w.demo ? ' <span class="pill ex">Exemplo</span>' : '') + '</div><div class="li-m"><span>' + fmtWeekdayShort(w.date) + ', ' + fmtShort(w.date) + '</span>' + (w.time ? '<span>' + esc(w.time) + '</span>' : '') + (w.type ? '<span>' + esc(w.type) + '</span>' : '') + (w.duration ? '<span>' + w.duration + ' min</span>' : '') + '</div>' + (w.notes ? '<div class="li-d clamp2">' + esc(w.notes) + '</div>' : '') + '</div><div class="li-r">' + pill + '<div class="li-a">' +
    (w.kind === 'programado' ? '<button class="icon-btn sm" data-act="complete-workout" data-id="' + w.id + '" aria-label="Marcar como realizado" title="Marcar como realizado">' + ic('check', 16) + '</button>' : '') +
    '<button class="icon-btn sm" data-act="edit-workout" data-id="' + w.id + '" aria-label="Editar">' + ic('edit', 16) + '</button><button class="icon-btn sm" data-act="del-workout" data-id="' + w.id + '" aria-label="Excluir">' + ic('trash', 16) + '</button></div></div></div>';
}
function gymCalendar() {
  const p = ui.gym.month.split('-').map(Number), ws = db.settings.weekStart, n = now(), today = ymd(n);
  const rows = monthMatrix(p[0], p[1] - 1, ws);
  const cells = rows.map(r => r.map(c => {
    const st = dayGymState(db, c.date, n), recs = db.workouts.filter(w => w.date === c.date && (w.kind === 'treino' || w.kind === 'programado'));
    const cls = { ok: 'g-ok', plan: 'g-plan', rest: 'g-rest', none: 'g-none', future: 'g-future' }[st];
    const lbl = recs.length ? esc((recs[0].muscles || []).slice(0, 2).join(', ') || recs[0].type || '') : st === 'rest' ? 'Descanso' : '';
    const label = c.day + ' de ' + MONTHS[parseYmd(c.date).getMonth()] + ': ' + ({ ok: 'treino realizado', plan: 'treino programado', rest: 'descanso', none: 'sem registro', future: 'sem registro' }[st]);
    return '<button class="day gday ' + cls + (c.inMonth ? '' : ' out') + (c.date === today ? ' today' : '') + '" data-act="gym-day" data-date="' + c.date + '" aria-label="' + label + '"><span class="dn">' + c.day + '</span>' + (st === 'ok' ? ic('check', 14) : st === 'plan' ? ic('clock', 13) : st === 'rest' ? ic('moon', 13) : '') + '<span class="gl2">' + lbl + '</span></button>';
  }).join('')).join('');
  return '<div class="card-h"><h2>' + cap(MONTHS[p[1] - 1]) + ' de ' + p[0] + '</h2><div class="cal-nav"><button class="icon-btn sm" data-act="gym-prev" aria-label="Mês anterior">' + ic('chevL', 18) + '</button><button class="btn sm ghost" data-act="gym-today">Hoje</button><button class="icon-btn sm" data-act="gym-next" aria-label="Próximo mês">' + ic('chevR', 18) + '</button></div></div><div class="dow-r">' + dowLabels(ws).map(d => '<span>' + d + '</span>').join('') + '</div><div class="cal-g">' + cells + '</div>' +
    '<div class="leg"><span><i style="background:color-mix(in srgb,var(--ok) 40%,var(--surface-2))"></i>Fui à academia</span><span><i style="background:var(--surface-3)"></i>Sem registro</span><span><i style="background:color-mix(in srgb,var(--info) 40%,var(--surface-2))"></i>Treino programado</span><span><i style="background:color-mix(in srgb,var(--warn) 40%,var(--surface-2))"></i>Descanso</span></div>';
}
function viewGym() {
  const n = now(), g = gymSummary(db, n), ws = weeklySeries(db, n, 12), ms = monthlySeries(db, n, 12);
  const goalCard = '<section class="card"><div class="goal-card">' + ring(g.pct, 'lg', '<span>' + g.week + '<small>/' + g.goal + '</small></span>') + '<div class="gi"><div><span class="eyebrow">' + ic('target', 16) + ' Meta semanal</span><div style="font:600 20px var(--font-display);margin-top:8px;letter-spacing:-.02em">' + (g.week >= g.goal ? 'Meta atingida nesta semana' : 'Faltam ' + pl(g.left, 'treino', 'treinos') + ' para a meta') + '</div><div class="muted" style="margin-top:2px">' + pl(g.week, 'dia treinado', 'dias treinados') + ' de ' + g.goal + ' planejados</div></div><div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap"><span class="lbl">Meta por semana</span><div class="stepper"><button class="icon-btn sm" data-act="goal-minus" aria-label="Diminuir meta">' + ic('minus', 16) + '</button><b class="num">' + g.goal + '</b><button class="icon-btn sm" data-act="goal-plus" aria-label="Aumentar meta">' + ic('plus', 16) + '</button></div></div></div></div></section>';
  const stats = '<div class="stat-g four"><div class="stat"><b class="num">' + g.week + '</b><span>Dias treinados nesta semana</span></div><div class="stat"><b class="num">' + g.month + '</b><span>Dias treinados neste mês</span></div><div class="stat"><b class="num">' + g.total + '</b><span>Total de treinos realizados</span></div><div class="stat"><b class="num">' + String(g.avg).replace('.', ',') + '</b><span>Média semanal de dias</span></div></div>';
  const kinds = [['all', 'Todos'], ['treino', 'Treinos'], ['programado', 'Programados'], ['descanso', 'Descansos']];
  const all = db.workouts.filter(w => ui.gym.kind === 'all' || w.kind === ui.gym.kind).sort((a, b) => (b.date + (b.time || '')).localeCompare(a.date + (a.time || '')));
  const shown = all.slice(0, ui.gym.limit), months = [];
  shown.forEach(w => { const k = w.date.slice(0, 7); let m = months[months.length - 1]; if (!m || m.k !== k) { m = { k, items: [] }; months.push(m); } m.items.push(w); });
  const hist = '<section class="card flush"><div style="padding:18px 18px 12px;display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between"><h2 style="font:600 16px var(--font-display)">Histórico de treinos</h2><div class="chips">' + kinds.map(k => '<button class="chip' + (ui.gym.kind === k[0] ? ' on' : '') + '" data-act="gym-kind" data-kind="' + k[0] + '">' + k[1] + '</button>').join('') + '</div></div>' +
    (months.length ? months.map(m => '<div class="grp"><div class="grp-h" style="text-transform:none;letter-spacing:.02em;font-size:13px">' + cap(MONTHS[+m.k.slice(5) - 1]) + ' de ' + m.k.slice(0, 4) + '<span class="pill">' + m.items.length + '</span></div>' + m.items.map(workoutRow).join('') + '</div>').join('') + (all.length > shown.length ? '<div style="padding:14px 18px;border-top:1px solid var(--line)"><button class="btn sm" data-act="gym-more">Mostrar mais ' + Math.min(40, all.length - shown.length) + '</button></div>' : '') : emptyState('gym', 'Nenhum registro ainda.', '<button class="btn primary sm" data-act="new-workout">' + ic('plus', 16) + ' Registrar treino</button>')) + '</section>';
  return '<div class="stack-v">' + pageHead('Academia', 'Frequência, metas e histórico dos seus treinos.', '<button class="btn primary" data-act="new-workout">' + ic('plus', 18) + ' Registrar treino</button>') + demoBanner() + goalCard + stats +
    '<section class="card">' + gymCalendar() + '</section><div class="two-col"><section class="card"><div class="card-h"><h2>Evolução da frequência</h2><span class="muted" style="font-size:13px">Dias treinados por semana</span></div>' + areaChart({ labels: ws.map(x => x.label), values: ws.map(x => x.value), goal: g.goal, every: 2 }) + '</section><section class="card"><div class="card-h"><h2>Histórico mensal</h2><span class="muted" style="font-size:13px">Dias treinados por mês</span></div>' + barChart({ labels: ms.map(x => x.label), current: ms.length - 1, series: [{ name: 'Dias treinados', color: 'var(--accent)', values: ms.map(x => x.value) }], every: 2 }) + '</section></div>' + hist + '</div>';
}
