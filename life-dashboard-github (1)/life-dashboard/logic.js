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
