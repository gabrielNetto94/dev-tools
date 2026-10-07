// Postgres Cloner - Client-side App Logic

// Utilitários compartilhados entre os módulos (toast, ícones, escape, status da sidebar)
window.DEVinho = (() => {
  const ICONS = {
    check: '<circle cx="12" cy="12" r="10"></circle><path d="m8.5 12 2.5 2.5 4.5-5"></path>',
    tick: '<path d="M20 6 9 17l-5-5"></path>',
    alert: '<circle cx="12" cy="12" r="10"></circle><path d="M12 8v4M12 16h.01"></path>',
    info: '<circle cx="12" cy="12" r="10"></circle><path d="M12 16v-4M12 8h.01"></path>',
    copy: '<rect x="9" y="9" width="12" height="12" rx="2"></rect><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"></path>',
    trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"></path>',
    fork: '<circle cx="6" cy="5" r="2"></circle><circle cx="18" cy="5" r="2"></circle><circle cx="12" cy="19" r="2"></circle><path d="M6 7v2a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7M12 11v6"></path>',
    edit: '<path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"></path>',
    close: '<path d="M18 6 6 18M6 6l12 12"></path>',
    chevron: '<path d="m6 9 6 6 6-6"></path>',
    table: '<rect x="3" y="3" width="18" height="18" rx="2"></rect><path d="M3 9h18M9 3v18"></path>',
    database: '<ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M3 5v14a9 3 0 0 0 18 0V5"></path><path d="M3 12a9 3 0 0 0 18 0"></path>',
  };

  function icon(name, small = false) {
    return `<svg class="i${small ? ' i-sm' : ''}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]}</svg>`;
  }

  function esc(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  let toastTimer = null;

  // type: 'ok' | 'err' | 'info'
  function toast(message, type = 'ok', duration = 3500) {
    const el = document.getElementById('toast');
    if (!el) return;
    document.getElementById('toast-text').textContent = message;
    document.getElementById('toast-icon').innerHTML = ICONS[type === 'err' ? 'alert' : type === 'info' ? 'info' : 'check'];
    el.className = `toast ${type}`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.add('hidden'), duration);
  }

  async function copy(text, message) {
    try {
      await navigator.clipboard.writeText(text);
      toast(message);
    } catch (_) {
      toast('Não foi possível copiar para a área de transferência.', 'err');
    }
  }

  // state: 'ok' | 'warn' | 'err' | 'live' | '' (desconectado)
  function setNavStatus(module, state, label) {
    const dot = document.getElementById(`nav-dot-${module}`);
    const btn = document.getElementById(`nav-btn-${module}`);
    if (!dot || !btn) return;
    dot.className = `dot ${state}`.trim();
    dot.setAttribute('aria-label', label);
    btn.title = `${btn.querySelector('.lbl').textContent} · ${label.toLowerCase()}`;
  }

  return { icon, esc, toast, copy, setNavStatus };
})();

document.addEventListener('DOMContentLoaded', () => {
  const { icon, esc, toast, copy, setNavStatus } = window.DEVinho;

  // Elementos do DOM - Navegação & Sidebar
  const appSidebar = document.getElementById('app-sidebar');
  const btnToggleSidebar = document.getElementById('btn-toggle-sidebar');
  const navBtnPostgres = document.getElementById('nav-btn-postgres');
  const navBtnDynamodb = document.getElementById('nav-btn-dynamodb');
  const viewPostgres = document.getElementById('view-postgres');
  const viewDynamodb = document.getElementById('view-dynamodb');

  // Gerenciamento da Sidebar Retrátil
  function setSidebarCollapsed(collapsed) {
    appSidebar.classList.toggle('rail', collapsed);
    const label = collapsed ? 'Expandir sidebar' : 'Recolher sidebar';
    btnToggleSidebar.setAttribute('aria-label', label);
    btnToggleSidebar.title = `${label} (Ctrl+B)`;
    localStorage.setItem('dblab_sidebar_collapsed', collapsed);
  }

  setSidebarCollapsed(localStorage.getItem('dblab_sidebar_collapsed') === 'true');
  btnToggleSidebar.addEventListener('click', () => setSidebarCollapsed(!appSidebar.classList.contains('rail')));

  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
      e.preventDefault();
      setSidebarCollapsed(!appSidebar.classList.contains('rail'));
    }
  });

  // Barrinha do item ativo: um único elemento que desliza até o botão selecionado
  const navIndicator = document.getElementById('nav-indicator');

  function moveNavIndicator(button) {
    const offset = button.offsetTop + (button.offsetHeight - navIndicator.offsetHeight) / 2;
    navIndicator.style.transform = `translateY(${offset}px)`;
  }

  // Alternância de Módulos (Postgres Cloner vs DynamoDB Workbench)
  function switchModule(targetView) {
    const isDynamo = targetView === 'dynamodb';
    (isDynamo ? navBtnDynamodb : navBtnPostgres).setAttribute('aria-current', 'page');
    (isDynamo ? navBtnPostgres : navBtnDynamodb).removeAttribute('aria-current');
    moveNavIndicator(isDynamo ? navBtnDynamodb : navBtnPostgres);

    viewDynamodb.classList.toggle('hidden', !isDynamo);
    viewPostgres.classList.toggle('hidden', isDynamo);
    document.getElementById('title-dynamodb').classList.toggle('hidden', !isDynamo);
    document.getElementById('title-postgres').classList.toggle('hidden', isDynamo);
    document.getElementById('top-dynamodb').classList.toggle('hidden', !isDynamo);
    document.getElementById('top-postgres').classList.toggle('hidden', isDynamo);
    localStorage.setItem('dblab_active_view', targetView);
  }

  navBtnPostgres.addEventListener('click', () => switchModule('postgres'));
  navBtnDynamodb.addEventListener('click', () => switchModule('dynamodb'));

  // Restaurar módulo ativo anterior se houver
  if (localStorage.getItem('dblab_active_view') === 'dynamodb') {
    switchModule('dynamodb');
  } else {
    moveNavIndicator(navBtnPostgres);
  }
  // Só anima depois de posicionada, para não deslizar do topo ao carregar a página
  requestAnimationFrame(() => navIndicator.classList.add('is-ready'));

  document.getElementById('btn-toast-close').addEventListener('click', () => {
    document.getElementById('toast').classList.add('hidden');
  });

  // Elementos do DOM - Header & Geral
  const serverStatusDot = document.getElementById('server-status-dot');
  const serverStatusText = document.getElementById('server-status-text');
  const btnRefreshClones = document.getElementById('btn-refresh-clones');

  // Elementos do DOM - Origem e Seleção de Banco
  const stepSource = document.getElementById('step-source');
  const stepTarget = document.getElementById('step-target');
  const stepClone = document.getElementById('step-clone');
  const selectSourceDb = document.getElementById('select-source-db');
  const fieldSourceDb = document.getElementById('field-source-db');
  const btnRefreshSourceDbs = document.getElementById('btn-refresh-source-dbs');
  const fieldSourceServer = document.getElementById('field-source-server');
  const sourceServerDot = document.getElementById('source-server-dot');
  const sourceServerDisplay = document.getElementById('source-server-display');
  const btnToggleServerConfig = document.getElementById('btn-toggle-server-config');

  // Formulário do Servidor de Origem
  const drawerServerConfig = document.getElementById('drawer-server-config');
  const inputServerHost = document.getElementById('input-server-host');
  const inputServerPort = document.getElementById('input-server-port');
  const inputServerUser = document.getElementById('input-server-user');
  const inputServerPass = document.getElementById('input-server-pass');
  const btnToggleServerPass = document.getElementById('btn-toggle-server-pass');
  const btnConnectServer = document.getElementById('btn-connect-server');
  const btnCancelServerConfig = document.getElementById('btn-cancel-server-config');
  const presetHostMachine = document.getElementById('preset-host-machine');
  const sourceError = document.getElementById('source-error');
  const sourceErrorText = document.getElementById('source-error-text');

  // Elementos do DOM - Destino (Servidor e Banco)
  const targetServerSelector = document.getElementById('target-server-selector');
  const targetServerSummary = document.getElementById('target-server-summary');
  const btnEditTargetServer = document.getElementById('btn-edit-target-server');
  const drawerTargetServer = document.getElementById('drawer-target-server');
  const inputTargetHost = document.getElementById('input-target-host');
  const inputTargetPort = document.getElementById('input-target-port');
  const inputTargetUser = document.getElementById('input-target-user');
  const inputTargetPass = document.getElementById('input-target-pass');
  const btnToggleTargetPass = document.getElementById('btn-toggle-target-pass');
  const btnConnectTargetServer = document.getElementById('btn-connect-target-server');

  const targetDbModeSelector = document.getElementById('target-db-mode-selector');
  const sectionTargetNewDb = document.getElementById('section-target-new-db');
  const sectionTargetExistingDb = document.getElementById('section-target-existing-db');
  const selectTargetDb = document.getElementById('select-target-db');
  const btnRefreshTargetDbs = document.getElementById('btn-refresh-target-dbs');
  const targetError = document.getElementById('target-error');
  const targetErrorText = document.getElementById('target-error-text');
  const warningTargetOverwrite = document.getElementById('warning-target-overwrite');
  const warningOverwriteTitle = document.getElementById('warning-overwrite-title');
  const warningOverwriteDesc = document.getElementById('warning-overwrite-desc');

  // Formulário de Clone
  const inputCloneName = document.getElementById('input-clone-name');
  const btnSuggestName = document.getElementById('btn-suggest-name');
  const modeSchema = document.getElementById('mode-schema');
  const checkOverwrite = document.getElementById('check-overwrite');
  const formClone = document.getElementById('form-clone');
  const btnSubmitClone = document.getElementById('btn-submit-clone');
  const spinnerClone = document.getElementById('spinner-clone');
  const textBtnClone = document.getElementById('text-btn-clone');
  const hintClone = document.getElementById('hint-clone');

  // Console & Resultado
  const consoleBox = document.getElementById('console-box');
  const terminalStatusDot = document.getElementById('terminal-status-dot');
  const terminalStatusBadge = document.getElementById('terminal-status-badge');
  const terminalStatusDetail = document.getElementById('terminal-status-detail');
  const terminalWindow = document.getElementById('terminal-window');
  const terminalLines = document.getElementById('terminal-lines');
  const btnCopyLog = document.getElementById('btn-copy-log');
  const btnToggleLog = document.getElementById('btn-toggle-log');

  const successBanner = document.getElementById('success-banner');
  const successDuration = document.getElementById('success-duration');
  const successRoute = document.getElementById('success-route');
  const successConnString = document.getElementById('success-conn-string');
  const btnCopySuccessConn = document.getElementById('btn-copy-success-conn');

  // Lista de Clones & Modal
  const clonesGrid = document.getElementById('clones-grid');
  const clonesStatsCount = document.getElementById('clones-stats-count');
  const modalDelete = document.getElementById('modal-delete');
  const modalDeleteTargetName = document.getElementById('modal-delete-target-name');
  const modalDeleteConfirmName = document.getElementById('modal-delete-confirm-name');
  const inputDeleteConfirm = document.getElementById('input-delete-confirm');
  const btnModalCancel = document.getElementById('btn-modal-cancel');
  const btnModalConfirmDelete = document.getElementById('btn-modal-confirm-delete');

  const DEFAULT_SOURCE_SERVER = {
    host: 'host.docker.internal',
    port: '5432',
    user: 'postgres',
    password: 'postgres',
  };

  let activeEventSource = null;
  let targetToDelete = null;
  let cloneTimer = null;
  let isCloning = false;
  let targetOnline = false;
  let lastCreatedClone = null;
  let currentSourceServer = { ...DEFAULT_SOURCE_SERVER };

  // Estado do servidor e banco de destino
  let currentTargetServerMode = 'local'; // 'local' | 'source' | 'custom'
  let currentTargetDbMode = 'new'; // 'new' | 'existing'
  let customTargetServer = { host: 'localhost', port: '5432', user: 'postgres', password: 'postgres' };

  const sourceDbPicker = createDbPicker(document.getElementById('combo-source-db'), selectSourceDb);
  const targetDbPicker = createDbPicker(document.getElementById('combo-target-db'), selectTargetDb);

  // --- Funções Auxiliares ---

  // Seletor de banco com busca. O <select> nativo (oculto) continua sendo a fonte da verdade:
  // quem preenche as opções chama refresh(), e a escolha dispara 'change' no select.
  function createDbPicker(root, select) {
    const btn = root.querySelector('.combo-btn');
    const valEl = root.querySelector('.combo-val');
    const sizeEl = root.querySelector('.combo-size');
    const pop = root.querySelector('.combo-pop');
    const search = root.querySelector('.combo-search');
    const list = root.querySelector('.combo-list');
    let activeIndex = -1;

    const realOptions = () => Array.from(select.options).filter(o => o.value);
    const isOpen = () => !pop.classList.contains('hidden');

    function refresh() {
      const selected = select.options[select.selectedIndex];
      const hasValue = !!(selected && selected.value);
      valEl.textContent = selected ? selected.textContent : '';
      valEl.classList.toggle('faint', !hasValue);
      sizeEl.textContent = hasValue ? selected.dataset.size || '' : '';
      btn.disabled = select.disabled || realOptions().length === 0;
      if (btn.disabled) close();
    }

    function setActive(index) {
      const items = list.querySelectorAll('.combo-opt');
      if (items.length === 0) {
        activeIndex = -1;
        search.removeAttribute('aria-activedescendant');
        return;
      }
      activeIndex = (index + items.length) % items.length;
      items.forEach((el, i) => el.classList.toggle('is-active', i === activeIndex));
      items[activeIndex].scrollIntoView({ block: 'nearest' });
      search.setAttribute('aria-activedescendant', items[activeIndex].id);
    }

    function renderList() {
      const query = search.value.toLowerCase().trim();
      const matches = realOptions().filter(o => o.value.toLowerCase().includes(query));
      list.innerHTML = '';

      if (matches.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'hint';
        empty.textContent = 'Nenhum banco corresponde à busca.';
        list.appendChild(empty);
        setActive(-1);
        return;
      }

      matches.forEach((opt, i) => {
        const item = document.createElement('div');
        item.className = 'combo-opt';
        item.id = `${list.id}-opt-${i}`;
        item.dataset.value = opt.value;
        item.setAttribute('role', 'option');
        item.setAttribute('aria-selected', String(opt.value === select.value));
        item.innerHTML = `<span>${esc(opt.value)}</span><span class="sz">${esc(opt.dataset.size || '')}</span><span class="tick">${icon('tick', true)}</span>`;
        // mousedown para escolher antes de o campo de busca perder o foco
        item.addEventListener('mousedown', e => {
          e.preventDefault();
          choose(opt.value);
        });
        item.addEventListener('mousemove', () => setActive(i));
        list.appendChild(item);
      });

      setActive(Math.max(0, matches.findIndex(o => o.value === select.value)));
    }

    function open() {
      pop.classList.remove('hidden');
      btn.setAttribute('aria-expanded', 'true');
      search.value = '';
      renderList();
      search.focus();
    }

    function close(returnFocus = false) {
      if (!isOpen()) return;
      pop.classList.add('hidden');
      btn.setAttribute('aria-expanded', 'false');
      if (returnFocus) btn.focus();
    }

    function choose(value) {
      select.value = value;
      refresh();
      close(true);
      select.dispatchEvent(new Event('change'));
    }

    btn.addEventListener('click', () => (isOpen() ? close() : open()));
    search.addEventListener('input', renderList);
    search.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        setActive(activeIndex + (e.key === 'ArrowDown' ? 1 : -1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const active = list.querySelectorAll('.combo-opt')[activeIndex];
        if (active) choose(active.dataset.value);
      } else if (e.key === 'Escape') {
        e.stopPropagation();
        close(true);
      } else if (e.key === 'Tab') {
        close();
      }
    });
    document.addEventListener('mousedown', e => {
      if (!root.contains(e.target)) close();
    });

    refresh();
    return { refresh };
  }

  // Grupo de botões exclusivos (aria-pressed); onChange recebe o data-* do botão escolhido
  function bindSegment(container, dataKey, onChange) {
    const buttons = container.querySelectorAll('button');
    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        buttons.forEach(b => b.setAttribute('aria-pressed', String(b === btn)));
        onChange(btn.dataset[dataKey]);
      });
    });
  }

  function bindPasswordToggle(button, input) {
    button.addEventListener('click', () => {
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      const label = show ? 'Ocultar senha' : 'Mostrar senha';
      button.setAttribute('aria-label', label);
      button.title = label;
    });
  }

  function appendLog(message, type = 'info') {
    // As mensagens do servidor vêm com emojis; o tipo da linha já comunica o estado
    let kind = type;
    if (type === 'info' && message.includes('✓')) kind = 'ok';
    if (type === 'info' && message.includes('⚠')) kind = 'warn';
    const clean = message.replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{26FF}\u{2139}\u{274C}️]\s?/gu, '');

    const line = document.createElement('div');
    line.className = `log-line log-${kind}`;
    const ts = document.createElement('span');
    ts.className = 'ts';
    ts.textContent = new Date().toLocaleTimeString('pt-BR');
    line.append(ts, clean);
    terminalLines.appendChild(line);
    terminalWindow.scrollTop = terminalWindow.scrollHeight;
  }

  function setLogCollapsed(collapsed) {
    consoleBox.classList.toggle('is-collapsed', collapsed);
    const label = collapsed ? 'Mostrar log' : 'Ocultar log';
    btnToggleLog.setAttribute('aria-expanded', String(!collapsed));
    btnToggleLog.setAttribute('aria-label', label);
    btnToggleLog.title = label;
  }

  function setTerminalStatus(state, label, detail = '') {
    terminalStatusDot.className = `dot ${state}`.trim();
    terminalStatusBadge.textContent = label;
    terminalStatusDetail.textContent = detail ? `· ${detail}` : '';
    consoleBox.classList.toggle('is-running', state === 'live');
  }

  function generateCloneName(baseName = 'clone') {
    const now = new Date();
    const pad = n => String(n).padStart(2, '0');
    const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
    const cleanBase = baseName ? baseName.replace(/[^a-zA-Z0-9_]/g, '_') : 'clone';
    return `${cleanBase}_${timestamp}`;
  }

  function updateNavStatus() {
    if (isCloning) setNavStatus('postgres', 'live', 'Clonagem em andamento');
    else if (targetOnline) setNavStatus('postgres', 'ok', 'Conectado');
    else setNavStatus('postgres', 'err', 'Falha na conexão');
  }

  // Destaca em qual passo do fluxo a pessoa está
  function updateSteps() {
    sourceDbPicker.refresh();
    const hasSource = !!selectSourceDb.value;
    stepSource.classList.toggle('done', hasSource);
    stepSource.classList.toggle('current', !hasSource && !isCloning);
    stepTarget.classList.toggle('done', isCloning);
    stepTarget.classList.toggle('current', hasSource && !isCloning);
    stepClone.classList.toggle('current', isCloning);
    stepSource.classList.toggle('is-locked', isCloning);
    stepTarget.classList.toggle('is-locked', isCloning || !hasSource);
    stepClone.classList.toggle('is-locked', !isCloning && !hasSource);
  }

  // --- 1. Status do Servidor de Destino ---
  async function checkServerStatus() {
    try {
      const res = await fetch('/api/info');
      const data = await res.json();
      if (data.status !== 'online') throw new Error(data.message);
      targetOnline = true;
      serverStatusDot.className = 'dot ok';
      serverStatusText.innerHTML = `Destino <b class="mono">localhost:${esc(data.hostPort)}</b>`;
    } catch (err) {
      targetOnline = false;
      serverStatusDot.className = 'dot err';
      serverStatusText.textContent = 'Destino indisponível';
    }
    updateNavStatus();
  }

  // --- 2. Carregar Lista de Bancos do Servidor de Origem ---
  function setServerFormOpen(open) {
    drawerServerConfig.classList.toggle('hidden', !open);
    fieldSourceServer.classList.toggle('hidden', open);
  }

  async function loadSourceDatabases() {
    selectSourceDb.innerHTML = '<option value="" disabled selected>Carregando bancos…</option>';
    selectSourceDb.disabled = true;
    sourceDbPicker.refresh();
    sourceServerDot.className = 'dot';
    sourceServerDot.setAttribute('aria-label', 'Conectando');
    sourceServerDisplay.textContent = `${currentSourceServer.user}@${currentSourceServer.host}:${currentSourceServer.port}`;

    try {
      const res = await fetch('/api/source/databases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(currentSourceServer),
      });
      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error);
      }

      sourceServerDot.className = 'dot ok';
      sourceServerDot.setAttribute('aria-label', 'Conectado');
      sourceError.classList.add('hidden');
      inputServerHost.classList.remove('is-error');
      fieldSourceDb.classList.remove('hidden');
      setServerFormOpen(false);

      const databases = data.databases || [];
      if (databases.length === 0) {
        selectSourceDb.innerHTML = '<option value="" disabled selected>Nenhum banco encontrado no servidor</option>';
        updateSteps();
        return true;
      }

      selectSourceDb.innerHTML = '';

      // Priorizar bancos que não sejam o 'postgres' padrão
      let preferredDb = null;

      databases.forEach(db => {
        const opt = document.createElement('option');
        opt.value = db.name;
        opt.dataset.size = db.size_pretty;
        opt.textContent = db.name;
        selectSourceDb.appendChild(opt);

        if (!preferredDb && db.name !== 'postgres') {
          preferredDb = db.name;
        }
      });

      if (preferredDb) {
        selectSourceDb.value = preferredDb;
      } else {
        selectSourceDb.selectedIndex = 0;
      }

      selectSourceDb.disabled = false;
      onSourceDbSelected();
      return true;
    } catch (err) {
      // Sem origem não há o que clonar: o formulário do servidor vira o próximo passo
      selectSourceDb.innerHTML = '<option value="" disabled selected>Sem conexão com a origem</option>';
      sourceServerDot.className = 'dot err';
      sourceServerDot.setAttribute('aria-label', 'Falha na conexão');
      fieldSourceDb.classList.add('hidden');
      sourceErrorText.textContent = err.message;
      sourceError.classList.remove('hidden');
      inputServerHost.classList.add('is-error');
      setServerFormOpen(true);
      updateSteps();
      return false;
    }
  }

  // Quando o usuário troca o banco de dados de origem
  function onSourceDbSelected() {
    if (selectSourceDb.value) {
      // Sugere nome do clone automaticamente com base no banco selecionado
      inputCloneName.value = generateCloneName(`clone_${selectSourceDb.value}`);
    }
    updateTargetOverwriteWarning();
    updateSteps();
  }

  selectSourceDb.addEventListener('change', onSourceDbSelected);
  btnRefreshSourceDbs.addEventListener('click', async () => {
    if (await loadSourceDatabases()) toast('Lista de bancos atualizada');
  });

  // --- 3. Formulário do Servidor de Origem ---
  btnToggleServerConfig.addEventListener('click', () => {
    setServerFormOpen(true);
    inputServerHost.focus();
  });

  btnCancelServerConfig.addEventListener('click', () => {
    sourceError.classList.add('hidden');
    inputServerHost.classList.remove('is-error');
    setServerFormOpen(false);
  });

  bindPasswordToggle(btnToggleServerPass, inputServerPass);
  bindPasswordToggle(btnToggleTargetPass, inputTargetPass);

  presetHostMachine.addEventListener('click', () => {
    inputServerHost.value = DEFAULT_SOURCE_SERVER.host;
    inputServerPort.value = DEFAULT_SOURCE_SERVER.port;
    inputServerUser.value = DEFAULT_SOURCE_SERVER.user;
    inputServerPass.value = DEFAULT_SOURCE_SERVER.password;
  });

  btnConnectServer.addEventListener('click', async () => {
    currentSourceServer = {
      host: inputServerHost.value.trim() || DEFAULT_SOURCE_SERVER.host,
      port: inputServerPort.value.trim() || DEFAULT_SOURCE_SERVER.port,
      user: inputServerUser.value.trim() || DEFAULT_SOURCE_SERVER.user,
      password: inputServerPass.value,
    };

    // Salvar no localStorage para conveniência
    localStorage.setItem('pg_cloner_source_server', JSON.stringify(currentSourceServer));

    btnConnectServer.disabled = true;
    await loadSourceDatabases();
    btnConnectServer.disabled = false;

    updateTargetServerSummary();
    if (currentTargetServerMode === 'source' && currentTargetDbMode === 'existing') {
      await loadTargetDatabases();
    }
  });

  btnSuggestName.addEventListener('click', () => {
    const dbName = selectSourceDb.value || 'clone';
    inputCloneName.value = generateCloneName(`clone_${dbName}`);
  });

  // --- 4. Servidor e Banco de Destino ---
  function updateTargetServerSummary() {
    if (currentTargetServerMode === 'source') {
      targetServerSummary.textContent = `Mesmo servidor da origem · ${currentSourceServer.host}:${currentSourceServer.port}`;
    } else if (currentTargetServerMode === 'custom') {
      targetServerSummary.textContent = `${customTargetServer.user}@${customTargetServer.host}:${customTargetServer.port}`;
    } else {
      targetServerSummary.textContent = 'Postgres do DEVinho (container local)';
    }
    const formOpen = !drawerTargetServer.classList.contains('hidden');
    btnEditTargetServer.classList.toggle('hidden', currentTargetServerMode !== 'custom' || formOpen);
  }

  function setTargetFormOpen(open) {
    drawerTargetServer.classList.toggle('hidden', !open);
    updateTargetServerSummary();
  }

  function updateSubmitLabel() {
    if (isCloning) return;
    const overwriting = currentTargetDbMode === 'existing' && selectTargetDb.value;
    textBtnClone.textContent = overwriting ? `Sobrescrever ${selectTargetDb.value}` : 'Clonar banco';
  }

  // Aviso do que será apagado ao sobrescrever um banco existente
  function updateTargetOverwriteWarning() {
    const targetDb = selectTargetDb.value;
    const show = currentTargetDbMode === 'existing' && !!targetDb;
    warningTargetOverwrite.classList.toggle('hidden', !show);
    updateSubmitLabel();
    if (!show) return;

    const sourceDb = selectSourceDb.value || '';
    const isSameServer =
      currentTargetServerMode === 'source' ||
      (currentTargetServerMode === 'custom' &&
        customTargetServer.host === currentSourceServer.host &&
        customTargetServer.port === currentSourceServer.port);
    const isSameDb = isSameServer && sourceDb === targetDb;

    warningTargetOverwrite.classList.toggle('err', isSameDb);
    warningTargetOverwrite.classList.toggle('warn', !isSameDb);
    if (isSameDb) {
      warningOverwriteTitle.textContent = 'Origem e destino são o mesmo banco';
      warningOverwriteDesc.textContent = `${targetDb} será limpo e restaurado sobre ele mesmo (--clean).`;
    } else {
      warningOverwriteTitle.textContent = `${targetDb} será sobrescrito`;
      warningOverwriteDesc.textContent = `Os dados atuais de ${targetDb} no destino serão apagados e substituídos pelo dump de ${sourceDb}.`;
    }
  }

  async function loadTargetDatabases() {
    selectTargetDb.innerHTML = '<option value="" disabled selected>Carregando bancos do destino…</option>';
    selectTargetDb.disabled = true;
    targetDbPicker.refresh();
    targetError.classList.add('hidden');

    try {
      const res = await fetch('/api/target/databases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetServerMode: currentTargetServerMode,
          sourceHost: currentSourceServer.host,
          sourcePort: currentSourceServer.port,
          sourceUser: currentSourceServer.user,
          sourcePassword: currentSourceServer.password,
          targetHost: customTargetServer.host,
          targetPort: customTargetServer.port,
          targetUser: customTargetServer.user,
          targetPassword: customTargetServer.password,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error);
      }

      const databases = data.databases || [];
      if (databases.length === 0) {
        selectTargetDb.innerHTML = '<option value="" disabled selected>Nenhum banco no servidor de destino</option>';
      } else {
        selectTargetDb.innerHTML = '';
        databases.forEach(db => {
          const opt = document.createElement('option');
          opt.value = db.name;
          opt.dataset.size = db.size_pretty;
          opt.textContent = db.name;
          selectTargetDb.appendChild(opt);
        });

        // Por padrão aponta para o banco de mesmo nome da origem, se existir no destino
        const currentSource = selectSourceDb.value;
        if (currentSource && databases.some(d => d.name === currentSource)) {
          selectTargetDb.value = currentSource;
        } else {
          selectTargetDb.selectedIndex = 0;
        }
        selectTargetDb.disabled = false;
      }
    } catch (err) {
      selectTargetDb.innerHTML = '<option value="" disabled selected>Sem conexão com o destino</option>';
      targetErrorText.textContent = err.message;
      targetError.classList.remove('hidden');
    }

    targetDbPicker.refresh();
    updateTargetOverwriteWarning();
  }

  bindSegment(targetServerSelector, 'targetMode', async mode => {
    currentTargetServerMode = mode;
    setTargetFormOpen(mode === 'custom');
    updateTargetOverwriteWarning();
    if (currentTargetDbMode === 'existing') {
      await loadTargetDatabases();
    }
  });

  btnEditTargetServer.addEventListener('click', () => {
    setTargetFormOpen(true);
    inputTargetHost.focus();
  });

  btnConnectTargetServer.addEventListener('click', async () => {
    customTargetServer = {
      host: inputTargetHost.value.trim() || 'localhost',
      port: inputTargetPort.value.trim() || '5432',
      user: inputTargetUser.value.trim() || 'postgres',
      password: inputTargetPass.value,
    };
    localStorage.setItem('pg_cloner_target_custom', JSON.stringify(customTargetServer));
    setTargetFormOpen(false);
    if (currentTargetDbMode === 'existing') {
      await loadTargetDatabases();
    }
  });

  bindSegment(targetDbModeSelector, 'dbMode', async mode => {
    currentTargetDbMode = mode;
    sectionTargetNewDb.classList.toggle('hidden', mode !== 'new');
    sectionTargetExistingDb.classList.toggle('hidden', mode !== 'existing');
    updateTargetOverwriteWarning();
    if (mode === 'existing') {
      await loadTargetDatabases();
    }
  });

  selectTargetDb.addEventListener('change', updateTargetOverwriteWarning);
  btnRefreshTargetDbs.addEventListener('click', loadTargetDatabases);

  // --- 5. Executar Clonagem por Streaming (SSE) ---
  function setCloning(running, label = '') {
    isCloning = running;
    btnSubmitClone.disabled = running;
    btnSubmitClone.classList.toggle('is-busy', running);
    btnSubmitClone.setAttribute('aria-busy', String(running));
    spinnerClone.classList.toggle('hidden', !running);
    clearInterval(cloneTimer);

    if (running) {
      const startedAt = Date.now();
      const tick = () => {
        const secs = Math.floor((Date.now() - startedAt) / 1000);
        const mm = String(Math.floor(secs / 60)).padStart(2, '0');
        const ss = String(secs % 60).padStart(2, '0');
        textBtnClone.textContent = `${label}… ${mm}:${ss}`;
      };
      tick();
      cloneTimer = setInterval(tick, 1000);
      hintClone.textContent = 'Os campos ficam travados até a clonagem terminar.';
    } else {
      updateSubmitLabel();
      hintClone.textContent = 'O log aparece ao lado enquanto a clonagem roda.';
    }

    updateSteps();
    updateNavStatus();
  }

  formClone.addEventListener('submit', () => {
    const sourceDb = selectSourceDb.value;
    const isExisting = currentTargetDbMode === 'existing';
    const cloneName = isExisting ? selectTargetDb.value : inputCloneName.value.trim();
    const schemaOnly = modeSchema.checked;
    const dropIfExists = isExisting ? true : checkOverwrite.checked;

    if (!sourceDb) {
      toast('Selecione um banco de origem.', 'err');
      selectSourceDb.focus();
      return;
    }

    if (!cloneName) {
      toast(isExisting ? 'Selecione o banco de destino a sobrescrever.' : 'Digite o nome do novo banco.', 'err');
      if (!isExisting) inputCloneName.focus();
      return;
    }

    if (!/^[a-zA-Z0-9_]+$/.test(cloneName)) {
      toast('O nome do banco só pode conter letras, números e underline.', 'err');
      inputCloneName.focus();
      return;
    }

    setCloning(true, isExisting ? `Sobrescrevendo ${cloneName}` : `Clonando ${sourceDb}`);
    successBanner.classList.add('hidden');
    consoleBox.classList.remove('hidden');
    setLogCollapsed(false);
    setTerminalStatus('live', 'Executando', `${sourceDb} → ${cloneName}`);

    terminalLines.innerHTML = '';
    appendLog(`Iniciando cópia de '${sourceDb}' para '${cloneName}' (${targetServerSummary.textContent})...`, 'system');

    if (activeEventSource) {
      activeEventSource.close();
    }

    const params = new URLSearchParams({
      sourceDb,
      sourceHost: currentSourceServer.host,
      sourcePort: currentSourceServer.port,
      sourceUser: currentSourceServer.user,
      sourcePassword: currentSourceServer.password,
      cloneName,
      targetDbName: cloneName,
      targetServerMode: currentTargetServerMode,
      targetHost: customTargetServer.host,
      targetPort: customTargetServer.port,
      targetUser: customTargetServer.user,
      targetPassword: customTargetServer.password,
      isExistingDb: String(isExisting),
      schemaOnly: String(schemaOnly),
      dropIfExists: String(dropIfExists),
    });

    activeEventSource = new EventSource(`/api/clone-stream?${params.toString()}`);

    activeEventSource.addEventListener('log', e => {
      const data = JSON.parse(e.data);
      appendLog(data.message, 'info');
    });

    activeEventSource.addEventListener('success', e => {
      const data = JSON.parse(e.data);
      activeEventSource.close();

      const lineCount = terminalLines.childElementCount;
      setTerminalStatus('ok', 'Concluído', `${lineCount} ${lineCount === 1 ? 'linha' : 'linhas'}`);
      setLogCollapsed(true);

      successDuration.textContent = `${isExisting ? 'Banco sobrescrito' : 'Clone concluído'} em ${data.duration} s`;
      successRoute.textContent = `${sourceDb} → ${data.cloneName}`;
      successConnString.textContent = data.connectionString;
      successBanner.classList.remove('hidden');

      if (!isExisting) lastCreatedClone = data.cloneName;
      setCloning(false);
      loadClones();

      if (isExisting) {
        toast(`Banco ${data.cloneName} sobrescrito`);
      } else {
        // Já deixa um nome novo pronto para o próximo clone
        inputCloneName.value = generateCloneName(`clone_${sourceDb}`);
        toast(`Clone ${data.cloneName} criado`);
      }
    });

    activeEventSource.addEventListener('error', e => {
      let msg = 'Erro durante a transmissão de dados.';
      try {
        if (e.data) {
          const data = JSON.parse(e.data);
          msg = data.message || msg;
        }
      } catch {}

      activeEventSource.close();
      appendLog(msg, 'error');
      setTerminalStatus('err', 'Erro');
      setCloning(false);
      toast(`Falha na clonagem: ${msg}`, 'err', 5000);
    });
  });

  btnCopySuccessConn.addEventListener('click', () => {
    copy(successConnString.textContent, 'URL copiada para a área de transferência');
  });

  btnCopyLog.addEventListener('click', () => {
    const text = Array.from(terminalLines.children, line => line.textContent).join('\n');
    copy(text, 'Log copiado para a área de transferência');
  });

  btnToggleLog.addEventListener('click', () => {
    setLogCollapsed(!consoleBox.classList.contains('is-collapsed'));
  });

  // --- 6. Carregar e Gerenciar Clones Existentes ---
  function renderClonesMessage(title, text) {
    clonesGrid.innerHTML = `
      <div class="empty">
        <div class="ei">${icon('database')}</div>
        <h3>${esc(title)}</h3>
        <p>${text}</p>
      </div>
    `;
  }

  async function loadClones() {
    try {
      const res = await fetch('/api/clones');
      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error);
      }

      const clones = data.clones || [];
      clonesStatsCount.textContent = clones.length;

      if (clones.length === 0) {
        renderClonesMessage(
          'Nenhum clone ainda',
          'Escolha um banco de origem à esquerda e clique em <b>Clonar banco</b>. Cada clone aparece aqui com a URL de conexão pronta para copiar.'
        );
        return;
      }

      clonesGrid.innerHTML = '';
      clones.forEach(clone => {
        const isNew = clone.name === lastCreatedClone;
        const row = document.createElement('div');
        row.className = `row${isNew ? ' is-new' : ''}`;
        row.innerHTML = `
          <div class="row-main">
            <div class="row-name"><span>${esc(clone.name)}</span>${isNew ? '<span class="new-tag">novo</span>' : ''}</div>
            <div class="row-url" title="${esc(clone.connectionString)}">${esc(clone.connectionString)}</div>
          </div>
          <span class="row-meta">${esc(clone.size_pretty)}</span>
          <div class="row-actions">
            <button type="button" class="iconbtn btn-copy-url" aria-label="Copiar URL de conexão de ${esc(clone.name)}" title="Copiar URL">${icon('copy')}</button>
            <button type="button" class="btn btn-ghost btn-sm btn-instant-fork" title="Criar outro clone a partir deste via TEMPLATE">${icon('fork', true)}Fork rápido</button>
            <button type="button" class="iconbtn danger btn-delete-clone" aria-label="Excluir ${esc(clone.name)}" title="Excluir">${icon('trash')}</button>
          </div>
        `;

        row.querySelector('.btn-copy-url').addEventListener('click', () => {
          copy(clone.connectionString, 'URL copiada para a área de transferência');
        });
        row.querySelector('.btn-delete-clone').addEventListener('click', () => openDeleteModal(clone.name));
        row.querySelector('.btn-instant-fork').addEventListener('click', e => forkClone(clone.name, e.currentTarget));

        clonesGrid.appendChild(row);
      });
    } catch (err) {
      clonesStatsCount.textContent = '0';
      renderClonesMessage('Não foi possível listar os clones', esc(err.message));
    }
  }

  async function forkClone(sourceName, button) {
    const newName = generateCloneName(`fork_${sourceName}`);
    button.disabled = true;
    try {
      const res = await fetch('/api/clones/template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceClone: sourceName, newCloneName: newName }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      lastCreatedClone = newName;
      toast(`Fork ${newName} criado`);
      loadClones();
    } catch (err) {
      toast(`Falha no fork: ${err.message}`, 'err', 5000);
      button.disabled = false;
    }
  }

  // --- 7. Modal de Confirmação de Exclusão ---
  function openDeleteModal(name) {
    targetToDelete = name;
    modalDeleteTargetName.textContent = name;
    modalDeleteConfirmName.textContent = name;
    inputDeleteConfirm.value = '';
    btnModalConfirmDelete.disabled = true;
    modalDelete.classList.remove('hidden');
    inputDeleteConfirm.focus();
  }

  function closeDeleteModal() {
    modalDelete.classList.add('hidden');
    targetToDelete = null;
  }

  async function confirmDelete() {
    if (!targetToDelete || inputDeleteConfirm.value !== targetToDelete) return;

    btnModalConfirmDelete.disabled = true;
    try {
      const res = await fetch(`/api/clones/${encodeURIComponent(targetToDelete)}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      toast(`Banco ${targetToDelete} excluído`);
      closeDeleteModal();
      loadClones();
    } catch (err) {
      toast(`Erro ao excluir: ${err.message}`, 'err', 5000);
      btnModalConfirmDelete.disabled = false;
    }
  }

  inputDeleteConfirm.addEventListener('input', () => {
    btnModalConfirmDelete.disabled = inputDeleteConfirm.value !== targetToDelete;
  });
  inputDeleteConfirm.addEventListener('keydown', e => {
    if (e.key === 'Enter') confirmDelete();
  });
  btnModalCancel.addEventListener('click', closeDeleteModal);
  btnModalConfirmDelete.addEventListener('click', confirmDelete);
  modalDelete.addEventListener('click', e => {
    if (e.target === modalDelete) closeDeleteModal();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !modalDelete.classList.contains('hidden')) closeDeleteModal();
  });

  btnRefreshClones.addEventListener('click', async () => {
    checkServerStatus();
    await loadClones();
    toast('Lista de clones atualizada');
  });

  // --- 8. Inicialização ---
  async function init() {
    // Carregar configurações padrão do servidor de origem
    try {
      const saved = localStorage.getItem('pg_cloner_source_server');
      if (saved) {
        currentSourceServer = JSON.parse(saved);
      } else {
        const res = await fetch('/api/source/config');
        const cfg = await res.json();
        currentSourceServer.host = cfg.host || DEFAULT_SOURCE_SERVER.host;
        currentSourceServer.port = String(cfg.port || DEFAULT_SOURCE_SERVER.port);
        currentSourceServer.user = cfg.user || DEFAULT_SOURCE_SERVER.user;
      }
    } catch (_) {}

    // Preencher campos do formulário de servidor
    inputServerHost.value = currentSourceServer.host;
    inputServerPort.value = currentSourceServer.port;
    inputServerUser.value = currentSourceServer.user;
    inputServerPass.value = currentSourceServer.password || '';

    try {
      const savedTarget = localStorage.getItem('pg_cloner_target_custom');
      if (savedTarget) customTargetServer = { ...customTargetServer, ...JSON.parse(savedTarget) };
    } catch (_) {}
    inputTargetHost.value = customTargetServer.host;
    inputTargetPort.value = customTargetServer.port;
    inputTargetUser.value = customTargetServer.user;
    inputTargetPass.value = customTargetServer.password;

    updateTargetServerSummary();
    updateSteps();
    checkServerStatus();
    loadClones();
    await loadSourceDatabases();
  }

  init();
});
