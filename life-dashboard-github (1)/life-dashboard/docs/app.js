/* ===== LIFE DASHBOARD: lógica pura (sem DOM). Dados em tabelas simples, prontas para migrar ao Supabase. ===== */
'use strict';
const STORE_KEY = 'lifedash.v1';
const SCHEMA = 1;
const CATEGORIES = [
  { id: 'escola', label: 'Escola' }, { id: 'academia', label: 'Academia' }, { id: 'pessoal', label: 'Pessoal' },
  { id: 'compromissos', label: 'Compromissos' }, { id: 'outros', label: 'Outros' }
];
const PRIORITIES = [{ id: 'alta', label: 'Alta' }, { id: 'media', label: 'Média' }, { id: 'baixa', label: 'Baixa' }];
const MUSCLES = ['Peito', 'Costas', 'Ombros', 'Bíceps', 'Tríceps', 'Pernas', 'Abdômen', 'Cardio', 'Corpo inteiro'];
const WORKOUT_TYPES = ['Musculação', 'Cardio', 'Funcional', 'HIIT', 'Alongamento', 'Esporte', 'Outro'];
const SUBJECT_COLORS = ['#8b7bff', '#4d8dff', '#22c5d6', '#2ec4a0', '#f5b942', '#ff8a4c', '#ff6b8b', '#d56bff'];
const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const MONTHS_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const WEEKDAYS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
const WD_SHORT = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const BUCKET_LABEL = { atrasada: 'Atrasadas', hoje: 'Vencem hoje', amanha: 'Vencem amanhã', semana: 'Próximos 7 dias', depois: 'Mais adiante', 'sem-prazo': 'Sem prazo', concluida: 'Concluídas' };
const BUCKET_RANK = { atrasada: 0, hoje: 1, amanha: 2, semana: 3, depois: 4, 'sem-prazo': 5, concluida: 6 };
const STATUS_LABEL = { pendente: 'Pendente', andamento: 'Em andamento', concluida: 'Concluída', atrasada: 'Atrasada' };

let _nowFn = () => new Date();
const now = () => _nowFn();

/* ---------- datas ---------- */
const pad = n => String(n).padStart(2, '0');
const ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const hhmm = d => pad(d.getHours()) + ':' + pad(d.getMinutes());
function parseYmd(s) { const p = String(s).slice(0, 10).split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); }
function parseDT(s) {
  if (!s) return null;
  const parts = String(s).split('T');
  const dp = parts[0].split('-').map(Number);
  const tp = (parts[1] || '23:59').split(':').map(Number);
  const d = new Date(dp[0], dp[1] - 1, dp[2], tp[0] || 0, tp[1] || 0);
  return isNaN(d) ? null : d;
}
function addDays(d, n) { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()); x.setDate(x.getDate() + n); return x; }
function dayDiff(a, b) { return Math.round((parseYmd(b) - parseYmd(a)) / 864e5); }
function startOfWeek(d, ws) { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - ((x.getDay() - ws + 7) % 7)); return x; }
function weekDays(d, ws) { const s = startOfWeek(d, ws); return [0, 1, 2, 3, 4, 5, 6].map(i => ymd(addDays(s, i))); }
function fmtLong(d) { return WEEKDAYS[d.getDay()] + ', ' + d.getDate() + ' de ' + MONTHS[d.getMonth()] + ' de ' + d.getFullYear(); }
function fmtShort(s) { const d = parseYmd(s); return d.getDate() + ' ' + MONTHS_SHORT[d.getMonth()]; }
function fmtWeekdayShort(s) { return WD_SHORT[parseYmd(s).getDay()]; }
function toLocalISO(str) { if (!str) return ''; const d = new Date(str); return isNaN(d) ? '' : ymd(d) + 'T' + hhmm(d); }
const pl = (n, one, many) => n + ' ' + (n === 1 ? one : many);
function uid() { try { if (crypto && crypto.randomUUID) return crypto.randomUUID(); } catch (e) { } return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10); }

function monthMatrix(year, month, ws) {
  const first = new Date(year, month, 1);
  const start = addDays(first, -((first.getDay() - ws + 7) % 7));
  const rows = [];
  for (let w = 0; w < 6; w++) {
    const row = [];
    for (let i = 0; i < 7; i++) { const dt = addDays(start, w * 7 + i); row.push({ date: ymd(dt), inMonth: dt.getMonth() === month, day: dt.getDate() }); }
    rows.push(row);
  }
  if (!rows[5].some(c => c.inMonth)) rows.pop();
  return rows;
}
const dowLabels = ws => [0, 1, 2, 3, 4, 5, 6].map(i => WD_SHORT[(ws + i) % 7]);

/* ---------- modelo de dados ---------- */
function defaultDB() {
  const t = new Date().toISOString();
  return {
    app: 'life-dashboard', schema: SCHEMA,
    settings: { name: '', theme: 'dark', accent: 'violet', weekStart: 1, weeklyGoal: 4, msClientId: '', msTenant: 'organizations', msTid: '', msLastSync: null, msAccount: null, lastBackupAt: null, demoSeeded: false },
    subjects: [], assignments: [], workouts: [], tasks: [], readNotifs: {},
    meta: { createdAt: t, updatedAt: t }
  };
}
function normalizeDB(raw) {
  const base = defaultDB();
  if (!raw || typeof raw !== 'object') return base;
  const list = v => Array.isArray(v) ? v.filter(x => x && typeof x === 'object' && x.id) : [];
  const out = Object.assign(base, { subjects: list(raw.subjects), assignments: list(raw.assignments), workouts: list(raw.workouts), tasks: list(raw.tasks) });
  out.settings = Object.assign(base.settings, raw.settings && typeof raw.settings === 'object' ? raw.settings : {});
  out.readNotifs = raw.readNotifs && typeof raw.readNotifs === 'object' ? raw.readNotifs : {};
  out.meta = Object.assign(base.meta, raw.meta || {});
  out.workouts.forEach(w => { if (!Array.isArray(w.muscles)) w.muscles = []; });
  return out;
}

/* ---------- escola ---------- */
function effStatus(a, n) {
  if (a.status === 'concluida') return 'concluida';
  const due = parseDT(a.dueAt);
  if (due && due < (n || now())) return 'atrasada';
  return a.status === 'andamento' ? 'andamento' : 'pendente';
}
function dueBucket(a, n) {
  n = n || now();
  if (a.status === 'concluida') return 'concluida';
  const due = parseDT(a.dueAt);
  if (!due) return 'sem-prazo';
  if (due < n) return 'atrasada';
  const diff = dayDiff(ymd(n), ymd(due));
  if (diff <= 0) return 'hoje';
  if (diff === 1) return 'amanha';
  if (diff <= 7) return 'semana';
  return 'depois';
}
function sortByUrgency(list, n) {
  return list.slice().sort((a, b) => {
    const ra = BUCKET_RANK[dueBucket(a, n)], rb = BUCKET_RANK[dueBucket(b, n)];
    if (ra !== rb) return ra - rb;
    const da = a.dueAt || '9999', dbb = b.dueAt || '9999';
    if (ra === 6) return String(b.completedAt || '').localeCompare(String(a.completedAt || ''));
    if (da !== dbb) return da < dbb ? -1 : 1;
    return String(a.title).localeCompare(String(b.title), 'pt-BR');
  });
}
function dueInfo(a, n) {
  n = n || now();
  const due = parseDT(a.dueAt);
  if (a.status === 'concluida') return { text: a.doneBy === 'teams' ? 'Entregue no Teams' : 'Concluída', tone: 'ok' };
  if (!due) return { text: 'Sem prazo', tone: '' };
  const t = String(a.dueAt).includes('T') ? ' às ' + hhmm(due) : '';
  const diff = dayDiff(ymd(n), ymd(due));
  if (due < n) return { text: diff === 0 ? 'Venceu hoje' + t : diff === -1 ? 'Venceu ontem' + t : 'Venceu há ' + (-diff) + ' dias', tone: 'bad' };
  if (diff === 0) return { text: 'Hoje' + t, tone: 'warn' };
  if (diff === 1) return { text: 'Amanhã' + t, tone: 'warn' };
  if (diff <= 7) return { text: fmtWeekdayShort(ymd(due)) + ', ' + fmtShort(ymd(due)) + t, tone: 'info' };
  return { text: fmtShort(ymd(due)) + t, tone: '' };
}
function subjectOf(db, id) { return db.subjects.find(s => s.id === id) || null; }
function schoolSummary(db, n) {
  n = n || now();
  const c = { open: 0, soon: 0, late: 0, today: 0, tomorrow: 0, week: 0, done: 0, inProgress: 0 };
  const per = {};
  db.assignments.forEach(a => {
    const b = dueBucket(a, n);
    if (b === 'concluida') { c.done++; return; }
    c.open++;
    if (a.status === 'andamento' && b !== 'atrasada') c.inProgress++;
    if (b === 'atrasada') c.late++;
    if (b === 'hoje') { c.today++; c.soon++; }
    if (b === 'amanha') { c.tomorrow++; c.soon++; }
    if (b === 'semana') { c.week++; c.soon++; }
    const k = a.subjectId || '_';
    per[k] = per[k] || { subject: subjectOf(db, a.subjectId), count: 0, late: 0 };
    per[k].count++; if (b === 'atrasada') per[k].late++;
  });
  c.bySubject = Object.values(per).sort((x, y) => y.late - x.late || y.count - x.count);
  return c;
}
function onTimeRate(db) {
  const done = db.assignments.filter(a => a.status === 'concluida' && a.dueAt && a.completedAt);
  if (!done.length) return null;
  const ok = done.filter(a => new Date(a.completedAt) <= parseDT(a.dueAt)).length;
  return Math.round(ok / done.length * 100);
}
function nextColor(db) {
  const used = db.subjects.map(s => s.color);
  return SUBJECT_COLORS.find(c => !used.includes(c)) || SUBJECT_COLORS[db.subjects.length % SUBJECT_COLORS.length];
}

/* ---------- tarefas ---------- */
function taskBucket(t, n, ws) {
  n = n || now();
  if (t.done) return 'concluidas';
  if (!t.date) return 'sem-data';
  const today = ymd(n);
  if (t.date < today) return 'atrasadas';
  const diff = dayDiff(today, t.date);
  if (diff === 0) return 'hoje';
  if (diff === 1) return 'amanha';
  const end = ymd(addDays(startOfWeek(n, ws), 6));
  if (t.date <= end) return 'semana';
  return 'proximos';
}
const TASK_GROUPS = [
  ['atrasadas', 'Atrasadas'], ['hoje', 'Hoje'], ['amanha', 'Amanhã'], ['semana', 'Esta semana'],
  ['proximos', 'Próximos dias'], ['sem-data', 'Sem data'], ['concluidas', 'Concluídas']
];
function sortTasks(list) {
  const pr = { alta: 0, media: 1, baixa: 2 };
  return list.slice().sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    if (a.done) return String(b.doneAt || '').localeCompare(String(a.doneAt || ''));
    const da = (a.date || '9999') + (a.time || '24:00'), dbb = (b.date || '9999') + (b.time || '24:00');
    if (da !== dbb) return da < dbb ? -1 : 1;
    return (pr[a.priority] ?? 1) - (pr[b.priority] ?? 1);
  });
}
function routineSummary(db, n) {
  n = n || now();
  const today = ymd(n);
  let doneToday = 0, remainingToday = 0, late = 0, open = 0;
  db.tasks.forEach(t => {
    if (t.done) { const dd = t.doneAt ? ymd(new Date(t.doneAt)) : ''; if (dd === today || (!dd && t.date === today)) doneToday++; return; }
    open++;
    if (t.date === today) remainingToday++;
    else if (t.date && t.date < today) late++;
  });
  return { doneToday, remainingToday, late, open };
}
function nextAppointment(db, n) {
  n = n || now();
  const c = [];
  db.tasks.forEach(t => {
    if (t.done || t.category !== 'compromissos' || !t.date) return;
    const dt = parseDT(t.date + 'T' + (t.time || '23:59'));
    if (dt >= n) c.push({ kind: 'compromisso', id: t.id, title: t.title, date: t.date, time: t.time || '', at: dt, ref: t });
  });
  db.workouts.forEach(w => {
    if (w.kind !== 'programado') return;
    const dt = parseDT(w.date + 'T' + (w.time || '23:59'));
    if (dt >= n) c.push({ kind: 'treino', id: w.id, title: workoutTitle(w), date: w.date, time: w.time || '', at: dt, ref: w });
  });
  c.sort((a, b) => a.at - b.at);
  return c[0] || null;
}

/* ---------- academia ---------- */
function workoutTitle(w) {
  const m = (w.muscles || []).join(' + ');
  if (w.kind === 'descanso') return 'Descanso';
  return m || w.type || 'Treino';
}
function trainedDays(db) { const s = new Set(); db.workouts.forEach(w => { if (w.kind === 'treino') s.add(w.date); }); return s; }
function countRange(set, from, to) { let c = 0; set.forEach(d => { if (d >= from && d <= to) c++; }); return c; }
function dayGymState(db, date, n) {
  const ws = db.workouts.filter(w => w.date === date);
  if (ws.some(w => w.kind === 'treino')) return 'ok';
  if (ws.some(w => w.kind === 'programado')) return 'plan';
  if (ws.some(w => w.kind === 'descanso')) return 'rest';
  return date <= ymd(n || now()) ? 'none' : 'future';
}
function weeklySeries(db, n, count) {
  n = n || now(); count = count || 12;
  const set = trainedDays(db), ws = db.settings.weekStart, s0 = startOfWeek(n, ws), out = [];
  for (let i = count - 1; i >= 0; i--) {
    const s = addDays(s0, -7 * i), e = addDays(s, 6);
    out.push({ label: s.getDate() + '/' + (s.getMonth() + 1), value: countRange(set, ymd(s), ymd(e)), start: ymd(s), current: i === 0 });
  }
  return out;
}
function monthlySeries(db, n, count) {
  n = n || now(); count = count || 12;
  const set = trainedDays(db), out = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(n.getFullYear(), n.getMonth() - i, 1);
    const from = ymd(d), to = ymd(new Date(d.getFullYear(), d.getMonth() + 1, 0));
    out.push({ label: MONTHS_SHORT[d.getMonth()], value: countRange(set, from, to), current: i === 0 });
  }
  return out;
}
function gymSummary(db, n) {
  n = n || now();
  const ws = db.settings.weekStart, goal = Math.max(1, +db.settings.weeklyGoal || 4);
  const set = trainedDays(db), days = weekDays(n, ws);
  const week = countRange(set, days[0], days[6]);
  const m0 = ymd(new Date(n.getFullYear(), n.getMonth(), 1)), m1 = ymd(new Date(n.getFullYear(), n.getMonth() + 1, 0));
  const month = countRange(set, m0, m1);
  const total = db.workouts.filter(w => w.kind === 'treino').length;
  let avg = 0;
  if (set.size) {
    const first = Array.from(set).sort()[0];
    const weeks = Math.floor(dayDiff(ymd(startOfWeek(parseYmd(first), ws)), ymd(startOfWeek(n, ws))) / 7) + 1;
    avg = Math.round(set.size / weeks * 10) / 10;
  }
  const today = ymd(n);
  return {
    week, goal, pct: Math.round(week / goal * 100), month, total, avg,
    weekDays: days.map(d => ({ date: d, label: WD_SHORT[parseYmd(d).getDay()], state: dayGymState(db, d, n), today: d === today })),
    left: Math.max(0, goal - week), daysLeft: dayDiff(today, days[6]) + 1
  };
}
function muscleCounts(db, n, span) {
  n = n || now(); span = span || 90;
  const from = ymd(addDays(n, -span)), c = {};
  db.workouts.forEach(w => { if (w.kind === 'treino' && w.date >= from) (w.muscles || []).forEach(m => { c[m] = (c[m] || 0) + 1; }); });
  return Object.entries(c).sort((a, b) => b[1] - a[1]);
}

/* ---------- produtividade e calendário ---------- */
function productivitySeries(db, n, days) {
  n = n || now(); days = days || 14;
  const map = {}, out = [];
  for (let i = days - 1; i >= 0; i--) { const d = ymd(addDays(n, -i)); map[d] = { date: d, school: 0, tasks: 0, gym: 0 }; out.push(map[d]); }
  const dk = iso => { if (!iso) return ''; const d = new Date(iso); return isNaN(d) ? '' : ymd(d); };
  db.tasks.forEach(t => { if (t.done) { const k = dk(t.doneAt) || t.date; if (map[k]) map[k].tasks++; } });
  db.assignments.forEach(a => { if (a.status === 'concluida') { const k = dk(a.completedAt); if (map[k]) map[k].school++; } });
  db.workouts.forEach(w => { if (w.kind === 'treino' && map[w.date]) map[w.date].gym++; });
  return out;
}
const CAT_LABEL = Object.fromEntries(CATEGORIES.map(c => [c.id, c.label]));
function dayEvents(db, date, layers, n) {
  layers = layers || { escola: true, academia: true, tarefas: true };
  n = n || now();
  const ev = [];
  if (layers.escola) db.assignments.forEach(a => {
    if (a.dueAt && String(a.dueAt).slice(0, 10) === date) {
      const s = subjectOf(db, a.subjectId);
      ev.push({ type: 'assignment', id: a.id, title: a.title, time: String(a.dueAt).includes('T') ? String(a.dueAt).slice(11, 16) : '', color: s ? s.color : 'var(--accent)', sub: s ? s.name : '', status: effStatus(a, n), done: a.status === 'concluida' });
    }
  });
  if (layers.academia) db.workouts.forEach(w => {
    if (w.date === date) ev.push({ type: 'workout', id: w.id, title: w.kind === 'treino' ? 'Treino: ' + workoutTitle(w) : w.kind === 'programado' ? 'Programado: ' + workoutTitle(w) : 'Descanso', time: w.time || '', color: w.kind === 'treino' ? 'var(--ok)' : w.kind === 'programado' ? 'var(--info)' : 'var(--warn)', sub: w.duration ? w.duration + ' min' : '', kind: w.kind, done: w.kind === 'treino' });
  });
  if (layers.tarefas) db.tasks.forEach(t => {
    if (t.date === date) ev.push({ type: 'task', id: t.id, title: t.title, time: t.time || '', color: t.category === 'compromissos' ? 'var(--info)' : 'var(--accent)', sub: CAT_LABEL[t.category] || '', done: !!t.done, cat: t.category });
  });
  const ord = { assignment: 0, task: 1, workout: 2 };
  ev.sort((a, b) => (a.time || '00:00').localeCompare(b.time || '00:00') || ord[a.type] - ord[b.type]);
  return ev;
}

/* ---------- notificações internas ---------- */
function buildNotifications(db, n) {
  n = n || now();
  const out = [], today = ymd(n), A = db.assignments;
  const names = list => list.slice(0, 3).map(a => a.title).join(', ') + (list.length > 3 ? ' e mais ' + (list.length - 3) : '');
  const late = A.filter(a => dueBucket(a, n) === 'atrasada');
  if (late.length) out.push({ id: 'late:' + late.length + ':' + today, level: 'bad', icon: 'alert', title: late.length === 1 ? 'Uma atividade escolar está atrasada' : late.length + ' atividades escolares estão atrasadas', text: names(late), route: 'escola', filter: 'atrasada' });
  const dToday = A.filter(a => dueBucket(a, n) === 'hoje');
  if (dToday.length) out.push({ id: 'dtoday:' + dToday.length + ':' + today, level: 'warn', icon: 'clock', title: dToday.length === 1 ? 'Uma atividade escolar vence hoje' : dToday.length + ' atividades escolares vencem hoje', text: names(dToday), route: 'escola', filter: 'hoje' });
  const dTom = A.filter(a => dueBucket(a, n) === 'amanha');
  if (dTom.length) out.push({ id: 'dtom:' + dTom.length + ':' + today, level: 'warn', icon: 'clock', title: dTom.length === 1 ? 'Você possui uma atividade escolar com prazo amanhã' : 'Você possui ' + dTom.length + ' atividades escolares com prazo amanhã', text: names(dTom), route: 'escola', filter: 'amanha' });
  const tToday = db.tasks.filter(t => !t.done && t.date === today);
  if (tToday.length) out.push({ id: 'ttoday:' + tToday.length + ':' + today, level: 'info', icon: 'tasks', title: tToday.length === 1 ? 'Existe uma tarefa pendente para hoje' : 'Existem ' + tToday.length + ' tarefas pendentes para hoje', text: tToday.slice(0, 3).map(t => t.title).join(', '), route: 'tarefas' });
  const tLate = db.tasks.filter(t => !t.done && t.date && t.date < today);
  if (tLate.length) out.push({ id: 'tlate:' + tLate.length + ':' + today, level: 'bad', icon: 'tasks', title: tLate.length === 1 ? 'Uma tarefa está atrasada' : tLate.length + ' tarefas estão atrasadas', text: tLate.slice(0, 3).map(t => t.title).join(', '), route: 'tarefas' });
  const g = gymSummary(db, n);
  if (g.week >= g.goal) out.push({ id: 'goalok:' + g.week + ':' + g.goal + ':' + today, level: 'ok', icon: 'flame', title: 'Meta semanal de academia atingida', text: g.week + ' de ' + g.goal + ' treinos nesta semana.', route: 'academia' });
  else out.push({ id: 'goal:' + g.week + ':' + g.goal + ':' + today, level: g.left >= g.daysLeft ? 'warn' : 'info', icon: 'gym', title: 'Você ainda não atingiu sua meta semanal de academia', text: g.week + ' de ' + g.goal + ' treinos. Faltam ' + g.left + ', restam ' + pl(g.daysLeft, 'dia', 'dias') + ' na semana.', route: 'academia' });
  const na = nextAppointment(db, n);
  if (na && (na.at - n) <= 3 * 36e5) out.push({ id: 'appt:' + na.id + ':' + na.date, level: 'warn', icon: 'calendar', title: (na.kind === 'treino' ? 'Treino programado às ' : 'Compromisso às ') + (na.time || '--:--'), text: na.title, route: na.kind === 'treino' ? 'academia' : 'tarefas' });
  const s = db.settings;
  if (s.msAccount && s.msLastSync && (n - new Date(s.msLastSync)) > 864e5) out.push({ id: 'sync:' + today, level: 'info', icon: 'refresh', title: 'As atividades do Teams não são atualizadas há mais de um dia', text: 'Abra Escola e toque em Sincronizar.', route: 'escola' });
  const real = [db.assignments, db.workouts, db.tasks].reduce((t, l) => t + l.filter(x => !x.demo).length, 0);
  if (real >= 3 && (!s.lastBackupAt || (n - new Date(s.lastBackupAt)) > 14 * 864e5)) out.push({ id: 'backup:' + today.slice(0, 7), level: 'info', icon: 'download', title: 'Faça um backup dos seus dados', text: 'Eles ficam salvos só neste navegador. Exporte um arquivo em Configurações.', route: 'configuracoes' });
  const rank = { bad: 0, warn: 1, info: 2, ok: 3 };
  return out.sort((a, b) => rank[a.level] - rank[b.level]);
}

/* ---------- sincronização com o Teams (mescla dados já normalizados) ---------- */
function mergeTeams(db, payload, n) {
  n = n || now();
  let added = 0, updated = 0, removed = 0;
  payload.subjects.forEach(s => {
    const ex = db.subjects.find(x => x.id === s.id);
    if (ex) ex.name = s.name;
    else db.subjects.push({ id: s.id, name: s.name, teacher: s.teacher || '', color: nextColor(db), source: 'teams', demo: false });
  });
  payload.assignments.forEach(p => {
    let ex = db.assignments.find(x => x.id === p.id);
    const stamp = n.toISOString();
    if (!ex) {
      ex = { id: p.id, source: 'teams', demo: false, subjectId: p.subjectId, title: p.title, description: p.description, teacher: p.teacher, publishedAt: p.publishedAt, dueAt: p.dueAt, url: p.url, status: 'pendente', doneBy: null, completedAt: null, createdAt: stamp, updatedAt: stamp };
      db.assignments.push(ex); added++;
    } else {
      Object.assign(ex, { subjectId: p.subjectId, title: p.title, description: p.description, teacher: p.teacher || ex.teacher, publishedAt: p.publishedAt, dueAt: p.dueAt, url: p.url, updatedAt: stamp }); updated++;
    }
    if (p.submitted === true) { ex.status = 'concluida'; ex.doneBy = 'teams'; ex.completedAt = p.submittedAt || ex.completedAt || stamp; }
    else if (p.submitted === false && ex.status === 'concluida' && ex.doneBy === 'teams') { ex.status = 'pendente'; ex.doneBy = null; ex.completedAt = null; }
  });
  /* Tarefa que sumiu do Teams em uma turma lida por inteiro foi apagada pelo professor. Se a resposta veio vazia, não apaga nada. */
  if (payload.syncedSubjectIds && payload.assignments.length) {
    const keep = new Set(payload.assignments.map(a => a.id)), synced = new Set(payload.syncedSubjectIds);
    db.assignments = db.assignments.filter(a => { if (a.source !== 'teams' || !synced.has(a.subjectId) || keep.has(a.id)) return true; removed++; return false; });
  }
  db.settings.msLastSync = n.toISOString();
  return { added, updated, removed };
}

/* ---------- dados de exemplo (sempre marcados com demo:true) ---------- */
function seedDemo(db, n) {
  n = n || now();
  const at = (k, h, m) => { const d = addDays(n, k); return new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m).toISOString(); };
  const dt = (k, t) => ymd(addDays(n, k)) + 'T' + t;
  const stamp = n.toISOString();
  const S = (name, color, teacher) => { const s = { id: uid(), name, color, teacher: teacher || '', source: 'manual', demo: true }; db.subjects.push(s); return s.id; };
  const mat = S('Matemática', SUBJECT_COLORS[0], 'Prof. Almeida'), fis = S('Física', SUBJECT_COLORS[1], 'Profa. Souza'), his = S('História', SUBJECT_COLORS[5], ''), por = S('Português', SUBJECT_COLORS[6], 'Profa. Lima'), bio = S('Biologia', SUBJECT_COLORS[3], '');
  const A = (subjectId, title, description, pub, due, status, done) => db.assignments.push({ id: uid(), source: 'manual', demo: true, subjectId, title, description, teacher: '', publishedAt: ymd(addDays(n, pub)), dueAt: due, url: '', status, doneBy: status === 'concluida' ? 'user' : null, completedAt: done || null, createdAt: stamp, updatedAt: stamp });
  A(mat, 'Lista de exercícios 7: funções', 'Resolver os exercícios 1 a 12 da apostila.', -9, dt(-2, '23:59'), 'pendente');
  A(fis, 'Relatório do laboratório de óptica', 'Descrever o experimento e anexar as medições.', -6, dt(0, '18:00'), 'andamento');
  A(his, 'Resumo do capítulo 5', 'Resumo de uma página sobre o período estudado.', -4, dt(1, '12:00'), 'pendente');
  A(por, 'Redação: crônica', 'Texto de 25 a 30 linhas.', -5, dt(3, '23:59'), 'andamento');
  A(bio, 'Seminário em grupo: ecossistemas', 'Apresentação de 10 minutos.', -3, dt(5, '14:00'), 'pendente');
  A(fis, 'Questionário de eletricidade', '', -1, dt(6, '23:59'), 'pendente');
  A(bio, 'Projeto de ciências', 'Entrega do projeto final com relatório.', -2, dt(11, '23:59'), 'pendente');
  A(por, 'Leitura do livro do bimestre', 'Ler até o capítulo 8.', -7, dt(16, '23:59'), 'pendente');
  A(his, 'Atividade de mapas', '', -10, dt(-3, '23:59'), 'concluida', at(-4, 20, 10));
  A(mat, 'Lista de exercícios 6', '', -14, dt(-6, '23:59'), 'concluida', at(-6, 19, 30));
  A(por, 'Resenha crítica', '', -12, dt(-5, '12:00'), 'concluida', at(-4, 9, 0));
  const W = (k, time, kind, muscles, type, duration) => db.workouts.push({ id: uid(), demo: true, date: ymd(addDays(n, k)), time, kind, muscles, type, duration, notes: '', createdAt: stamp, updatedAt: stamp });
  const plan = { 1: ['Peito', 'Tríceps'], 2: ['Costas', 'Bíceps'], 4: ['Pernas'], 5: ['Ombros', 'Abdômen'] };
  for (let k = -35; k <= -1; k++) {
    const d = addDays(n, k), dow = d.getDay(), p = plan[dow];
    if (p && Math.abs(k) % 9 !== 0) W(k, dow % 2 ? '18:30' : '07:15', 'treino', p, 'Musculação', 48 + (Math.abs(k) * 7) % 26);
    else if (dow === 6 && Math.abs(k) % 2 === 0) W(k, '09:00', 'treino', ['Cardio'], 'Cardio', 35);
    else if (dow === 0) W(k, '', 'descanso', [], '', null);
  }
  W(1, '18:30', 'programado', plan[addDays(n, 1).getDay()] || ['Corpo inteiro'], 'Musculação', 50);
  W(2, '18:30', 'programado', plan[addDays(n, 2).getDay()] || ['Cardio'], 'Musculação', 50);
  const T = (title, description, k, time, priority, category, done, doneK) => db.tasks.push({ id: uid(), demo: true, title, description, date: k === null ? '' : ymd(addDays(n, k)), time, priority, category, done: !!done, doneAt: done ? at(doneK === undefined ? 0 : doneK, 17, 40) : null, createdAt: stamp, updatedAt: stamp });
  T('Estudar para a prova de Física', 'Capítulos 3 e 4.', 0, '20:00', 'alta', 'escola');
  T('Ler 20 páginas do livro', '', 0, '', 'media', 'escola');
  T('Organizar a mochila', '', 0, '', 'baixa', 'pessoal', true, 0);
  T('Reunião do grupo do seminário', 'Combinar a divisão das falas.', 1, '15:30', 'alta', 'compromissos');
  T('Revisar anotações de História', '', 2, '', 'baixa', 'escola');
  T('Pagar a mensalidade do curso', '', 2, '', 'media', 'pessoal');
  T('Consulta no dentista', '', 4, '10:00', 'media', 'compromissos');
  T('Comprar suplemento', '', 7, '', 'baixa', 'outros');
  T('Montar playlist de estudos', '', null, '', 'baixa', 'outros');
  T('Entregar formulário da escola', '', -1, '', 'alta', 'escola');
  const doneNames = ['Entregar trabalho de Geografia', 'Comprar material de laboratório', 'Lavar o uniforme', 'Enviar e-mail ao professor', 'Revisar o caderno de Química', 'Imprimir a apostila', 'Marcar horário no oculista'];
  [-1, -1, -2, -3, -3, -5, -8].forEach((k, i) => T(doneNames[i], '', k, '', 'media', i % 2 ? 'pessoal' : 'escola', true, k));
  db.settings.demoSeeded = true;
}
function removeDemo(db) {
  ['assignments', 'workouts', 'tasks'].forEach(k => { db[k] = db[k].filter(x => !x.demo); });
  const used = new Set(db.assignments.map(a => a.subjectId));
  db.subjects = db.subjects.filter(s => !s.demo || used.has(s.id));
  db.subjects.forEach(s => { s.demo = false; });
}
const hasDemo = db => ['subjects', 'assignments', 'workouts', 'tasks'].some(k => db[k].some(x => x.demo));

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

/* ===== LIFE DASHBOARD: calendário, tarefas, estatísticas e configurações ===== */

/* ---------- calendário ---------- */
function weekTitle(d, ws) {
  const days = weekDays(d, ws), a = parseYmd(days[0]), b = parseYmd(days[6]);
  return a.getDate() + (a.getMonth() !== b.getMonth() ? ' ' + MONTHS_SHORT[a.getMonth()] : '') + ' a ' + b.getDate() + ' ' + MONTHS_SHORT[b.getMonth()] + ' ' + b.getFullYear();
}
function evtButton(e) {
  return '<button class="evt' + (e.done ? ' done' : '') + '" style="--c:' + safeColor(e.color) + '" data-act="cal-open" data-type="' + e.type + '" data-id="' + e.id + '"><span>' + (e.time ? e.time + ' · ' : '') + esc(e.title) + '</span>' + (e.sub ? '<small>' + esc(e.sub) + '</small>' : '') + '</button>';
}
function dayPanel(n) {
  const d = ui.cal.sel, ev = dayEvents(db, d, ui.cal.layers, n), date = parseYmd(d);
  const rows = ev.map(e => {
    const lead = e.type === 'assignment' ? '<button class="chk' + (e.done ? ' on' : '') + '" data-act="toggle-assignment" data-id="' + e.id + '" aria-label="Alternar conclusão">' + ic('check', 14) + '</button>' :
      e.type === 'task' ? '<button class="chk' + (e.done ? ' on' : '') + '" data-act="toggle-task" data-id="' + e.id + '" aria-label="Alternar conclusão">' + ic('check', 14) + '</button>' :
        '<span class="ico-t" style="--c:' + safeColor(e.color) + '">' + ic(e.kind === 'descanso' ? 'moon' : 'gym', 18) + '</span>';
    const kind = e.type === 'assignment' ? 'Entrega' : e.type === 'task' ? 'Tarefa' : 'Treino';
    return '<div class="li compact">' + lead + '<div class="li-b"><div class="li-t' + (e.done && e.type !== 'workout' ? ' done' : '') + '">' + esc(e.title) + '</div><div class="li-m"><span class="pill acc" style="--c:' + safeColor(e.color) + '">' + kind + '</span>' + (e.time ? '<span>' + e.time + '</span>' : '') + (e.sub ? '<span>' + esc(e.sub) + '</span>' : '') + '</div></div><div class="li-r"><button class="icon-btn sm" data-act="cal-open" data-type="' + e.type + '" data-id="' + e.id + '" aria-label="Editar">' + ic('edit', 16) + '</button></div></div>';
  }).join('');
  return '<section class="card side-p"><div class="dayp-h"><h2>' + esc(cap(fmtLong(date))) + '</h2></div><div class="add-row"><button class="btn sm" data-act="new-task" data-date="' + d + '">' + ic('plus', 15) + ' Tarefa</button><button class="btn sm" data-act="new-assignment" data-date="' + d + '">' + ic('plus', 15) + ' Atividade</button><button class="btn sm" data-act="new-workout" data-date="' + d + '">' + ic('plus', 15) + ' Treino</button></div>' +
    (rows ? '<div class="list">' + rows + '</div>' : emptyState('calendar', 'Nada marcado para este dia.', '')) + '</section>';
}
function viewCalendar() {
  const n = now(), ws = db.settings.weekStart, c = ui.cal, today = ymd(n), cur = parseYmd(c.cursor);
  const title = c.mode === 'mes' ? cap(MONTHS[cur.getMonth()]) + ' de ' + cur.getFullYear() : weekTitle(cur, ws);
  const lay = (k, label, color) => '<button class="chip' + (c.layers[k] ? ' on' : '') + '" data-act="cal-layer" data-layer="' + k + '"><span class="dot" style="background:' + color + '"></span>' + label + '</button>';
  const tools = '<div class="cal-tools"><div class="cal-nav"><button class="icon-btn" data-act="cal-prev" aria-label="Anterior">' + ic('chevL', 20) + '</button><button class="icon-btn" data-act="cal-next" aria-label="Próximo">' + ic('chevR', 20) + '</button></div><div class="cal-title">' + esc(title) + '</div><button class="btn sm" data-act="cal-today">Hoje</button><div class="segc" style="margin-left:auto"><button data-act="cal-mode" data-mode="mes" aria-pressed="' + (c.mode === 'mes') + '">Mensal</button><button data-act="cal-mode" data-mode="semana" aria-pressed="' + (c.mode === 'semana') + '">Semanal</button></div></div><div class="chips" style="margin-bottom:16px">' + lay('escola', 'Escola', 'var(--accent-2)') + lay('academia', 'Academia', 'var(--ok)') + lay('tarefas', 'Tarefas e compromissos', 'var(--accent)') + '</div>';
  let body;
  if (c.mode === 'mes') {
    const rows = monthMatrix(cur.getFullYear(), cur.getMonth(), ws);
    const cells = rows.map(r => r.map(x => {
      const ev = dayEvents(db, x.date, c.layers, n);
      const dots = ev.slice(0, 4).map(e => '<i style="--c:' + safeColor(e.color) + '"></i>').join('');
      const evs = ev.slice(0, 3).map(e => '<span class="ev" style="--c:' + safeColor(e.color) + '">' + (e.time ? e.time + ' ' : '') + esc(e.title) + '</span>').join('') + (ev.length > 3 ? '<span class="ev more">+' + (ev.length - 3) + ' mais</span>' : '');
      return '<button class="day' + (x.inMonth ? '' : ' out') + (x.date === today ? ' today' : '') + (x.date === c.sel ? ' sel' : '') + '" data-act="cal-pick" data-date="' + x.date + '" aria-label="' + x.day + ' de ' + MONTHS[parseYmd(x.date).getMonth()] + (ev.length ? ', ' + pl(ev.length, 'item', 'itens') : '') + '"><span class="dn">' + x.day + '</span><span class="dots">' + dots + '</span><span class="evs">' + evs + '</span></button>';
    }).join('')).join('');
    body = '<section class="card"><div class="dow-r">' + dowLabels(ws).map(d => '<span>' + d + '</span>').join('') + '</div><div class="cal-g">' + cells + '</div></section>';
  } else {
    body = '<div class="wk">' + weekDays(cur, ws).map(d => {
      const dt = parseYmd(d), ev = dayEvents(db, d, c.layers, n);
      return '<section class="wk-d' + (d === today ? ' today' : '') + '"><header><span>' + cap(WD_SHORT[dt.getDay()]) + ' <small>' + dt.getDate() + ' ' + MONTHS_SHORT[dt.getMonth()] + '</small></span><button class="icon-btn sm" data-act="cal-pick" data-date="' + d + '" aria-label="Selecionar dia ' + dt.getDate() + '">' + ic('plus', 16) + '</button></header>' + (ev.length ? ev.map(evtButton).join('') : '<small class="muted">Livre</small>') + '</section>';
    }).join('') + '</div>';
  }
  return '<div>' + pageHead('Calendário', 'Entregas, treinos, tarefas e compromissos por data.', '') + tools + '<div class="cal-layout"><div style="min-width:0">' + body + '</div>' + dayPanel(n) + '</div></div>';
}

/* ---------- tarefas ---------- */
function taskRow(t, n) {
  const pr = { alta: ['bad', 'Alta'], media: ['warn', 'Média'], baixa: ['', 'Baixa'] }[t.priority] || ['', 'Média'];
  const when = t.date ? whenText(t.date, t.time, n) : '';
  return '<div class="li"><button class="chk' + (t.done ? ' on' : '') + '" data-act="toggle-task" data-id="' + t.id + '" aria-label="' + (t.done ? 'Reabrir tarefa' : 'Concluir tarefa') + '">' + ic('check', 14) + '</button><div class="li-b"><div class="li-t' + (t.done ? ' done' : '') + '">' + esc(t.title) + '</div><div class="li-m">' + (when ? '<span>' + when + '</span>' : '') + '<span class="pill acc">' + esc(CAT_LABEL[t.category] || 'Outros') + '</span>' + (t.done ? '' : '<span class="pill ' + pr[0] + '">' + pr[1] + '</span>') + srcPill(t) + '</div>' + (t.description ? '<div class="li-d clamp2">' + esc(t.description) + '</div>' : '') + '</div><div class="li-r"><div class="li-a"><button class="icon-btn sm" data-act="edit-task" data-id="' + t.id + '" aria-label="Editar">' + ic('edit', 16) + '</button><button class="icon-btn sm" data-act="del-task" data-id="' + t.id + '" aria-label="Excluir">' + ic('trash', 16) + '</button></div></div></div>';
}
function viewTasks() {
  const n = now(), ws = db.settings.weekStart, cat = ui.tasks.cat;
  const list = db.tasks.filter(t => cat === 'all' || t.category === cat), byGroup = {};
  sortTasks(list).forEach(t => { const b = taskBucket(t, n, ws); (byGroup[b] = byGroup[b] || []).push(t); });
  const tone = { atrasadas: 'bad', hoje: 'warn', amanha: 'warn', semana: 'info' };
  const groups = TASK_GROUPS.filter(g => byGroup[g[0]]).map(g => '<div class="grp"><div class="grp-h"><span class="dot ' + (tone[g[0]] || '') + '"></span>' + g[1] + '<span class="pill ' + (tone[g[0]] || '') + '">' + byGroup[g[0]].length + '</span></div>' + byGroup[g[0]].map(t => taskRow(t, n)).join('') + '</div>').join('');
  const count = id => db.tasks.filter(t => !t.done && (id === 'all' || t.category === id)).length;
  return '<div class="stack-v">' + pageHead('Minhas tarefas', 'Rotina, compromissos e o que precisa ser feito.', '<button class="btn primary" data-act="new-task">' + ic('plus', 18) + ' Nova tarefa</button>') + demoBanner() +
    '<form class="card" id="f-quick" style="display:flex;gap:10px;padding:12px"><input class="in" id="quick-task" name="title" placeholder="Nova tarefa para hoje" maxlength="140" aria-label="Nova tarefa rápida"><button class="btn primary" type="submit">' + ic('plus', 18) + '<span>Adicionar</span></button></form>' +
    '<div class="chips"><button class="chip' + (cat === 'all' ? ' on' : '') + '" data-act="task-cat" data-cat="all">Todas <span class="n">' + count('all') + '</span></button>' + CATEGORIES.map(c => '<button class="chip' + (cat === c.id ? ' on' : '') + '" data-act="task-cat" data-cat="' + c.id + '">' + c.label + ' <span class="n">' + count(c.id) + '</span></button>').join('') + '</div>' +
    (groups ? '<div class="card flush">' + groups + '</div>' : '<div class="card">' + emptyState('tasks', 'Nenhuma tarefa por aqui.', '<button class="btn primary sm" data-act="new-task">' + ic('plus', 16) + ' Nova tarefa</button>') + '</div>') + '</div>';
}

/* ---------- estatísticas ---------- */
function viewStats() {
  const n = now(), ws = db.settings.weekStart, g = gymSummary(db, n), sc = schoolSummary(db, n);
  const days = weekDays(n, ws), from = days[0], to = days[6];
  const dk = iso => iso ? ymd(new Date(iso)) : '';
  const weekDone = db.tasks.filter(t => t.done && (dk(t.doneAt) || t.date) >= from && (dk(t.doneAt) || t.date) <= to).length + db.assignments.filter(a => a.status === 'concluida' && dk(a.completedAt) >= from && dk(a.completedAt) <= to).length;
  const rate = onTimeRate(db), ps = productivitySeries(db, n, 14), wsr = weeklySeries(db, n, 12), msr = monthlySeries(db, n, 12);
  const muscles = muscleCounts(db, n, 90).map(x => ({ label: x[0], value: x[1] }));
  const perSubject = sc.bySubject.map(x => ({ label: x.subject ? x.subject.name : 'Sem matéria', value: x.count, color: x.subject ? x.subject.color : '#8b7bff' }));
  const stat = (v, l) => '<div class="stat"><b class="num">' + v + '</b><span>' + l + '</span></div>';
  return '<div class="stack-v">' + pageHead('Estatísticas', 'Como estão sua frequência, suas entregas e sua rotina.', '') + demoBanner() +
    '<div class="stat-g four">' + stat(weekDone, 'Itens concluídos nesta semana') + stat(g.month, 'Treinos neste mês') + stat(rate === null ? '—' : rate + '%', 'Entregas feitas no prazo') + stat(sc.open, 'Atividades em aberto') + '</div>' +
    '<div class="two-col wide-l"><section class="card"><div class="card-h"><h2>Produtividade</h2><span class="muted" style="font-size:13px">Últimos 14 dias</span></div>' + barChart({ labels: ps.map(d => String(parseYmd(d.date).getDate())), current: ps.length - 1, legend: true, series: [{ name: 'Escola', color: 'var(--accent-2)', values: ps.map(d => d.school) }, { name: 'Rotina', color: 'var(--accent)', values: ps.map(d => d.tasks) }, { name: 'Academia', color: 'var(--ok)', values: ps.map(d => d.gym) }] }) + '</section>' +
    '<section class="card"><div class="card-h"><h2>Grupos musculares</h2><span class="muted" style="font-size:13px">Últimos 90 dias</span></div>' + hbars(muscles) + '</section></div>' +
    '<div class="two-col"><section class="card"><div class="card-h"><h2>Frequência semanal</h2><span class="muted" style="font-size:13px">12 semanas</span></div>' + areaChart({ labels: wsr.map(x => x.label), values: wsr.map(x => x.value), goal: g.goal, every: 2 }) + '</section>' +
    '<section class="card"><div class="card-h"><h2>Frequência mensal</h2><span class="muted" style="font-size:13px">12 meses</span></div>' + barChart({ labels: msr.map(x => x.label), current: msr.length - 1, series: [{ name: 'Dias treinados', color: 'var(--accent)', values: msr.map(x => x.value) }], every: 2 }) + '</section></div>' +
    '<section class="card"><div class="card-h"><h2>Atividades em aberto por matéria</h2></div>' + (perSubject.length ? hbars(perSubject) : emptyState('school', 'Nenhuma atividade em aberto.', '')) + '</section></div>';
}

/* ---------- configurações ---------- */
function viewSettings() {
  const s = db.settings, embedded = ui.embedded, connected = !!(msHasSession() && s.msAccount);
  const redirect = embedded ? 'https://SEU-USUARIO.github.io/life-dashboard/' : msRedirectUri();
  const seg = (act, key, opts, cur) => '<div class="segc" role="group">' + opts.map(o => '<button data-act="' + act + '" data-' + key + '="' + o[0] + '" aria-pressed="' + (String(cur) === String(o[0])) + '">' + o[1] + '</button>').join('') + '</div>';
  const appearance = '<section class="card"><div class="card-h"><h2>Perfil e aparência</h2></div>' +
    '<div class="set-row"><div><b>Seu nome</b><small>Usado na saudação da visão geral.</small></div><input class="in" id="set-name" style="max-width:240px" value="' + esc(s.name) + '" maxlength="40" aria-label="Seu nome"></div>' +
    '<div class="set-row"><div><b>Tema</b></div>' + seg('set-theme', 'v', [['dark', 'Escuro'], ['light', 'Claro']], s.theme) + '</div>' +
    '<div class="set-row"><div><b>Cor de destaque</b></div>' + seg('set-accent', 'v', [['violet', 'Violeta'], ['blue', 'Azul']], s.accent) + '</div>' +
    '<div class="set-row"><div><b>A semana começa na</b><small>Afeta calendários e a contagem semanal de treinos.</small></div>' + seg('set-weekstart', 'v', [['0', 'Domingo'], ['1', 'Segunda']], s.weekStart) + '</div>' +
    '<div class="set-row"><div><b>Meta semanal de treinos</b><small>Dias de academia por semana.</small></div><div class="stepper"><button class="icon-btn sm" data-act="goal-minus" aria-label="Diminuir meta">' + ic('minus', 16) + '</button><b class="num">' + s.weeklyGoal + '</b><button class="icon-btn sm" data-act="goal-plus" aria-label="Aumentar meta">' + ic('plus', 16) + '</button></div></div></section>';
  const msStatus = embedded ? '<p class="muted" style="font-size:13.5px;margin-bottom:12px">Dentro do Claude a conexão não roda. Estes campos valem para o app hospedado.</p>' : connected ? '<p style="margin-bottom:12px">' + ic('shield', 16) + ' Conectado como <b>' + esc(s.msAccount.name || s.msAccount.email) + '</b>.</p>' : '';
  const teams = '<section class="card"><div class="card-h"><h2>Microsoft Teams</h2></div>' + msStatus + '<form class="form" id="f-ms"><div class="fld"><label for="ms-client">ID do aplicativo (cliente)</label><input class="in" id="ms-client" name="clientId" value="' + esc(s.msClientId) + '" placeholder="00000000-0000-0000-0000-000000000000" autocomplete="off" spellcheck="false"><small>Copiado do registro do aplicativo no Microsoft Entra. Não é uma senha.</small></div><div class="fld"><label for="ms-tenant">Diretório</label><input class="in" id="ms-tenant" name="tenant" value="' + esc(s.msTenant) + '" placeholder="organizations" autocomplete="off" spellcheck="false"><small>Use organizations para contas escolares. Se a escola der um ID de diretório, pode usá-lo aqui.</small></div><div class="fld"><span class="lbl">URI de redirecionamento (cadastre exatamente assim, tipo SPA)</span><div class="copy-r"><span class="code">' + esc(redirect) + '</span><button type="button" class="btn sm" data-act="copy" data-text="' + esc(redirect) + '">' + ic('copy', 15) + ' Copiar</button></div>' + (embedded ? '' : '<small>' + (secureContextOk() ? 'HTTPS ok.' : 'Este endereço não é HTTPS e a Microsoft vai recusar.') + ' O Entra diferencia maiúsculas e a barra final.</small>') + '</div><div class="form-a">' + (connected ? '<button type="button" class="btn danger" data-act="ms-disconnect">Desconectar</button>' : '') + '<button class="btn primary" type="submit">Salvar</button></div></form>' + (hasIdSet(s) ? '<div class="set-row" style="margin-top:10px"><div><b>Pedido ao administrador</b><small>Mensagem pronta com o link de consentimento.</small></div><div class="teams-a"><button class="btn sm" data-act="copy-admin-msg">' + ic('copy', 15) + ' Copiar mensagem</button></div></div>' : '') + '</section>';
  const standalone = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;
  const installCard = embedded ? '' : '<section class="card"><div class="card-h"><h2>Instalar no celular</h2></div><p class="muted" style="font-size:13.5px;margin-bottom:12px">' + (standalone ? 'Você já está usando o LIFE DASHBOARD como aplicativo instalado.' : 'Instalado, o app abre em tela cheia, com ícone na tela inicial, e funciona sem internet para consultar o que já foi salvo.') + '</p>' + (standalone ? '' : ui.installEvt ? '<button class="btn primary" data-act="install-app">' + ic('download', 18) + ' Instalar aplicativo</button>' : '<p style="font-size:14px;color:var(--fg-2)">No Chrome do Android: toque no menu ⋮ e escolha <b>Instalar app</b> (ou <b>Adicionar à tela inicial</b>).</p>') + '</section>';
  const guide = '<details class="guide span2" id="guide"' + (ui.guideOpen ? ' open' : '') + '><summary>Passo a passo: publicar o app e conectar o Teams ' + ic('chevR', 18) + '</summary><div class="guide-b">' +
    '<p>O login usa OAuth 2.0 com PKCE. Você entra no site da Microsoft e o app recebe só um token temporário de leitura. A senha nunca passa por aqui.</p>' +
    '<ol><li><b>Publique o app em HTTPS.</b> Descompacte o <span class="code">life-dashboard-hospedagem.zip</span> enviado no chat. No GitHub, crie um repositório público, envie todos os arquivos da pasta, vá em Settings, Pages, escolha Deploy from a branch, branch main, pasta root. O endereço fica <span class="code">https://SEU-USUARIO.github.io/NOME-DO-REPOSITORIO/</span>. Como o repositório é público, o código fica visível, mas ele não tem dados seus nem senha. Seus dados ficam só no seu celular.</li>' +
    '<li><b>Abra esse endereço no Chrome do celular.</b> Em Configurações, o app mostra o URI de redirecionamento exato. Use sempre o mesmo endereço.</li>' +
    '<li><b>Registre o aplicativo.</b> Em entra.microsoft.com, vá em Identidade, Aplicativos, Registros de aplicativo, Novo registro. Nome: Life Dashboard. Tipos de conta: <b>contas em qualquer diretório organizacional (multilocatário)</b>.</li>' +
    '<li><b>Redirecionamento.</b> Em Autenticação, adicione a plataforma <b>Aplicativo de página única (SPA)</b> e cole o URI do passo 2, igual, com maiúsculas e barra final. Nunca use a plataforma Web.</li>' +
    '<li><b>Permissões.</b> Em Permissões de API, adicione Microsoft Graph, <b>permissões delegadas</b>, e marque as três da tabela abaixo. Não precisa clicar em conceder consentimento do administrador se você não for o administrador.</li>' +
    '<li><b>Cole o ID.</b> Copie o ID do aplicativo (cliente) da Visão geral do registro e cole em Configurações ou no cartão da Escola. Para já vir preenchido para sempre, coloque-o também no arquivo <span class="code">config.js</span> e publique de novo.</li>' +
    '<li><b>Consentimento do administrador.</b> As permissões de educação exigem administrador (a Microsoft marca "Admin consent required: Yes"). Toque em <b>Preciso da autorização da escola</b> no cartão da Escola, copie a mensagem e envie ao responsável pelo Microsoft 365 da escola. Quando ele aprovar, toque em Conectar Microsoft Teams.</li>' +
    '<li><b>Conecte.</b> Toque em Conectar Microsoft Teams, entre com a conta da escola e aceite. O app volta sozinho e importa turmas, tarefas e prazos.</li></ol>' +
    '<div class="tbl"><table><thead><tr><th>Permissão</th><th>Para que serve</th><th>Consentimento</th></tr></thead><tbody><tr><td><span class="code">User.Read</span></td><td>Mostrar o nome da conta conectada</td><td>O próprio usuário</td></tr><tr><td><span class="code">EduRoster.ReadBasic</span></td><td>Listar suas turmas e disciplinas</td><td><b>Exige administrador</b></td></tr><tr><td><span class="code">EduAssignments.ReadBasic</span></td><td>Ler tarefas, prazos e se você já entregou, sem notas</td><td><b>Exige administrador</b></td></tr><tr><td><span class="code">openid profile offline_access</span></td><td>Identificar a conta e renovar a sessão</td><td>Padrão</td></tr></tbody></table></div>' +
    '<p><b>O que depende da escola.</b> (1) O consentimento do administrador, sem o qual nada é lido. (2) Regras de acesso condicional, que podem bloquear o login. (3) A configuração do diretório que desliga o registro de aplicativos por usuários: se estiver desligada, o registro do passo 3 pode ser feito em outro diretório do Entra, desde que multilocatário, mas o consentimento da escola continua necessário. Sem a autorização, a alternativa é cadastrar as atividades manualmente.</p>' +
    '<p><b>Sessão.</b> O token fica só neste aparelho, nunca em backups, links ou na tela. O token de renovação de aplicativos de página única vale 24 horas: depois disso o app pede para reconectar, normalmente com um toque. Só funcionam contas escolares ou de trabalho, de turmas do Teams for Education.</p>' +
    '<p><b>Situação.</b> Endereços, permissões e campos conferem com a documentação da Microsoft, e o fluxo foi testado contra uma Microsoft simulada. Ele ainda não foi testado com uma conta escolar real. Qualquer erro aparece em vermelho no cartão da Escola, com o que fazer.</p></div></details>';
  const data = '<section class="card"><div class="card-h"><h2>Seus dados</h2></div><p class="muted" style="font-size:13.5px;margin-bottom:6px">' + (ui.storageOk ? 'Tudo fica salvo neste navegador, neste aparelho. Para levar para outro aparelho ou guardar um backup, exporte um arquivo JSON.' : 'Este navegador não permite salvar dados. Exporte um backup antes de fechar.') + (s.lastBackupAt ? ' Último backup: ' + fmtShort(ymd(new Date(s.lastBackupAt))) + '.' : ' Nenhum backup feito ainda.') + '</p>' +
    '<div class="set-row"><div><b>Exportar</b><small>Gera um arquivo JSON com tudo.</small></div><button class="btn" data-act="export">' + ic('download', 18) + ' Exportar dados</button></div>' +
    '<div class="set-row"><div><b>Importar</b><small>Restaura de um arquivo JSON exportado antes.</small></div><button class="btn" data-act="import">' + ic('upload', 18) + ' Importar dados</button></div>' +
    (hasDemo(db) ? '<div class="set-row"><div><b>Dados de exemplo</b><small>Remove só o que tem a etiqueta Exemplo.</small></div><button class="btn" data-act="clear-demo">Remover exemplos</button></div>' : '') +
    '<div class="set-row"><div><b>Apagar tudo</b><small>Remove todos os dados deste navegador. Não tem volta.</small></div><button class="btn danger" data-act="wipe">' + ic('trash', 18) + ' Apagar tudo</button></div></section>';
  return '<div class="stack-v">' + pageHead('Configurações', 'Aparência, metas, integração com o Teams e seus dados.', '') + storageBanner() + '<div class="set-g">' + appearance + teams + installCard + guide + data + '</div></div>';
}

function hasIdSet(s) { return /^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(s.msClientId || ''); }

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

