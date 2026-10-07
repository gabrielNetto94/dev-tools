// Postgres Cloner - Client-side App Logic

document.addEventListener('DOMContentLoaded', () => {
  // Elementos do DOM - Navegação & Sidebar
  const appSidebar = document.getElementById('app-sidebar');
  const btnToggleSidebar = document.getElementById('btn-toggle-sidebar');
  const navBtnPostgres = document.getElementById('nav-btn-postgres');
  const navBtnDynamodb = document.getElementById('nav-btn-dynamodb');
  const viewPostgres = document.getElementById('view-postgres');
  const viewDynamodb = document.getElementById('view-dynamodb');

  // Gerenciamento da Sidebar Retrátil
  if (btnToggleSidebar && appSidebar) {
    // Restaurar estado salvo
    if (localStorage.getItem('dblab_sidebar_collapsed') === 'true') {
      appSidebar.classList.add('collapsed');
    }

    btnToggleSidebar.addEventListener('click', () => {
      appSidebar.classList.toggle('collapsed');
      localStorage.setItem('dblab_sidebar_collapsed', appSidebar.classList.contains('collapsed'));
    });
  }

  // Alternância de Módulos (Postgres Cloner vs DynamoDB Workbench)
  function switchModule(targetView) {
    if (targetView === 'dynamodb') {
      navBtnDynamodb?.classList.add('active');
      navBtnPostgres?.classList.remove('active');
      viewDynamodb?.classList.remove('hidden');
      viewPostgres?.classList.add('hidden');
    } else {
      navBtnPostgres?.classList.add('active');
      navBtnDynamodb?.classList.remove('active');
      viewPostgres?.classList.remove('hidden');
      viewDynamodb?.classList.add('hidden');
    }
    localStorage.setItem('dblab_active_view', targetView);
  }

  navBtnPostgres?.addEventListener('click', () => switchModule('postgres'));
  navBtnDynamodb?.addEventListener('click', () => switchModule('dynamodb'));

  // Restaurar módulo ativo anterior se houver
  const savedView = localStorage.getItem('dblab_active_view');
  if (savedView === 'dynamodb') {
    switchModule('dynamodb');
  }

  // Elementos do DOM - Header & Geral
  const serverStatusBadge = document.getElementById('server-status-badge');
  const serverStatusText = document.getElementById('server-status-text');
  const btnRefreshClones = document.getElementById('btn-refresh-clones');

  // Elementos do DOM - Origem e Seleção de Banco
  const selectSourceDb = document.getElementById('select-source-db');
  const btnRefreshSourceDbs = document.getElementById('btn-refresh-source-dbs');
  const sourceServerDisplay = document.getElementById('source-server-display');
  const btnToggleServerConfig = document.getElementById('btn-toggle-server-config');

  const sourceDbInfo = document.getElementById('source-db-info');
  const infoDbName = document.getElementById('info-db-name');
  const infoDbSize = document.getElementById('info-db-size');

  // Drawer de Configuração do Servidor de Origem
  const drawerServerConfig = document.getElementById('drawer-server-config');
  const inputServerHost = document.getElementById('input-server-host');
  const inputServerPort = document.getElementById('input-server-port');
  const inputServerUser = document.getElementById('input-server-user');
  const inputServerPass = document.getElementById('input-server-pass');
  const btnConnectServer = document.getElementById('btn-connect-server');
  const presetLocalTest = document.getElementById('preset-local-test');
  const presetHostMachine = document.getElementById('preset-host-machine');

  // Formulário de Clone
  const inputCloneName = document.getElementById('input-clone-name');
  const btnSuggestName = document.getElementById('btn-suggest-name');
  const selectCloneMode = document.getElementById('select-clone-mode');
  const checkOverwrite = document.getElementById('check-overwrite');
  const formClone = document.getElementById('form-clone');
  const btnSubmitClone = document.getElementById('btn-submit-clone');
  const spinnerClone = document.getElementById('spinner-clone');
  const textBtnClone = document.getElementById('text-btn-clone');

  // Terminal & Banner
  const terminalStatusBadge = document.getElementById('terminal-status-badge');
  const terminalWindow = document.getElementById('terminal-window');
  const terminalLines = document.getElementById('terminal-lines');

  const successBanner = document.getElementById('success-banner');
  const successDuration = document.getElementById('success-duration');
  const successConnString = document.getElementById('success-conn-string');
  const btnCopySuccessConn = document.getElementById('btn-copy-success-conn');

  // Lista de Clones & Modais
  const clonesGrid = document.getElementById('clones-grid');
  const clonesStatsCount = document.getElementById('clones-stats-count');
  const modalDelete = document.getElementById('modal-delete');
  const modalDeleteTargetName = document.getElementById('modal-delete-target-name');
  const btnModalCancel = document.getElementById('btn-modal-cancel');
  const btnModalConfirmDelete = document.getElementById('btn-modal-confirm-delete');
  const toast = document.getElementById('toast');

  let activeEventSource = null;
  let targetToDelete = null;

  // Estado atual do servidor de origem (sempre host.docker.internal:5432)
  let currentSourceServer = {
    host: 'host.docker.internal',
    port: '5432',
    user: 'postgres',
    password: 'postgres',
  };

  // --- Funções Auxiliares ---
  function showToast(message, duration = 3000) {
    toast.textContent = message;
    toast.classList.remove('hidden');
    setTimeout(() => {
      toast.classList.add('hidden');
    }, duration);
  }

  function appendLog(message, type = 'info') {
    const line = document.createElement('div');
    line.className = `log-line log-${type}`;
    line.textContent = message;
    terminalLines.appendChild(line);
    terminalWindow.scrollTop = terminalWindow.scrollHeight;
  }

  function clearLogs() {
    terminalLines.innerHTML = '';
  }

  function generateCloneName(baseName = 'clone') {
    const now = new Date();
    const pad = n => String(n).padStart(2, '0');
    const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
    const cleanBase = baseName ? baseName.replace(/[^a-zA-Z0-9_]/g, '_') : 'clone';
    return `${cleanBase}_${timestamp}`;
  }

  // --- 1. Inicialização e Status do Servidor de Destino ---
  async function checkServerStatus() {
    try {
      const res = await fetch('/api/info');
      const data = await res.json();
      if (data.status === 'online') {
        serverStatusBadge.querySelector('.status-dot').style.background = 'var(--accent-emerald)';
        serverStatusText.textContent = `PostgreSQL Online (Porta ${data.hostPort})`;
      } else {
        throw new Error(data.message);
      }
    } catch (err) {
      serverStatusBadge.querySelector('.status-dot').style.background = 'var(--accent-rose)';
      serverStatusText.textContent = 'Erro ao conectar ao PostgreSQL';
    }
  }

  // --- 2. Carregar Lista de Bancos do Servidor de Origem ---
  async function loadSourceDatabases() {
    selectSourceDb.innerHTML = '<option value="" disabled selected>🔍 Buscando bancos de dados disponíveis...</option>';
    selectSourceDb.disabled = true;

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

      const databases = data.databases || [];
      if (databases.length === 0) {
        selectSourceDb.innerHTML = '<option value="" disabled selected>Nenhum banco de dados encontrado no servidor</option>';
        sourceDbInfo.classList.add('hidden');
        return;
      }

      selectSourceDb.innerHTML = '';
      
      // Priorizar bancos que não sejam o 'postgres' padrão
      let preferredDb = null;

      databases.forEach(db => {
        const opt = document.createElement('option');
        opt.value = db.name;
        opt.dataset.size = db.size_pretty;
        opt.textContent = `📦 ${db.name} (${db.size_pretty})`;
        selectSourceDb.appendChild(opt);

        if (!preferredDb && db.name !== 'postgres') {
          preferredDb = db.name;
        }
      });

      // Selecionar o primeiro banco relevante
      if (preferredDb) {
        selectSourceDb.value = preferredDb;
      } else {
        selectSourceDb.selectedIndex = 0;
      }

      selectSourceDb.disabled = false;
      onSourceDbSelected();
      sourceServerDisplay.textContent = `Origem: ${currentSourceServer.host}:${currentSourceServer.port}`;
    } catch (err) {
      selectSourceDb.innerHTML = `<option value="" disabled selected>❌ Erro: ${err.message}</option>`;
      sourceDbInfo.classList.add('hidden');
      showToast(`Falha ao conectar no servidor de origem: ${err.message}`, 4000);
    } finally {
      selectSourceDb.disabled = false;
    }
  }

  // Quando o usuário troca o banco de dados no select
  function onSourceDbSelected() {
    const selectedOption = selectSourceDb.options[selectSourceDb.selectedIndex];
    if (!selectedOption || !selectedOption.value) {
      sourceDbInfo.classList.add('hidden');
      return;
    }

    const dbName = selectedOption.value;
    const dbSize = selectedOption.dataset.size || '-';

    infoDbName.textContent = dbName;
    infoDbSize.textContent = dbSize;
    sourceDbInfo.classList.remove('hidden');

    // Sugere nome do clone automaticamente com base no banco selecionado
    inputCloneName.value = generateCloneName(`clone_${dbName}`);
  }

  selectSourceDb.addEventListener('change', onSourceDbSelected);
  btnRefreshSourceDbs.addEventListener('click', () => {
    loadSourceDatabases();
    showToast('Lista de bancos atualizada!');
  });

  // --- 3. Drawer de Configuração do Servidor de Origem ---
  btnToggleServerConfig.addEventListener('click', () => {
    drawerServerConfig.classList.toggle('hidden');
  });

  if (presetHostMachine) {
    presetHostMachine.addEventListener('click', () => {
      inputServerHost.value = 'host.docker.internal';
      inputServerPort.value = '5432';
      inputServerUser.value = 'postgres';
      inputServerPass.value = 'postgres';
      showToast('Preset do host.docker.internal:5432 aplicado!');
    });
  }

  btnConnectServer.addEventListener('click', async () => {
    currentSourceServer = {
      host: inputServerHost.value.trim() || 'host.docker.internal',
      port: inputServerPort.value.trim() || '5432',
      user: inputServerUser.value.trim() || 'postgres',
      password: inputServerPass.value,
    };

    // Salvar no localStorage para conveniência
    localStorage.setItem('pg_cloner_source_server', JSON.stringify(currentSourceServer));

    showToast(`Conectando a ${currentSourceServer.host}...`);
    await loadSourceDatabases();
    drawerServerConfig.classList.add('hidden');
  });

  btnSuggestName.addEventListener('click', () => {
    const dbName = selectSourceDb.value || 'clone';
    inputCloneName.value = generateCloneName(`clone_${dbName}`);
  });

  // --- 4. Executar Clonagem por Streaming (SSE) ---
  formClone.addEventListener('submit', () => {
    const sourceDb = selectSourceDb.value;
    const cloneName = inputCloneName.value.trim();
    const schemaOnly = selectCloneMode.value === 'schema';
    const dropIfExists = checkOverwrite.checked;

    if (!sourceDb) {
      showToast('Por favor, selecione um banco de dados de origem.');
      selectSourceDb.focus();
      return;
    }

    if (!cloneName) {
      showToast('Por favor, digite o nome do clone.');
      inputCloneName.focus();
      return;
    }

    if (!/^[a-zA-Z0-9_]+$/.test(cloneName)) {
      showToast('O nome do clone só pode conter letras, números e underlines.');
      return;
    }

    // Travar botão
    btnSubmitClone.disabled = true;
    spinnerClone.classList.remove('hidden');
    textBtnClone.textContent = `Clonando '${sourceDb}'...`;

    terminalStatusBadge.textContent = 'Executando';
    terminalStatusBadge.className = 'terminal-badge running';
    successBanner.classList.add('hidden');

    clearLogs();
    appendLog(`[${new Date().toLocaleTimeString()}] Iniciando clonagem do banco '${sourceDb}' para '${cloneName}'...`, 'system');

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
      terminalStatusBadge.textContent = 'Concluído';
      terminalStatusBadge.className = 'terminal-badge success';

      successDuration.textContent = `Duração total: ${data.duration} segundos`;
      successConnString.textContent = data.connectionString;
      successBanner.classList.remove('hidden');

      showToast(`🎉 Clone '${data.cloneName}' criado com sucesso!`);
      loadClones();

      // Resetar estado do botão
      btnSubmitClone.disabled = false;
      spinnerClone.classList.add('hidden');
      textBtnClone.textContent = 'Clonar Banco Selecionado';

      activeEventSource.close();
    });

    activeEventSource.addEventListener('error', e => {
      let msg = 'Erro durante a transmissão de dados.';
      try {
        if (e.data) {
          const data = JSON.parse(e.data);
          msg = data.message || msg;
        }
      } catch {}

      appendLog(`❌ ${msg}`, 'error');
      terminalStatusBadge.textContent = 'Erro';
      terminalStatusBadge.className = 'terminal-badge error';

      showToast(`Falha na clonagem: ${msg}`);

      btnSubmitClone.disabled = false;
      spinnerClone.classList.add('hidden');
      textBtnClone.textContent = 'Clonar Banco Selecionado';

      activeEventSource.close();
    });
  });

  // Copiar URL de Sucesso
  btnCopySuccessConn.addEventListener('click', () => {
    navigator.clipboard.writeText(successConnString.textContent);
    showToast('String de conexão copiada com sucesso!');
  });

  // --- 5. Carregar e Gerenciar Clones Existentes ---
  async function loadClones() {
    try {
      const res = await fetch('/api/clones');
      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error);
      }

      const clones = data.clones || [];
      clonesStatsCount.textContent = `${clones.length} ${clones.length === 1 ? 'banco ativo' : 'bancos ativos'}`;

      if (clones.length === 0) {
        clonesGrid.innerHTML = `
          <div class="empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
              <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path>
              <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path>
            </svg>
            <p>Nenhum banco clonado ainda. Selecione um banco acima e clique para clonar!</p>
          </div>
        `;
        return;
      }

      clonesGrid.innerHTML = '';
      clones.forEach(clone => {
        const card = document.createElement('div');
        card.className = 'clone-item-card';
        card.innerHTML = `
          <div class="clone-item-header">
            <div class="clone-item-title">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
                <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path>
                <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path>
              </svg>
              <span>${clone.name}</span>
            </div>
            <span class="clone-item-size">${clone.size_pretty}</span>
          </div>

          <div class="clone-item-conn" title="${clone.connectionString}">
            ${clone.connectionString}
          </div>

          <div class="clone-item-actions">
            <div style="display: flex; gap: 0.4rem;">
              <button type="button" class="btn-secondary btn-sm btn-copy-url" data-url="${clone.connectionString}">
                📋 Copiar URL
              </button>
              <button type="button" class="btn-secondary btn-sm btn-instant-fork" data-name="${clone.name}" title="Criar outro clone a partir deste em 1 segundo">
                ⚡ Fork Rápido
              </button>
            </div>
            <button type="button" class="btn-danger btn-sm btn-delete-clone" data-name="${clone.name}">
              🗑️ Excluir
            </button>
          </div>
        `;
        clonesGrid.appendChild(card);
      });

      // Eventos dos cards de clone
      clonesGrid.querySelectorAll('.btn-copy-url').forEach(btn => {
        btn.addEventListener('click', () => {
          navigator.clipboard.writeText(btn.dataset.url);
          showToast(`URL copiada para o clipboard!`);
        });
      });

      clonesGrid.querySelectorAll('.btn-delete-clone').forEach(btn => {
        btn.addEventListener('click', () => {
          targetToDelete = btn.dataset.name;
          modalDeleteTargetName.textContent = targetToDelete;
          modalDelete.classList.remove('hidden');
        });
      });

      clonesGrid.querySelectorAll('.btn-instant-fork').forEach(btn => {
        btn.addEventListener('click', async () => {
          const sourceName = btn.dataset.name;
          const newName = generateCloneName(`fork_${sourceName}`);
          try {
            showToast(`Criando fork instantâneo de ${sourceName}...`);
            const res = await fetch('/api/clones/template', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ sourceClone: sourceName, newCloneName: newName }),
            });
            const data = await res.json();
            if (data.success) {
              showToast(data.message);
              loadClones();
            } else {
              showToast(`Erro: ${data.error}`);
            }
          } catch (e) {
            showToast(`Erro: ${e.message}`);
          }
        });
      });

    } catch (err) {
      clonesGrid.innerHTML = `<div class="empty-state"><p>Erro ao listar clones: ${err.message}</p></div>`;
    }
  }

  // --- 6. Modal de Confirmação de Exclusão ---
  btnModalCancel.addEventListener('click', () => {
    modalDelete.classList.add('hidden');
    targetToDelete = null;
  });

  btnModalConfirmDelete.addEventListener('click', async () => {
    if (!targetToDelete) return;

    btnModalConfirmDelete.disabled = true;
    try {
      const res = await fetch(`/api/clones/${targetToDelete}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        showToast(data.message);
        modalDelete.classList.add('hidden');
        loadClones();
      } else {
        showToast(`Erro ao excluir: ${data.error}`);
      }
    } catch (err) {
      showToast(`Erro: ${err.message}`);
    } finally {
      btnModalConfirmDelete.disabled = false;
      targetToDelete = null;
    }
  });

  btnRefreshClones.addEventListener('click', () => {
    loadClones();
    checkServerStatus();
    showToast('Lista de clones atualizada!');
  });

  // --- 7. Inicialização ---
  async function init() {
    // Carregar configurações padrão do servidor de origem
    try {
      const saved = localStorage.getItem('pg_cloner_source_server');
      if (saved) {
        currentSourceServer = JSON.parse(saved);
      } else {
        const res = await fetch('/api/source/config');
        const cfg = await res.json();
        currentSourceServer.host = cfg.host || 'host.docker.internal';
        currentSourceServer.port = String(cfg.port || '5432');
        currentSourceServer.user = cfg.user || 'postgres';
      }
    } catch (_) {}

    // Preencher campos do drawer
    inputServerHost.value = currentSourceServer.host;
    inputServerPort.value = currentSourceServer.port;
    inputServerUser.value = currentSourceServer.user;
    inputServerPass.value = currentSourceServer.password || '';

    // Conectar e buscar dados
    checkServerStatus();
    loadClones();
    await loadSourceDatabases();
  }

  init();
});
