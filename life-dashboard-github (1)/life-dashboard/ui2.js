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
