const OUT = process.env.OUT || 'dist';
const { chromium } = require('playwright');
const assert = require('assert');
const APP = process.env.APP || 'http://127.0.0.1:8765/' + OUT + '/index.html';
const LOCAL = r => /^http:\/\/127\.0\.0\.1:8765\//.test(r.request().url()) ? r.continue() : r.abort();
const results = []; let failed = 0;
let PG = null; const step = async (name, fn) => { try { await fn(); results.push('ok   ' + name); console.log('ok   ' + name); } catch (e) { failed++; let extra = ''; try { extra = ' | modal=' + JSON.stringify(await PG.evaluate(() => ui.modal && ui.modal.type)) + ' rota=' + await PG.evaluate(() => ui.route); } catch (_) { } results.push('FALHA ' + name); console.log('FALHA ' + name + '\n       ' + String(e.message).split('\n')[0] + extra); } };

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
  await ctx.route(/^https?:/, LOCAL);
  const page = await ctx.newPage(); PG = page; page.setDefaultTimeout(6000);
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/ERR_FAILED|net::/.test(m.text())) errors.push('console: ' + m.text()); });
  await page.goto(APP);
  await page.waitForSelector('#view');
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const txt = sel => page.locator(sel).first().innerText();
  const modal = () => page.locator('#modal-root .modal');

  await step('abre na visão geral com saudação, data e relógio', async () => {
    assert.match(await txt('.hero h1'), /^(Bom dia|Boa tarde|Boa noite|Boa madrugada)/);
    assert.match(await txt('.hero .date'), /\d{4}/);
    assert.match(await txt('#clock'), /\d{2}:\d{2}/);
  });
  await step('visão geral: números batem com os dados reais', async () => {
    const d = await ev(() => { const n = now(), s = schoolSummary(db, n), g = gymSummary(db, n), r = routineSummary(db, n); return { open: s.open, soon: s.soon, late: s.late, week: g.week, goal: g.goal, pct: g.pct, rem: r.remainingToday, done: r.doneToday }; });
    const t = (await page.locator('.ov').innerText()).replace(/\s+/g, ' ');
    assert.ok(new RegExp('\\b' + d.open + ' atividades? pendentes?', 'i').test(t), 'pendentes ' + d.open);
    assert.ok(t.includes('Progresso: ' + d.pct + '%'), 'progresso ' + d.pct);
    assert.ok(t.includes('Meta semanal: ' + d.goal), 'meta');
    assert.ok(new RegExp(d.rem + ' tarefas? restantes?', 'i').test(t), 'restantes ' + d.rem);
    assert.ok(t.includes(d.soon + ' próximas do prazo') || t.includes(d.soon + ' próxima do prazo'), 'próximas ' + d.soon);
    assert.ok(t.includes(d.late + ' atrasada'), 'atrasadas');
  });
  await step('dados de exemplo estão etiquetados e há aviso', async () => {
    assert.ok(await page.locator('.banner', { hasText: 'Dados de exemplo' }).count());
    assert.ok(await page.locator('.pill.ex').count() > 3);
  });
  await step('navegação lateral leva às 7 seções', async () => {
    for (const [r, h] of [['escola', 'Escola'], ['academia', 'Academia'], ['calendario', 'Calendário'], ['tarefas', 'Minhas tarefas'], ['estatisticas', 'Estatísticas'], ['configuracoes', 'Configurações'], ['visao-geral', null]]) {
      await page.click('.nav a[data-route="' + r + '"]');
      if (h) assert.equal(await txt('#view h1'), h);
      assert.equal(await ev(() => ui.route), r);
      assert.equal(await page.locator('.nav a[aria-current="page"]').getAttribute('data-route'), r);
    }
  });

  /* ---------- tarefas ---------- */
  await page.click('.nav a[data-route="tarefas"]');
  await step('tarefa rápida: Enter adiciona para hoje e persiste', async () => {
    const before = await ev(() => db.tasks.length);
    await page.fill('#quick-task', 'Estudar química orgânica'); await page.press('#quick-task', 'Enter');
    assert.equal(await ev(() => db.tasks.length), before + 1);
    assert.ok(await page.locator('#view', { hasText: 'Estudar química orgânica' }).count());
    assert.equal(await ev(() => document.activeElement.id), 'quick-task');
    await page.reload(); await page.waitForSelector('#view'); await page.click('.nav a[data-route="tarefas"]');
    assert.ok(await page.locator('#view', { hasText: 'Estudar química orgânica' }).count(), 'sumiu após recarregar');
  });
  await step('nova tarefa completa (modal), com prioridade e categoria', async () => {
    await page.click('.ph-actions [data-act="new-task"]');
    await modal().waitFor();
    await page.fill('#t-title', 'Reunião com orientador'); await page.fill('#t-date', await ev(() => ymd(addDays(now(), 1)))); await page.fill('#t-time', '14:30');
    await modal().locator('label.cb', { hasText: 'Alta' }).click(); await modal().locator('label.cb', { hasText: 'Compromissos' }).click();
    await page.fill('#t-desc', 'Levar o rascunho');
    await page.click('#modal-root button[type=submit]');
    const t = await ev(() => db.tasks.find(x => x.title === 'Reunião com orientador'));
    assert.equal(t.priority, 'alta'); assert.equal(t.category, 'compromissos'); assert.equal(t.time, '14:30'); assert.equal(await modal().count(), 0);
    assert.ok(await page.locator('.grp-h', { hasText: 'Amanhã' }).count());
  });
  await step('validação: título vazio mostra erro e não salva', async () => {
    const before = await ev(() => db.tasks.length);
    await page.click('.ph-actions [data-act="new-task"]'); await page.fill('#t-title', ''); await page.click('#modal-root button[type=submit]');
    assert.match(await txt('#form-err'), /título/i); assert.equal(await ev(() => db.tasks.length), before);
    await page.keyboard.press('Escape'); assert.equal(await modal().count(), 0);
  });
  await step('concluir e desfazer', async () => {
    const id = await ev(() => db.tasks.find(x => x.title === 'Estudar química orgânica').id);
    await page.click('[data-act="toggle-task"][data-id="' + id + '"]');
    assert.equal(await ev((i) => db.tasks.find(x => x.id === i).done, id), true);
    assert.ok(await page.locator('.grp-h', { hasText: 'Concluídas' }).count());
    await page.click('[data-act="toast-undo"]');
    assert.equal(await ev((i) => db.tasks.find(x => x.id === i).done, id), false);
  });
  await step('filtro por categoria', async () => {
    await page.click('[data-act="task-cat"][data-cat="compromissos"]');
    const n = await page.locator('#view .li').count(); const real = await ev(() => db.tasks.filter(t => t.category === 'compromissos').length);
    assert.equal(n, real); await page.click('[data-act="task-cat"][data-cat="all"]');
  });
  await step('editar e excluir (com confirmação)', async () => {
    const id = await ev(() => db.tasks.find(x => x.title === 'Reunião com orientador').id);
    await page.click('[data-act="edit-task"][data-id="' + id + '"]'); await page.fill('#t-title', 'Reunião com a coordenação'); await page.click('#modal-root button[type=submit]');
    assert.equal(await ev((i) => db.tasks.find(x => x.id === i).title, id), 'Reunião com a coordenação');
    await page.click('[data-act="del-task"][data-id="' + id + '"]'); await modal().waitFor();
    await page.click('[data-act="confirm-no"]'); assert.equal(await ev((i) => !!db.tasks.find(x => x.id === i), id), true);
    await page.click('[data-act="del-task"][data-id="' + id + '"]'); await page.click('[data-act="confirm-yes"]');
    assert.equal(await ev((i) => !!db.tasks.find(x => x.id === i), id), false);
  });

  /* ---------- escola ---------- */
  await page.click('.nav a[data-route="escola"]');
  await step('escola: grupos por urgência na ordem certa', async () => {
    const heads = await page.locator('#school-list .grp-h').allInnerTexts();
    const order = ['Atrasadas', 'Vencem hoje', 'Vencem amanhã', 'Próximos 7 dias', 'Mais adiante'];
    const idx = heads.map(h => order.findIndex(o => h.toLowerCase().startsWith(o.toLowerCase()))).filter(i => i >= 0);
    assert.deepEqual(idx, idx.slice().sort((a, b) => a - b)); assert.ok(idx.length >= 3);
  });
  await step('escola: contadores de prazo = dados', async () => {
    const s = await ev(() => schoolSummary(db, now()));
    const txt = await page.locator('.dl-g').innerText();
    for (const [lbl, v] of [['Atrasadas', s.late], ['Vencem hoje', s.today], ['Vencem amanhã', s.tomorrow], ['Próximos 7 dias', s.week]]) assert.ok(new RegExp(v + '\\s*\\n?\\s*' + lbl).test(txt.replace(/\n+/g, '\n')), lbl + ' ' + v);
  });
  await step('escola: card Teams explica o que falta (sem fingir conexão)', async () => {
    const t = await page.locator('.teams-b').innerText(); assert.match(t, /ID do aplicativo|Entra/i);
    assert.equal(await page.locator('[data-act="sync-teams"]').count(), 0);
  });
  await step('nova atividade com matéria nova, prazo amanhã', async () => {
    await page.click('.ph-actions [data-act="new-assignment"]'); await modal().waitFor();
    await page.fill('#a-title', 'Trabalho de Geografia');
    await page.selectOption('#a-subject', '__new__'); assert.equal(await page.locator('#a-newsub').isHidden(), false);
    await page.fill('#a-newname', 'Geografia');
    await page.fill('#a-due', await ev(() => ymd(addDays(now(), 1)))); await page.fill('#a-duetime', '10:00');
    await page.fill('#a-teacher', 'Prof. Rocha'); await page.fill('#a-desc', 'Mapa do Brasil'); await page.fill('#a-url', 'https://teams.microsoft.com/l/x');
    await modal().locator('label.cb', { hasText: 'Em andamento' }).click();
    await page.click('#modal-root button[type=submit]');
    const a = await ev(() => db.assignments.find(x => x.title === 'Trabalho de Geografia'));
    assert.equal(a.status, 'andamento'); assert.equal(a.teacher, 'Prof. Rocha'); assert.ok(a.dueAt.endsWith('T10:00'));
    assert.ok(await ev(() => db.subjects.some(s => s.name === 'Geografia')));
    const row = page.locator('#school-list .li', { hasText: 'Trabalho de Geografia' });
    assert.match(await row.innerText(), /Amanhã às 10:00/); assert.match(await row.innerText(), /Em andamento/);
    assert.equal(await row.locator('a[target=_blank]').getAttribute('href'), 'https://teams.microsoft.com/l/x');
  });
  await step('link inválido é recusado', async () => {
    await page.click('.ph-actions [data-act="new-assignment"]'); await page.fill('#a-title', 'X'); await page.selectOption('#a-subject', ''); await page.fill('#a-url', 'javascript:alert(1)'); await page.click('#modal-root button[type=submit]');
    assert.match(await txt('#form-err'), /http/); await page.keyboard.press('Escape');
  });
  await step('filtros: busca, matéria, status, bucket', async () => {
    await page.fill('#school-q', 'geografia'); assert.equal(await page.locator('#school-list .li').count(), 1);
    await page.fill('#school-q', '');
    const sid = await ev(() => db.subjects.find(s => s.name === 'Geografia').id); await page.selectOption('#school-subject', sid); assert.equal(await page.locator('#school-list .li').count(), 1);
    await page.selectOption('#school-subject', 'all');
    await page.click('[data-act="school-bucket"][data-bucket="atrasada"]');
    const late = await ev(() => schoolSummary(db, now()).late); assert.equal(await page.locator('#school-list .li').count(), late);
    await page.click('[data-act="school-bucket"][data-bucket="atrasada"]');
    await page.click('[data-act="school-status"][data-status="concluida"]');
    assert.equal(await page.locator('#school-list .li').count(), await ev(() => db.assignments.filter(a => a.status === 'concluida').length));
    await page.click('[data-act="school-status"][data-status="aberto"]');
  });
  await step('visão por matéria', async () => {
    await page.click('[data-act="school-view"][data-view="materia"]'); assert.ok(await page.locator('.sub-card').count() >= 3);
    await page.click('[data-act="school-view"][data-view="lista"]');
  });
  await step('concluir atividade, desfazer e reabrir', async () => {
    const id = await ev(() => db.assignments.find(x => x.title === 'Trabalho de Geografia').id);
    await page.click('#school-list [data-act="toggle-assignment"][data-id="' + id + '"]');
    assert.equal(await ev((i) => db.assignments.find(x => x.id === i).status, id), 'concluida'); assert.ok(await ev((i) => !!db.assignments.find(x => x.id === i).completedAt, id));
    await page.click('[data-act="toast-undo"]'); assert.equal(await ev((i) => db.assignments.find(x => x.id === i).status, id), 'andamento');
    await page.click('#school-list [data-act="progress-assignment"][data-id="' + id + '"]'); assert.equal(await ev((i) => db.assignments.find(x => x.id === i).status, id), 'pendente');
  });
  await step('gerenciar matérias: renomear e excluir', async () => {
    await page.click('[data-act="manage-subjects"]'); await modal().waitFor();
    const sid = await ev(() => db.subjects.find(s => s.name === 'Geografia').id);
    await page.click('[data-act="subject-edit"][data-id="' + sid + '"]'); await page.fill('#s-name', 'Geografia Humana'); await page.click('#modal-root button[type=submit]');
    assert.equal(await ev((i) => db.subjects.find(s => s.id === i).name, sid), 'Geografia Humana'); assert.ok(await modal().innerText().then(t => t.includes('Geografia Humana')));
    await page.click('[data-act="subject-del"][data-id="' + sid + '"]'); await page.click('[data-act="confirm-yes"]');
    assert.equal(await ev((i) => !!db.subjects.find(s => s.id === i), sid), false);
    assert.equal(await ev(() => db.assignments.find(x => x.title === 'Trabalho de Geografia').subjectId), '');
    await page.keyboard.press('Escape');
  });
  await step('excluir atividade', async () => {
    const id = await ev(() => db.assignments.find(x => x.title === 'Trabalho de Geografia').id);
    await page.click('[data-act="edit-assignment"][data-id="' + id + '"]'); await page.click('#modal-root [data-act="del-assignment"]'); await page.click('[data-act="confirm-yes"]');
    assert.equal(await ev(() => db.assignments.some(x => x.title === 'Trabalho de Geografia')), false);
  });

  /* ---------- academia ---------- */
  await page.click('.nav a[data-route="academia"]');
  await step('academia: cartões e estatísticas = dados', async () => {
    const g = await ev(() => gymSummary(db, now())); const t = (await page.locator('.stat-g').innerText()).replace(/\n+/g, ' ');
    assert.ok(t.includes(g.week + ' Dias treinados nesta semana')); assert.ok(t.includes(g.month + ' Dias treinados neste mês')); assert.ok(t.includes(g.total + ' Total de treinos'));
  });
  await step('calendário de academia: 4 estados visuais existem', async () => {
    const cls = await page.locator('.gday').evaluateAll(els => [...new Set(els.flatMap(e => [...e.classList]).filter(c => c.startsWith('g-')))]);
    for (const c of ['g-ok', 'g-none', 'g-plan', 'g-rest']) assert.ok(cls.includes(c), 'falta ' + c + ' em ' + cls);
  });
  await step('registrar treino clicando num dia sem registro', async () => {
    const date = await ev(() => { const t = ymd(now()); for (let k = 1; k < 30; k++) { const d = ymd(addDays(now(), -k)); if (d.slice(0, 7) === t.slice(0, 7) && dayGymState(db, d, now()) === 'none') return d; } return ymd(now()); });
    const before = await ev(() => gymSummary(db, now()).month);
    await page.click('.gday[data-date="' + date + '"]'); await modal().waitFor();
    await page.click('#modal-root [data-act="new-workout"][data-kind="treino"]');
    await page.fill('#w-time', '19:00'); await modal().locator('label.cb', { hasText: 'Peito' }).click(); await modal().locator('label.cb', { hasText: 'Tríceps' }).click();
    await page.selectOption('#w-type', 'Musculação'); await page.fill('#w-dur', '55'); await page.fill('#w-notes', 'Supino 4x8');
    await page.click('#modal-root button[type=submit]');
    const w = await ev((d) => db.workouts.find(x => x.date === d && !x.demo), date);
    assert.deepEqual(w.muscles, ['Peito', 'Tríceps']); assert.equal(w.duration, 55); assert.equal(w.kind, 'treino');
    assert.ok((await page.locator('.gday[data-date="' + date + '"]').getAttribute('class')).includes('g-ok'));
    assert.equal(await ev(() => gymSummary(db, now()).month), before + 1);
  });
  await step('treino futuro como "realizado" é recusado', async () => {
    const fut = await ev(() => ymd(addDays(now(), 3)));
    await page.click('.ph-actions [data-act="new-workout"]'); await page.fill('#w-date', fut); await modal().locator('label.cb', { hasText: 'Fui à academia' }).click(); await page.click('#modal-root button[type=submit]');
    assert.match(await txt('#form-err'), /futura/); await page.keyboard.press('Escape');
  });
  await step('descanso esconde campos de treino e salva amarelo', async () => {
    const date = await ev(() => { for (let k = 1; k < 40; k++) { const d = ymd(addDays(now(), -k)); if (dayGymState(db, d, now()) === 'none') return d; } });
    await page.click('.ph-actions [data-act="new-workout"]'); await page.fill('#w-date', date); await modal().locator('label.cb', { hasText: 'Descanso' }).click();
    assert.equal(await page.locator('#w-fields').isHidden(), true); await page.click('#modal-root button[type=submit]');
    assert.equal(await ev((d) => db.workouts.find(x => x.date === d && !x.demo && x.kind === 'descanso').muscles.length, date), 0);
  });
  await step('meta semanal editável muda progresso e persiste', async () => {
    const g0 = await ev(() => db.settings.weeklyGoal); await page.click('.goal-card [data-act="goal-plus"]');
    assert.equal(await ev(() => db.settings.weeklyGoal), g0 + 1); assert.ok((await page.locator('.goal-card').innerText()).includes('/' + (g0 + 1)));
    await page.click('.goal-card [data-act="goal-minus"]'); assert.equal(await ev(() => db.settings.weeklyGoal), g0);
    for (let i = 0; i < 10; i++) await page.click('.goal-card [data-act="goal-minus"]'); assert.equal(await ev(() => db.settings.weeklyGoal), 1);
    for (let i = 0; i < 3; i++) await page.click('.goal-card [data-act="goal-plus"]'); await page.click('.goal-card [data-act="goal-minus"]'); await page.click('.goal-card [data-act="goal-plus"]');
    await page.reload(); await page.waitForSelector('#view'); assert.equal(await ev(() => db.settings.weeklyGoal), 4);
  });
  await step('navegar meses e voltar para hoje', async () => {
    const m0 = await ev(() => ui.gym.month); await page.click('[data-act="gym-prev"]'); assert.notEqual(await ev(() => ui.gym.month), m0);
    await page.click('[data-act="gym-today"]'); assert.equal(await ev(() => ui.gym.month), m0);
  });
  await step('histórico: filtrar, editar, programar, concluir programado, excluir', async () => {
    await page.click('.nav a[data-route="academia"]');
    await page.click('[data-act="gym-kind"][data-kind="descanso"]');
    const nRest = await ev(() => db.workouts.filter(w => w.kind === 'descanso').length); assert.equal(await page.locator('.card.flush .li').count(), Math.min(nRest, 40));
    await page.click('[data-act="gym-kind"][data-kind="all"]');
    const fut = await ev(() => ymd(addDays(now(), 4)));
    await page.click('.ph-actions [data-act="new-workout"]'); await page.fill('#w-date', fut); assert.equal(await page.locator('input[name=kind][value=treino]').isChecked(), true);
    await modal().locator('label.cb', { hasText: 'Programado' }).click(); await modal().locator('label.cb', { hasText: 'Pernas' }).click(); await page.click('#modal-root button[type=submit]');
    const id = await ev((d) => db.workouts.find(w => w.date === d && w.kind === 'programado' && !w.demo).id, fut);
    await page.click('[data-act="complete-workout"][data-id="' + id + '"]');
    const w = await ev((i) => db.workouts.find(x => x.id === i), id); assert.equal(w.kind, 'treino'); assert.equal(w.date, await ev(() => ymd(now())));
    await page.click('[data-act="edit-workout"][data-id="' + id + '"]'); await page.fill('#w-notes', 'ajustado'); await page.click('#modal-root button[type=submit]');
    assert.equal(await ev((i) => db.workouts.find(x => x.id === i).notes, id), 'ajustado');
    await page.click('[data-act="del-workout"][data-id="' + id + '"]'); await page.click('[data-act="confirm-yes"]'); assert.equal(await ev((i) => !!db.workouts.find(x => x.id === i), id), false);
  });

  /* ---------- calendário ---------- */
  await step('abrir calendário', async () => { await page.click('.nav a[data-route="calendario"]'); });
  await step('calendário mensal: clicar no dia mostra as atividades daquele dia', async () => {
    const date = await ev(() => { const a = db.assignments.find(x => x.dueAt && x.status !== 'concluida'); return String(a.dueAt).slice(0, 10); });
    const m = await ev((d) => d.slice(0, 7), date); await ev((m) => { ui.cal.cursor = m + '-01'; render(); }, m);
    await page.click('.day[data-date="' + date + '"]');
    const expected = await ev((d) => dayEvents(db, d, ui.cal.layers, now()).length, date);
    assert.equal(await page.locator('.side-p .li').count(), expected); assert.ok(expected >= 1);
    assert.match(await txt('.side-p h2'), /\d/);
  });
  await step('calendário semanal e navegação', async () => {
    await page.click('[data-act="cal-mode"][data-mode="semana"]'); assert.equal(await page.locator('.wk-d').count(), 7);
    const t0 = await txt('.cal-title'); await page.click('[data-act="cal-next"]'); assert.notEqual(await txt('.cal-title'), t0);
    await page.click('[data-act="cal-today"]'); assert.equal(await txt('.cal-title'), t0); await page.click('[data-act="cal-mode"][data-mode="mes"]');
  });
  await step('camadas do calendário liga e desliga', async () => {
    const all = await page.locator('.cal-g .ev').count(); await page.click('[data-act="cal-layer"][data-layer="academia"]'); await page.click('[data-act="cal-layer"][data-layer="tarefas"]');
    const only = await page.locator('.cal-g .ev').count(); assert.ok(only < all);
    await page.click('[data-act="cal-layer"][data-layer="academia"]'); await page.click('[data-act="cal-layer"][data-layer="tarefas"]');
  });
  await step('adicionar tarefa a partir do dia selecionado', async () => {
    const d = await ev(() => ui.cal.sel); await page.click('.side-p [data-act="new-task"]'); assert.equal(await page.inputValue('#t-date'), d); await page.fill('#t-title', 'Pelo calendário'); await page.click('#modal-root button[type=submit]');
    assert.equal(await ev((d) => db.tasks.find(t => t.title === 'Pelo calendário').date, d), d); assert.ok(await page.locator('.side-p', { hasText: 'Pelo calendário' }).count());
  });

  /* ---------- notificações ---------- */
  await step('central de notificações: lista, abre destino, marca lidas', async () => {
    const n = await ev(() => buildNotifications(db, now()).length); assert.ok(n >= 3);
    await page.click('.side-foot [data-act="bell"]'); await modal().waitFor(); assert.equal(await page.locator('.notif').count(), n);
    const badge = await page.locator('.side-foot .badge').innerText(); assert.equal(+badge, await ev(() => unreadNotifs(now()).length));
    const first = await page.locator('.notif').first().getAttribute('data-id');
    await page.locator('.notif').first().click(); assert.equal(await modal().count(), 0);
    assert.equal(await ev((i) => !!db.readNotifs[i], first), true);
    await page.click('.side-foot [data-act="bell"]'); await page.click('[data-act="notif-readall"]');
    assert.equal(await page.locator('.side-foot .badge').count(), 0); await page.keyboard.press('Escape');
  });

  /* ---------- estatísticas ---------- */
  await page.click('.nav a[data-route="estatisticas"]');
  await step('estatísticas renderizam gráficos', async () => {
    assert.ok(await page.locator('.stk').count() > 3); assert.ok(await page.locator('svg.area path.ln').count() >= 1); assert.ok(await page.locator('.hb-r').count() >= 2);
  });

  /* ---------- configurações e dados ---------- */
  await page.click('.nav a[data-route="configuracoes"]');
  await step('nome, tema, destaque e início da semana', async () => {
    await page.fill('#set-name', 'Ana'); await page.press('#set-name', 'Tab'); assert.equal(await ev(() => db.settings.name), 'Ana');
    await page.click('[data-act="set-theme"][data-v="light"]'); assert.equal(await ev(() => document.documentElement.getAttribute('data-ld-theme')), 'light');
    const bg = await ev(() => getComputedStyle(document.body).backgroundColor); assert.notEqual(bg, 'rgb(8, 8, 12)');
    await page.click('[data-act="set-theme"][data-v="dark"]'); await page.click('[data-act="set-accent"][data-v="blue"]'); assert.equal(await ev(() => document.documentElement.getAttribute('data-ld-accent')), 'blue'); await page.click('[data-act="set-accent"][data-v="violet"]');
    await page.click('[data-act="set-weekstart"][data-v="0"]'); assert.equal(await ev(() => db.settings.weekStart), 0); assert.equal((await page.locator('.dow-r').count()), 0); await page.click('[data-act="set-weekstart"][data-v="1"]');
    await page.click('.nav a[data-route="visao-geral"]'); assert.match(await txt('.hero h1'), /, Ana$/);
  });
  await page.click('.nav a[data-route="configuracoes"]');
  await step('config Teams: valida o ID e guarda', async () => {
    await page.fill('#ms-client', 'abc'); await page.click('#f-ms button[type=submit]'); assert.match(await txt('.toast'), /formato/); assert.equal(await ev(() => db.settings.msClientId), '');
    await page.fill('#ms-client', '11111111-2222-3333-4444-555555555555'); await page.click('#f-ms button[type=submit]'); assert.equal(await ev(() => db.settings.msClientId), '11111111-2222-3333-4444-555555555555');
    assert.equal(await page.locator('.copy-r .code').innerText(), 'http://127.0.0.1:8765/' + OUT + '/'); /* index.html some do URI de redirecionamento */
    assert.ok(await page.locator('[data-act="copy-admin-msg"]').count() > 0);
  });
  await step('guia do Entra lista as permissões exigidas', async () => {
    await page.locator('#guide summary').click(); const t = await page.locator('#guide').innerText();
    for (const p of ['EduRoster.ReadBasic', 'EduAssignments.ReadBasic', 'User.Read', 'Aplicativo de página única']) assert.ok(t.includes(p), p);
    await page.waitForFunction(() => ui.guideOpen === true); await page.click('[data-act="set-theme"][data-v="dark"]'); assert.equal(await page.locator('#guide').getAttribute('open') !== null, true);
  });
  await step('conectar sem sessão real redireciona para a Microsoft com PKCE (sem senha)', async () => {
    const urls = []; page.on('request', r => { if (/login\.microsoftonline\.com/.test(r.url())) urls.push(r.url()); });
    await page.goto(APP + '#escola'); await page.waitForSelector('#view'); await page.click('[data-act="ms-connect"]').catch(() => { });
    await page.waitForTimeout(500);
    const u = urls[0] ? new URL(urls[0]) : null; assert.ok(u, 'não redirecionou');
    assert.equal(u.pathname, '/organizations/oauth2/v2.0/authorize'); const q = u.searchParams;
    assert.equal(q.get('client_id'), '11111111-2222-3333-4444-555555555555'); assert.equal(q.get('code_challenge_method'), 'S256'); assert.ok(q.get('code_challenge').length >= 43); assert.equal(q.get('response_type'), 'code');
    for (const s of ['EduRoster.ReadBasic', 'EduAssignments.ReadBasic']) assert.ok(q.get('scope').includes(s)); assert.ok(!/password|senha/i.test(urls[0]));
  });
  await page.goto(APP + '#configuracoes'); await page.waitForSelector('#view');
  await step('exportar baixa JSON com todos os dados; importar restaura', async () => {
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-act="export"]')]);
    assert.match(dl.suggestedFilename(), /^life-dashboard-\d{4}-\d{2}-\d{2}\.json$/);
    const json = require('fs').readFileSync(await dl.path(), 'utf8'); const o = JSON.parse(json);
    assert.equal(o.app, 'life-dashboard'); assert.ok(o.data.tasks.length > 0 && o.data.assignments.length > 0 && o.data.workouts.length > 0); assert.equal(o.data.settings.msAccount, null);
    assert.ok(await ev(() => !!db.settings.lastBackupAt));
    // altera o app, depois importa o backup e confere que volta
    await ev(() => { db.tasks = []; db.assignments = []; save(); });
    await page.click('[data-act="import"]'); await page.fill('#imp-text', '{ quebrado'); await page.click('[data-act="import-check"]'); assert.match(await txt('#imp-err'), /JSON válido/);
    await page.fill('#imp-text', '{"app":"outro","data":{"tasks":[]}}'); await page.click('[data-act="import-check"]'); assert.match(await txt('#imp-err'), /outro aplicativo/);
    await page.fill('#imp-text', '{"foo":1}'); await page.click('[data-act="import-check"]'); assert.match(await txt('#imp-err'), /não parece/);
    await page.fill('#imp-text', json); await page.click('[data-act="import-check"]'); assert.match(await modal().innerText(), /Pronto para importar/);
    await page.click('[data-act="import-apply"]');
    assert.equal(await ev(() => db.tasks.length), o.data.tasks.length); assert.equal(await ev(() => db.assignments.length), o.data.assignments.length); assert.equal(await ev(() => db.settings.name), 'Ana');
    assert.ok(await ev(() => !!localStorage.getItem('lifedash.v1.antes-de-importar')));
  });
  await step('importar por arquivo (seletor de arquivos)', async () => {
    const f = require('path').join(require('os').tmpdir(), 'lifedash-imp.json');
    require('fs').writeFileSync(f, JSON.stringify({ app: 'life-dashboard', data: { tasks: [{ id: 'z1', title: 'Veio do arquivo', date: '', done: false, category: 'outros', priority: 'baixa' }] } }));
    await page.click('[data-act="import"]'); await page.setInputFiles('#imp-file', f); await page.waitForSelector('[data-act="import-apply"]'); await page.click('[data-act="import-apply"]');
    assert.equal(await ev(() => db.tasks.length), 1); assert.equal(await ev(() => db.tasks[0].title), 'Veio do arquivo');
  });
  await step('remover exemplos preserva o que é do usuário; apagar tudo zera', async () => {
    await page.fill('#set-name', 'Ana'); await page.press('#set-name', 'Tab');
    await ev(() => { seedDemo(db); save(); });
    assert.ok(await ev(() => hasDemo(db))); await page.click('#view [data-act="clear-demo"]'); await page.click('[data-act="confirm-yes"]');
    assert.equal(await ev(() => hasDemo(db)), false); assert.equal(await ev(() => db.tasks.some(t => t.title === 'Veio do arquivo')), true);
    await page.reload(); await page.waitForSelector('#view'); assert.equal(await ev(() => hasDemo(db)), false, 'exemplos voltaram após recarregar');
    await page.click('.nav a[data-route="configuracoes"]'); await page.click('[data-act="wipe"]'); await page.click('[data-act="confirm-yes"]');
    assert.deepEqual(await ev(() => [db.tasks.length, db.assignments.length, db.workouts.length]), [0, 0, 0]);
  });
  await step('estados vazios: todas as telas abrem sem dados', async () => {
    for (const r of ROUTES = ['visao-geral', 'escola', 'academia', 'calendario', 'tarefas', 'estatisticas', 'configuracoes']) { await page.click('.nav a[data-route="' + r + '"]'); assert.ok((await page.locator('#view').innerText()).length > 20); }
    await page.click('.nav a[data-route="visao-geral"]'); const t = (await page.locator('.ov').innerText()).replace(/\s+/g, ' ');
    assert.match(t, /0 atividades pendentes/); assert.match(t, /0 treinos nesta semana/); assert.match(t, /Nenhum compromisso agendado/);
  });
  await step('armazenamento corrompido não apaga em silêncio', async () => {
    await ev(() => localStorage.setItem('lifedash.v1', '{ lixo')); await page.reload(); await page.waitForSelector('#view');
    assert.ok(await ev(() => Object.keys(localStorage).some(k => k.startsWith('lifedash.v1.corrompido-'))));
  });

  /* ---------- celular ---------- */
  await step('celular 390px: barra inferior, sem rolagem horizontal em nenhuma tela', async () => {
    const m = await browser.newContext({ viewport: { width: 390, height: 800 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }); await m.route(/^https?:/, LOCAL);
    const p = await m.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); await p.goto(APP); await p.waitForSelector('#view');
    assert.equal(await p.locator('.side').isVisible(), false); assert.equal(await p.locator('.tabbar').isVisible(), true);
    for (const r of ['visao-geral', 'escola', 'academia', 'calendario', 'tarefas', 'estatisticas', 'configuracoes']) {
      await p.evaluate((r) => go(r), r); await p.waitForTimeout(60);
      const sw = await p.evaluate(() => [document.documentElement.scrollWidth, innerWidth]); assert.ok(sw[0] <= sw[1], r + ' rola na horizontal: ' + sw.join('>'));
    }
    await p.tap('.tabbar [data-act="more"]'); assert.ok(await p.locator('#modal-root .nav a').count() === 3); await p.tap('#modal-root .nav a[data-route="calendario"]'); assert.equal(await p.evaluate(() => ui.route), 'calendario');
    await p.tap('.tabbar .tab:nth-child(1)'); assert.equal(await p.evaluate(() => ui.route), 'visao-geral');
    await p.tap('.topbar [data-act="bell"]'); await p.waitForSelector('#modal-root .modal'); await p.tap('#modal-root [data-act="close-modal"]');
    assert.deepEqual(errs, []); await m.close();
  });

  /* ---------- dentro do Claude (artefato) ---------- */
  await step('modo artefato: avisa que o Teams não conecta aqui e oferece download pela capacidade', async () => {
    const e = await browser.newContext({ viewport: { width: 1280, height: 900 } }); await e.route(/^https?:/, LOCAL);
    await e.addInitScript(() => { window.__saved = []; window.claude = { use: async (n) => n === 'downloads' ? { save: async (x) => { window.__saved.push(x); return { status: 'saved' }; } } : null }; });
    const p = await e.newPage(); const errs = []; p.on('pageerror', x => errs.push(x.message)); await p.goto(APP); await p.waitForSelector('#view'); await p.click('.nav a[data-route="escola"]');
    assert.match(await p.locator('.teams-b').innerText(), /dentro do Claude/); assert.equal(await p.locator('[data-act="ms-connect"]').count(), 0);
    await p.click('.nav a[data-route="configuracoes"]'); await p.click('[data-act="export"]'); await p.waitForTimeout(150);
    const s = await p.evaluate(() => window.__saved); assert.equal(s.length, 1); assert.match(s[0].filename, /\.json$/); assert.equal(JSON.parse(s[0].data).app, 'life-dashboard');
    assert.deepEqual(errs, []); await e.close();
  });
  await step('sem capacidade de download: cai no modal com texto para copiar', async () => {
    const e = await browser.newContext({ viewport: { width: 1280, height: 900 } }); await e.route(/^https?:/, LOCAL); await e.addInitScript(() => { window.claude = { use: async () => null }; });
    const p = await e.newPage(); await p.goto(APP); await p.waitForSelector('#view'); await p.evaluate(() => go('configuracoes')); await p.click('[data-act="export"]'); await p.waitForSelector('#exp-text');
    assert.equal(JSON.parse(await p.inputValue('#exp-text')).app, 'life-dashboard'); await e.close();
  });

  await step('nenhum erro de JavaScript durante todo o teste', async () => { assert.deepEqual(errors, []); });
  console.log('\n' + (results.length - failed) + '/' + results.length + ' ok');
  await browser.close(); process.exit(failed ? 1 : 0);
})();
