const fs = require('fs'), vm = require('vm'), assert = require('assert');
const src = fs.readFileSync(require('path').join(__dirname, '..', 'logic.js'), 'utf8');
const ctx = vm.createContext({ console, crypto: require('crypto').webcrypto });
vm.runInContext(src + `
;this.api = { defaultDB, dueBucket, effStatus, dueInfo, gymSummary, taskBucket, buildNotifications, schoolSummary, routineSummary, nextAppointment, monthMatrix, weekDays, mergeTeams, seedDemo, removeDemo, hasDemo, normalizeDB, sortByUrgency, weeklySeries, monthlySeries, productivitySeries, dayEvents, onTimeRate, ymd, toLocalISO, setNow:(d)=>{ _nowFn=()=>d; } };`, ctx);
const L = ctx.api;
// quinta 12/11/2026 15:00
const N = new Date(2026, 10, 12, 15, 0);
L.setNow(N);
let ok = 0; const t = (name, fn) => { try { fn(); ok++; } catch (e) { console.log('FALHOU:', name, '\n   ', e.message); process.exitCode = 1; } };
const A = (due, status) => ({ id: 'a', title: 'x', dueAt: due, status: status || 'pendente' });

t('bucket atrasada (ontem)', () => assert.equal(L.dueBucket(A('2026-11-11T23:59'), N), 'atrasada'));
t('bucket atrasada (hoje, hora passada)', () => assert.equal(L.dueBucket(A('2026-11-12T10:00'), N), 'atrasada'));
t('bucket hoje (hoje, hora futura)', () => assert.equal(L.dueBucket(A('2026-11-12T18:00'), N), 'hoje'));
t('bucket hoje (data sem hora = fim do dia)', () => assert.equal(L.dueBucket(A('2026-11-12'), N), 'hoje'));
t('bucket amanhã', () => assert.equal(L.dueBucket(A('2026-11-13T08:00'), N), 'amanha'));
t('bucket semana (+7)', () => assert.equal(L.dueBucket(A('2026-11-19T08:00'), N), 'semana'));
t('bucket depois (+8)', () => assert.equal(L.dueBucket(A('2026-11-20T08:00'), N), 'depois'));
t('bucket sem prazo', () => assert.equal(L.dueBucket(A(''), N), 'sem-prazo'));
t('concluída nunca atrasa', () => assert.equal(L.effStatus(A('2020-01-01', 'concluida'), N), 'concluida'));
t('em andamento vencida vira atrasada', () => assert.equal(L.effStatus(A('2020-01-01', 'andamento'), N), 'atrasada'));
t('dueInfo amanhã', () => assert.equal(L.dueInfo(A('2026-11-13T09:00'), N).text, 'Amanhã às 09:00'));
t('dueInfo atrasada há 3 dias', () => assert.equal(L.dueInfo(A('2026-11-09T23:59'), N).text, 'Venceu há 3 dias'));

// ordem de urgência
t('ordenação por urgência', () => {
  const list = [A('2026-11-30'), A('2026-11-13T10:00'), A('2026-11-08'), A('2026-11-12T20:00'), { ...A('2026-11-01', 'concluida') }].map((x, i) => ({ ...x, id: 'i' + i, title: 't' + i }));
  const ord = L.sortByUrgency(list, N).map(x => x.id).join(',');
  assert.equal(ord, 'i2,i3,i1,i0,i4');
});

// semana de academia (segunda a domingo). 12/11/2026 é quinta.
t('semana segunda-domingo', () => { const d = L.weekDays(N, 1); assert.equal(d[0], '2026-11-09'); assert.equal(d[6], '2026-11-15'); });
t('semana domingo-sábado', () => { const d = L.weekDays(N, 0); assert.equal(d[0], '2026-11-08'); assert.equal(d[6], '2026-11-14'); });
t('gymSummary conta DIAS, não registros', () => {
  const db = L.defaultDB();
  const W = (date, kind) => db.workouts.push({ id: date + kind + Math.random(), date, kind, muscles: [] });
  W('2026-11-09', 'treino'); W('2026-11-09', 'treino'); W('2026-11-11', 'treino'); W('2026-11-10', 'descanso'); W('2026-11-13', 'programado'); W('2026-11-08', 'treino');
  const g = L.gymSummary(db, N);
  assert.equal(g.week, 2); assert.equal(g.goal, 4); assert.equal(g.pct, 50); assert.equal(g.left, 2);
  assert.equal(g.total, 4); assert.equal(g.month, 3);
  assert.deepEqual(g.weekDays.map(d => d.state), ['ok', 'rest', 'ok', 'none', 'plan', 'future', 'future']);
  assert.equal(g.daysLeft, 4);
});
t('meta configurável', () => { const db = L.defaultDB(); db.settings.weeklyGoal = 3; db.workouts.push({ id: 'a', date: '2026-11-10', kind: 'treino', muscles: [] }); assert.equal(L.gymSummary(db, N).pct, 33); });
t('média semanal', () => {
  const db = L.defaultDB(); ['2026-10-26', '2026-10-27', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-09'].forEach((d, i) => db.workouts.push({ id: 'w' + i, date: d, kind: 'treino', muscles: [] }));
  assert.equal(L.gymSummary(db, N).avg, 2); // 6 dias em 3 semanas
});
t('séries semanais terminam na semana atual', () => { const s = L.weeklySeries(L.defaultDB(), N, 12); assert.equal(s.length, 12); assert.equal(s[11].current, true); assert.equal(s[11].start, '2026-11-09'); });

// tarefas
t('buckets de tarefas', () => {
  const T = (date, done) => ({ id: 'x', title: 't', date, done: !!done });
  assert.equal(L.taskBucket(T('2026-11-11'), N, 1), 'atrasadas');
  assert.equal(L.taskBucket(T('2026-11-12'), N, 1), 'hoje');
  assert.equal(L.taskBucket(T('2026-11-13'), N, 1), 'amanha');
  assert.equal(L.taskBucket(T('2026-11-15'), N, 1), 'semana');
  assert.equal(L.taskBucket(T('2026-11-16'), N, 1), 'proximos');
  assert.equal(L.taskBucket(T(''), N, 1), 'sem-data');
  assert.equal(L.taskBucket(T('2026-11-12', true), N, 1), 'concluidas');
});
t('rotina: concluídas e restantes de hoje', () => {
  const db = L.defaultDB(); const iso = (h) => new Date(2026, 10, 12, h, 0).toISOString();
  db.tasks.push({ id: '1', date: '2026-11-12', done: true, doneAt: iso(9) }, { id: '2', date: '2026-11-12', done: false }, { id: '3', date: '2026-11-12', done: false }, { id: '4', date: '2026-11-10', done: false }, { id: '5', date: '2026-11-05', done: true, doneAt: new Date(2026, 10, 5, 9).toISOString() });
  const r = L.routineSummary(db, N); assert.equal(r.doneToday, 1); assert.equal(r.remainingToday, 2); assert.equal(r.late, 1);
});
t('próximo compromisso: tarefa e treino programado', () => {
  const db = L.defaultDB();
  db.tasks.push({ id: 'c1', category: 'compromissos', date: '2026-11-14', time: '10:00', title: 'Dentista', done: false });
  db.workouts.push({ id: 'w1', kind: 'programado', date: '2026-11-13', time: '18:30', muscles: ['Pernas'] });
  db.tasks.push({ id: 'c0', category: 'compromissos', date: '2026-11-12', time: '09:00', title: 'Passou', done: false });
  const n = L.nextAppointment(db, N); assert.equal(n.id, 'w1'); assert.equal(n.kind, 'treino');
});

// notificações
t('notificações cobrem os exemplos do pedido', () => {
  const db = L.defaultDB();
  db.assignments.push({ id: 'a1', title: 'Atrasada', dueAt: '2026-11-10T23:59', status: 'pendente' }, { id: 'a2', title: 'Amanhã', dueAt: '2026-11-13T12:00', status: 'pendente' });
  db.tasks.push({ id: 't1', title: 'Hoje 1', date: '2026-11-12', done: false }, { id: 't2', title: 'Hoje 2', date: '2026-11-12', done: false });
  const txt = L.buildNotifications(db, N).map(x => x.title).join(' | ');
  assert.match(txt, /atividade escolar está atrasada/); assert.match(txt, /atividade escolar com prazo amanhã/);
  assert.match(txt, /Existem 2 tarefas pendentes para hoje/); assert.match(txt, /ainda não atingiu sua meta semanal/);
});
t('meta atingida troca a notificação', () => {
  const db = L.defaultDB(); db.settings.weeklyGoal = 1; db.workouts.push({ id: 'w', date: '2026-11-10', kind: 'treino', muscles: [] });
  const txt = L.buildNotifications(db, N).map(x => x.title).join('|'); assert.match(txt, /Meta semanal de academia atingida/); assert.doesNotMatch(txt, /ainda não atingiu/);
});

// calendário
t('matriz do mês tem 5 ou 6 semanas e cobre o mês', () => {
  const m = L.monthMatrix(2026, 10, 1); assert.ok(m.length >= 5 && m.length <= 6); assert.equal(m[0][0].date, '2026-10-26'); assert.equal(m.flat().filter(c => c.inMonth).length, 30);
});
t('eventos do dia juntam as três camadas', () => {
  const db = L.defaultDB();
  db.assignments.push({ id: 'a', title: 'Prova', dueAt: '2026-11-13T08:00', status: 'pendente' });
  db.workouts.push({ id: 'w', kind: 'treino', date: '2026-11-13', muscles: ['Peito'] }); db.tasks.push({ id: 't', title: 'Algo', date: '2026-11-13', category: 'pessoal' });
  assert.equal(L.dayEvents(db, '2026-11-13', null, N).length, 3);
  assert.equal(L.dayEvents(db, '2026-11-13', { escola: true, academia: false, tarefas: false }, N).length, 1);
});

// sincronização Teams
t('mergeTeams: cria, atualiza, marca entregue e preserva edição de status', () => {
  const db = L.defaultDB();
  const p = () => ({ subjects: [{ id: 'teams-c1', name: 'Matemática' }], assignments: [{ id: 'teams-a1', subjectId: 'teams-c1', title: 'Lista', description: '', teacher: 'Prof', publishedAt: '2026-11-01T10:00', dueAt: '2026-11-20T23:59', url: 'https://teams.microsoft.com/x', submitted: false }, { id: 'teams-a2', subjectId: 'teams-c1', title: 'Redação', dueAt: '2026-11-05T23:59', url: '', submitted: true, submittedAt: '2026-11-04T10:00:00Z' }] });
  let r = L.mergeTeams(db, p(), N); assert.equal(r.added, 2); assert.equal(db.assignments.find(a => a.id === 'teams-a2').status, 'concluida'); assert.equal(db.assignments.find(a => a.id === 'teams-a2').doneBy, 'teams');
  const a1 = db.assignments.find(a => a.id === 'teams-a1'); a1.status = 'andamento';
  r = L.mergeTeams(db, p(), N); assert.equal(r.added, 0); assert.equal(r.updated, 2); assert.equal(a1.status, 'andamento'); assert.equal(db.subjects.length, 1);
  const q = p(); q.assignments[0].submitted = true; L.mergeTeams(db, q, N); assert.equal(a1.status, 'concluida');
});

// dados de exemplo
t('exemplos sempre marcados e removíveis sem tocar no que é do usuário', () => {
  const db = L.defaultDB(); L.seedDemo(db, N);
  assert.ok(db.assignments.length && db.workouts.length && db.tasks.length);
  assert.ok(['subjects', 'assignments', 'workouts', 'tasks'].every(k => db[k].every(x => x.demo === true)));
  db.tasks.push({ id: 'meu', title: 'Meu', date: '', done: false, demo: false });
  const kept = db.assignments[0]; kept.demo = false; // usuário editou um exemplo
  L.removeDemo(db);
  assert.equal(db.tasks.length, 1); assert.equal(db.assignments.length, 1); assert.ok(db.subjects.some(s => s.id === kept.subjectId)); assert.equal(db.workouts.length, 0); assert.equal(L.hasDemo(db), false);
});
t('mergeTeams: remove o que o professor apagou, só nas turmas lidas, e nunca as tarefas manuais', () => {
  const db = L.defaultDB(); const mk = (id, sid) => ({ id, subjectId: sid, title: id, description: '', teacher: '', publishedAt: '', dueAt: '2026-12-01T10:00', url: '', submitted: null, submittedAt: null });
  const pay = (ids, synced) => ({ subjects: [{ id: 'teams-c1', name: 'A', teacher: '' }, { id: 'teams-c2', name: 'B', teacher: '' }], assignments: ids.map(i => mk(i, i.startsWith('teams-x') ? 'teams-c1' : 'teams-y' + '' === i ? 'teams-c2' : (i.startsWith('teams-y') ? 'teams-c2' : 'teams-c1'))), syncedSubjectIds: synced });
  L.mergeTeams(db, pay(['teams-x1', 'teams-x2', 'teams-y1'], ['teams-c1', 'teams-c2']), N); assert.equal(db.assignments.length, 3);
  db.assignments.push({ id: 'meu', title: 'Manual', subjectId: 'teams-c1', status: 'pendente', source: 'manual' });
  let r = L.mergeTeams(db, pay(['teams-x1', 'teams-y1'], ['teams-c1', 'teams-c2']), N); assert.equal(r.removed, 1); assert.ok(!db.assignments.some(a => a.id === 'teams-x2')); assert.ok(db.assignments.some(a => a.id === 'meu'));
  r = L.mergeTeams(db, pay(['teams-x1'], ['teams-c1']), N); assert.equal(r.removed, 0, 'turma c2 não foi lida: não pode apagar y1'); assert.ok(db.assignments.some(a => a.id === 'teams-y1'));
  r = L.mergeTeams(db, pay([], ['teams-c1', 'teams-c2']), N); assert.equal(r.removed, 0, 'resposta totalmente vazia nunca apaga'); assert.equal(db.assignments.filter(a => a.source === 'teams').length, 2);
});
t('seed: números do exemplo fecham com a regra', () => {
  const db = L.defaultDB(); L.seedDemo(db, N);
  const s = L.schoolSummary(db, N); assert.ok(s.open > 0 && s.late >= 1 && s.soon >= 1);
  const g = L.gymSummary(db, N); assert.ok(g.total > 5);
});
t('normalizeDB tolera lixo', () => { const d = L.normalizeDB({ tasks: [{ id: 'a' }, null, 5, { noid: 1 }], settings: 'x' }); assert.equal(d.tasks.length, 1); assert.equal(d.settings.weeklyGoal, 4); assert.ok(Array.isArray(L.normalizeDB(null).assignments)); });
t('toLocalISO converte UTC para horário local', () => { const out = L.toLocalISO('2026-11-13T02:30:00Z'); assert.match(out, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/); });
console.log(ok + ' verificações passaram' + (process.exitCode ? ' (há falhas acima)' : ''));
