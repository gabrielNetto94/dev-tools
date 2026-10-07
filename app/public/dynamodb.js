// DynamoDB Workbench - Client Controller

(() => {
  // Estado local do DynamoDB Workbench
  const state = {
    credentials: {
      region: 'us-east-1',
      endpoint: '',
      accessKeyId: '',
      secretAccessKey: '',
      sessionToken: '',
    },
    isEnvConfigured: false,
    tables: [],
    activeTable: null,
    tableMetadata: null,
    items: [],
    lastEvaluatedKey: null,
    editingItem: null,
    activeTab: 'visual',
    itemToDelete: null,
  };

  // Elementos do DOM - Conexão e Credenciais
  const dynamoStatusBadge = document.getElementById('dynamo-status-badge');
  const dynamoStatusText = document.getElementById('dynamo-status-text');
  const btnToggleDynamoCreds = document.getElementById('btn-toggle-dynamo-creds');
  const drawerDynamoCreds = document.getElementById('drawer-dynamo-creds');
  const dynamoEnvIndicator = document.getElementById('dynamo-env-indicator');

  const inputDynamoRegion = document.getElementById('input-dynamo-region');
  const inputDynamoEndpoint = document.getElementById('input-dynamo-endpoint');
  const inputDynamoAccessKey = document.getElementById('input-dynamo-access-key');
  const inputDynamoSecretKey = document.getElementById('input-dynamo-secret-key');
  const inputDynamoSessionToken = document.getElementById('input-dynamo-session-token');
  const btnToggleSecretVisibility = document.getElementById('btn-toggle-secret-visibility');

  const presetDynamoAws = document.getElementById('preset-dynamo-aws');
  const presetDynamoDocker = document.getElementById('preset-dynamo-docker');
  const presetDynamoHost = document.getElementById('preset-dynamo-host');
  const presetDynamoLocalstack = document.getElementById('preset-dynamo-localstack');
  const btnDynamoConnect = document.getElementById('btn-dynamo-connect');
  const spinnerDynamoConnect = document.getElementById('spinner-dynamo-connect');

  // Elementos do DOM - Tabelas
  const dynamoTablesCount = document.getElementById('dynamo-tables-count');
  const btnRefreshDynamoTables = document.getElementById('btn-refresh-dynamo-tables');
  const inputSearchTables = document.getElementById('input-search-tables');
  const dynamoTablesList = document.getElementById('dynamo-tables-list');

  // Elementos do DOM - Inspetor de Tabela & Itens
  const dynamoEmptySelection = document.getElementById('dynamo-empty-selection');
  const dynamoTableView = document.getElementById('dynamo-table-view');
  const dynamoActiveTableName = document.getElementById('dynamo-active-table-name');
  const dynamoKeysBadges = document.getElementById('dynamo-keys-badges');
  const btnDynamoScan = document.getElementById('btn-dynamo-scan');
  const spinnerDynamoScan = document.getElementById('spinner-dynamo-scan');
  const btnDynamoNewItem = document.getElementById('btn-dynamo-new-item');
  const dynamoItemsStatCount = document.getElementById('dynamo-items-stat-count');
  const inputFilterItems = document.getElementById('input-filter-items');
  const dynamoTableHead = document.getElementById('dynamo-table-head');
  const dynamoTableBody = document.getElementById('dynamo-table-body');
  const dynamoPaginationFooter = document.getElementById('dynamo-pagination-footer');
  const btnDynamoLoadMore = document.getElementById('btn-dynamo-load-more');

  // Elementos do DOM - Modal Editor
  const modalDynamoItem = document.getElementById('modal-dynamo-item');
  const modalDynamoTitle = document.getElementById('modal-dynamo-title');
  const modalDynamoSubtitle = document.getElementById('modal-dynamo-subtitle');
  const tabBtnVisual = document.getElementById('tab-btn-visual');
  const tabBtnJson = document.getElementById('tab-btn-json');
  const panelDynamoVisual = document.getElementById('panel-dynamo-visual');
  const panelDynamoJson = document.getElementById('panel-dynamo-json');
  const dynamoAttributesList = document.getElementById('dynamo-attributes-list');
  const btnAddAttribute = document.getElementById('btn-add-attribute');
  const textareaDynamoJson = document.getElementById('textarea-dynamo-json');
  const jsonValidationBar = document.getElementById('json-validation-bar');
  const jsonValidationMsg = document.getElementById('json-validation-msg');
  const btnModalCancelDynamo = document.getElementById('btn-modal-cancel-dynamo');
  const btnModalSaveDynamo = document.getElementById('btn-modal-save-dynamo');
  const spinnerSaveDynamo = document.getElementById('spinner-save-dynamo');

  // Elementos do DOM - Modal Delete
  const modalDynamoDelete = document.getElementById('modal-dynamo-delete');
  const modalDynamoDeleteKey = document.getElementById('modal-dynamo-delete-key');
  const btnModalCancelDeleteDynamo = document.getElementById('btn-modal-cancel-delete-dynamo');
  const btnModalConfirmDeleteDynamo = document.getElementById('btn-modal-confirm-delete-dynamo');

  const toast = document.getElementById('toast');

  // Helper para exibir Toast
  function showToast(message, duration = 3000) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.remove('hidden');
    setTimeout(() => {
      toast.classList.add('hidden');
    }, duration);
  }

  // Obter credenciais ativas dos inputs
  function getPayloadCredentials() {
    const creds = {};
    if (inputDynamoRegion.value.trim()) creds.region = inputDynamoRegion.value.trim();
    if (inputDynamoEndpoint.value.trim()) creds.endpoint = inputDynamoEndpoint.value.trim();
    if (inputDynamoAccessKey.value.trim()) creds.accessKeyId = inputDynamoAccessKey.value.trim();
    if (inputDynamoSecretKey.value.trim()) creds.secretAccessKey = inputDynamoSecretKey.value.trim();
    if (inputDynamoSessionToken.value.trim()) creds.sessionToken = inputDynamoSessionToken.value.trim();
    return creds;
  }

  // 1. Carregar Configuração Padrão do Servidor
  async function loadInitialConfig() {
    try {
      const res = await fetch('/api/dynamodb/config');
      const data = await res.json();
      if (data.success) {
        state.isEnvConfigured = data.configuredViaEnv;
        if (data.defaultRegion) inputDynamoRegion.value = data.defaultRegion;
        if (data.defaultEndpoint) inputDynamoEndpoint.value = data.defaultEndpoint;

        if (data.configuredViaEnv) {
          dynamoEnvIndicator.classList.remove('hidden');
          dynamoEnvIndicator.textContent = `⚙️ .env Ativo (${data.maskedAccessKey || 'configurado'})`;
          dynamoStatusText.textContent = `Pronto (.env: ${data.defaultRegion})`;
          const dot = dynamoStatusBadge.querySelector('.status-dot');
          if (dot) dot.classList.add('connected');
        } else {
          dynamoStatusText.textContent = 'Aguardando Conexão';
        }
      }
    } catch (err) {
      console.warn('Não foi possível carregar config inicial do DynamoDB:', err);
    }
  }

  // 2. Conectar e Listar Tabelas
  async function connectAndListTables(autoSelectFirst = false) {
    spinnerDynamoConnect.classList.remove('hidden');
    btnDynamoConnect.disabled = true;

    try {
      const payload = getPayloadCredentials();
      const res = await fetch('/api/dynamodb/tables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Erro desconhecido ao listar tabelas.');
      }

      state.tables = data.tables || [];
      renderTablesList(state.tables);
      dynamoTablesCount.textContent = `${state.tables.length} tabelas encontradas`;

      const dot = dynamoStatusBadge.querySelector('.status-dot');
      if (dot) dot.classList.add('connected');
      dynamoStatusText.textContent = `Conectado (${state.tables.length} tab)`;

      showToast(`Conectado ao DynamoDB! ${state.tables.length} tabelas carregadas.`);

      if (autoSelectFirst && state.tables.length > 0 && !state.activeTable) {
        selectTable(state.tables[0]);
      }
    } catch (err) {
      showToast(`Falha: ${err.message}`, 4000);
      dynamoStatusText.textContent = 'Erro de Conexão';
      const dot = dynamoStatusBadge.querySelector('.status-dot');
      if (dot) dot.classList.remove('connected');
    } finally {
      spinnerDynamoConnect.classList.add('hidden');
      btnDynamoConnect.disabled = false;
    }
  }

  // Renderizar Lista de Tabelas
  function renderTablesList(tables) {
    dynamoTablesList.innerHTML = '';
    const filter = (inputSearchTables.value || '').toLowerCase().trim();
    const filtered = tables.filter((t) => t.toLowerCase().includes(filter));

    if (filtered.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty-state mini-empty';
      empty.innerHTML = `<p>${tables.length === 0 ? 'Nenhuma tabela encontrada no DynamoDB.' : 'Nenhuma tabela corresponde ao filtro.'}</p>`;
      dynamoTablesList.appendChild(empty);
      return;
    }

    filtered.forEach((name) => {
      const item = document.createElement('div');
      item.className = `dynamo-table-item ${state.activeTable === name ? 'active' : ''}`;
      item.innerHTML = `
        <span class="table-item-name">${name}</span>
        <span class="table-item-badge">Table</span>
      `;
      item.addEventListener('click', () => selectTable(name));
      dynamoTablesList.appendChild(item);
    });
  }

  // 3. Selecionar Tabela e Obter Metadados
  async function selectTable(tableName) {
    state.activeTable = tableName;
    renderTablesList(state.tables);

    dynamoEmptySelection.classList.add('hidden');
    dynamoTableView.classList.remove('hidden');
    dynamoActiveTableName.textContent = tableName;
    dynamoKeysBadges.innerHTML = '<span class="key-badge">Carregando esquema...</span>';

    try {
      const payload = { ...getPayloadCredentials(), tableName };
      const res = await fetch('/api/dynamodb/describe-table', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error);
      }

      state.tableMetadata = data.table;
      renderKeyBadges(data.table.keySchema);
      scanTable(false);
    } catch (err) {
      showToast(`Erro ao descrever tabela: ${err.message}`);
      dynamoKeysBadges.innerHTML = `<span class="key-badge" style="color: var(--accent-rose);">Erro no esquema</span>`;
    }
  }

  // Renderizar Badges de Chaves Primárias (PK / SK)
  function renderKeyBadges(keySchema = []) {
    dynamoKeysBadges.innerHTML = '';
    keySchema.forEach((k) => {
      const badge = document.createElement('span');
      badge.className = `key-badge ${k.keyType === 'HASH' ? 'key-badge-pk' : 'key-badge-sk'}`;
      badge.innerHTML = `<strong>${k.keyType === 'HASH' ? 'PK (Partition)' : 'SK (Sort)'}:</strong> ${k.attributeName}`;
      dynamoKeysBadges.appendChild(badge);
    });
  }

  // 4. Escanear Itens da Tabela
  async function scanTable(append = false) {
    if (!state.activeTable) return;

    spinnerDynamoScan.classList.remove('hidden');
    btnDynamoScan.disabled = true;

    try {
      const payload = {
        ...getPayloadCredentials(),
        tableName: state.activeTable,
        limit: 50,
      };

      if (append && state.lastEvaluatedKey) {
        payload.startKey = state.lastEvaluatedKey;
      }

      const res = await fetch('/api/dynamodb/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error);
      }

      if (append) {
        state.items = [...state.items, ...(data.items || [])];
      } else {
        state.items = data.items || [];
      }

      state.lastEvaluatedKey = data.lastEvaluatedKey;

      dynamoItemsStatCount.textContent = `Mostrando ${state.items.length} itens (Total escaneado: ${data.scannedCount || state.items.length})`;
      renderItemsTable(state.items);

      if (state.lastEvaluatedKey) {
        dynamoPaginationFooter.classList.remove('hidden');
      } else {
        dynamoPaginationFooter.classList.add('hidden');
      }
    } catch (err) {
      showToast(`Erro ao escanear itens: ${err.message}`);
    } finally {
      spinnerDynamoScan.classList.add('hidden');
      btnDynamoScan.disabled = false;
    }
  }

  // Renderizar Tabela de Dados e Variáveis
  function renderItemsTable(items) {
    dynamoTableHead.innerHTML = '';
    dynamoTableBody.innerHTML = '';

    if (!items || items.length === 0) {
      dynamoTableBody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">
            Nenhum item encontrado nesta tabela. Clique em <strong>➕ Nova Variável / Item</strong> para criar o primeiro.
          </td>
        </tr>
      `;
      return;
    }

    // Identificar PK e SK
    const pkName = state.tableMetadata?.keySchema?.find((k) => k.keyType === 'HASH')?.attributeName;
    const skName = state.tableMetadata?.keySchema?.find((k) => k.keyType === 'RANGE')?.attributeName;

    // Coletar todos os nomes de atributos únicos presentes nos itens
    const attrNamesSet = new Set();
    if (pkName) attrNamesSet.add(pkName);
    if (skName) attrNamesSet.add(skName);

    items.forEach((item) => {
      Object.keys(item).forEach((k) => attrNamesSet.add(k));
    });

    const allAttrNames = Array.from(attrNamesSet);

    // Criar cabeçalhos
    const headerRow = document.createElement('tr');
    
    // Coluna de Ações
    const thActions = document.createElement('th');
    thActions.textContent = 'Ações';
    thActions.style.width = '120px';
    headerRow.appendChild(thActions);

    allAttrNames.forEach((attrName) => {
      const th = document.createElement('th');
      th.textContent = attrName;
      if (attrName === pkName) {
        th.className = 'pk-header';
        th.title = 'Partition Key';
      } else if (attrName === skName) {
        th.className = 'sk-header';
        th.title = 'Sort Key';
      }
      headerRow.appendChild(th);
    });
    dynamoTableHead.appendChild(headerRow);

    // Criar linhas de dados
    const filterText = (inputFilterItems.value || '').toLowerCase().trim();

    items.forEach((item, index) => {
      // Filtro de texto em tempo de tela
      if (filterText) {
        const itemStr = JSON.stringify(item).toLowerCase();
        if (!itemStr.includes(filterText)) return;
      }

      const row = document.createElement('tr');

      // Célula de Ações
      const tdActions = document.createElement('td');
      tdActions.className = 'cell-actions';

      const btnEdit = document.createElement('button');
      btnEdit.className = 'btn-row-action';
      btnEdit.innerHTML = '✏️ Editar';
      btnEdit.title = 'Editar variáveis do item';
      btnEdit.addEventListener('click', () => openItemModal(item));

      const btnCopy = document.createElement('button');
      btnCopy.className = 'btn-row-action';
      btnCopy.innerHTML = '📋 Copiar';
      btnCopy.title = 'Copiar JSON do item';
      btnCopy.addEventListener('click', () => {
        navigator.clipboard.writeText(JSON.stringify(item, null, 2));
        showToast('JSON copiado para a área de transferência!');
      });

      const btnDel = document.createElement('button');
      btnDel.className = 'btn-row-action danger';
      btnDel.innerHTML = '🗑️';
      btnDel.title = 'Excluir item';
      btnDel.addEventListener('click', () => openDeleteModal(item));

      tdActions.appendChild(btnEdit);
      tdActions.appendChild(btnCopy);
      tdActions.appendChild(btnDel);
      row.appendChild(tdActions);

      // Células de Atributos
      allAttrNames.forEach((attrName) => {
        const td = document.createElement('td');
        const val = item[attrName];

        if (val === undefined) {
          td.innerHTML = '<span style="color: var(--text-muted);">-</span>';
        } else {
          const type = detectType(val);
          let displayVal = formatDisplayValue(val, type);
          td.innerHTML = `<span class="attr-type-pill">${type}</span> ${displayVal}`;
        }
        row.appendChild(td);
      });

      dynamoTableBody.appendChild(row);
    });
  }

  // Detectar tipo de atributo JS
  function detectType(val) {
    if (val === null) return 'Null';
    if (typeof val === 'string') return 'S';
    if (typeof val === 'number') return 'N';
    if (typeof val === 'boolean') return 'BOOL';
    if (Array.isArray(val)) return 'L';
    if (typeof val === 'object') return 'M';
    return 'S';
  }

  // Formatar valor para exibição em célula
  function formatDisplayValue(val, type) {
    if (type === 'M' || type === 'L') {
      return escapeHtml(JSON.stringify(val));
    }
    if (type === 'BOOL') {
      return val ? '<strong style="color: var(--accent-emerald);">true</strong>' : '<strong style="color: var(--accent-rose);">false</strong>';
    }
    return escapeHtml(String(val));
  }

  function escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // 5. Modal de Edição / Criação de Itens e Variáveis
  function openItemModal(item = null) {
    state.editingItem = item ? JSON.parse(JSON.stringify(item)) : null;
    state.activeTab = 'visual';

    tabBtnVisual.classList.add('active');
    tabBtnJson.classList.remove('active');
    panelDynamoVisual.classList.remove('hidden');
    panelDynamoVisual.classList.add('active');
    panelDynamoJson.classList.add('hidden');
    panelDynamoJson.classList.remove('active');

    if (item) {
      modalDynamoTitle.textContent = 'Editar Variáveis e Atributos';
      modalDynamoSubtitle.textContent = `Tabela: ${state.activeTable}`;
    } else {
      modalDynamoTitle.textContent = 'Novo Item no DynamoDB';
      modalDynamoSubtitle.textContent = `Adicione variáveis na tabela ${state.activeTable}`;
    }

    dynamoAttributesList.innerHTML = '';

    const pkName = state.tableMetadata?.keySchema?.find((k) => k.keyType === 'HASH')?.attributeName || 'id';
    const skName = state.tableMetadata?.keySchema?.find((k) => k.keyType === 'RANGE')?.attributeName;

    if (item) {
      // Preencher com atributos existentes
      Object.entries(item).forEach(([name, val]) => {
        const isPk = name === pkName || name === skName;
        addAttributeRow(name, val, isPk);
      });
      textareaDynamoJson.value = JSON.stringify(item, null, 2);
    } else {
      // Novo item: adicionar chave primária por padrão
      addAttributeRow(pkName, '', true);
      if (skName) {
        addAttributeRow(skName, '', true);
      }
      addAttributeRow('variavel_exemplo', 'valor', false);
      syncVisualToJson();
    }

    validateJson();
    modalDynamoItem.classList.remove('hidden');
  }

  // Adicionar Linha de Atributo no Editor Visual
  function addAttributeRow(name = '', value = '', isPk = false) {
    const row = document.createElement('div');
    row.className = `attribute-row ${isPk ? 'is-pk' : ''}`;

    const type = detectType(value);

    let valStr = '';
    if (type === 'M' || type === 'L') {
      valStr = JSON.stringify(value);
    } else if (value !== undefined && value !== null) {
      valStr = String(value);
    }

    row.innerHTML = `
      <input type="text" class="attr-input-name" placeholder="Nome da Variável" value="${escapeHtml(name)}" ${isPk && state.editingItem ? 'disabled' : ''} />
      <select class="attr-select-type">
        <option value="S" ${type === 'S' ? 'selected' : ''}>String (S)</option>
        <option value="N" ${type === 'N' ? 'selected' : ''}>Number (N)</option>
        <option value="BOOL" ${type === 'BOOL' ? 'selected' : ''}>Boolean (BOOL)</option>
        <option value="M" ${type === 'M' ? 'selected' : ''}>JSON / Map (M)</option>
        <option value="L" ${type === 'L' ? 'selected' : ''}>List (L)</option>
        <option value="Null" ${type === 'Null' ? 'selected' : ''}>Null</option>
      </select>
      <input type="text" class="attr-input-val" placeholder="Valor" value="${escapeHtml(valStr)}" />
      <button type="button" class="btn-remove-attr" title="Remover Atributo" ${isPk ? 'disabled style="opacity: 0.3;"' : ''}>
        🗑️
      </button>
    `;

    const inputName = row.querySelector('.attr-input-name');
    const selectType = row.querySelector('.attr-select-type');
    const inputVal = row.querySelector('.attr-input-val');
    const btnRemove = row.querySelector('.btn-remove-attr');

    const updateHandler = () => {
      syncVisualToJson();
    };

    inputName.addEventListener('input', updateHandler);
    selectType.addEventListener('change', updateHandler);
    inputVal.addEventListener('input', updateHandler);

    btnRemove.addEventListener('click', () => {
      row.remove();
      syncVisualToJson();
    });

    dynamoAttributesList.appendChild(row);
  }

  // Sincronizar Painel Visual para o JSON Raw
  function syncVisualToJson() {
    const obj = {};
    const rows = dynamoAttributesList.querySelectorAll('.attribute-row');

    rows.forEach((row) => {
      const name = row.querySelector('.attr-input-name').value.trim();
      const type = row.querySelector('.attr-select-type').value;
      const rawVal = row.querySelector('.attr-input-val').value.trim();

      if (!name) return;

      let parsedVal;
      switch (type) {
        case 'N':
          parsedVal = Number(rawVal) || 0;
          break;
        case 'BOOL':
          parsedVal = rawVal.toLowerCase() === 'true' || rawVal === '1';
          break;
        case 'Null':
          parsedVal = null;
          break;
        case 'M':
        case 'L':
          try {
            parsedVal = JSON.parse(rawVal);
          } catch (_) {
            parsedVal = rawVal;
          }
          break;
        case 'S':
        default:
          parsedVal = rawVal;
          break;
      }

      obj[name] = parsedVal;
    });

    textareaDynamoJson.value = JSON.stringify(obj, null, 2);
    validateJson();
  }

  // Sincronizar JSON Raw para o Painel Visual
  function syncJsonToVisual() {
    try {
      const parsed = JSON.parse(textareaDynamoJson.value);
      dynamoAttributesList.innerHTML = '';

      const pkName = state.tableMetadata?.keySchema?.find((k) => k.keyType === 'HASH')?.attributeName;
      const skName = state.tableMetadata?.keySchema?.find((k) => k.keyType === 'RANGE')?.attributeName;

      Object.entries(parsed).forEach(([k, v]) => {
        const isPk = k === pkName || k === skName;
        addAttributeRow(k, v, isPk);
      });
    } catch (_) {
      // Não sobrescreve se o JSON for inválido
    }
  }

  // Validar JSON em Tempo Real
  function validateJson() {
    try {
      JSON.parse(textareaDynamoJson.value);
      jsonValidationBar.classList.remove('invalid');
      jsonValidationMsg.textContent = 'JSON válido e pronto para salvar';
      return true;
    } catch (err) {
      jsonValidationBar.classList.add('invalid');
      jsonValidationMsg.textContent = `Erro de sintaxe JSON: ${err.message}`;
      return false;
    }
  }

  // 6. Salvar Item no Backend DynamoDB
  async function saveItem() {
    if (!state.activeTable) return;

    let payloadItem;
    if (state.activeTab === 'json') {
      if (!validateJson()) {
        showToast('Corrija os erros do JSON antes de salvar.');
        return;
      }
      payloadItem = JSON.parse(textareaDynamoJson.value);
    } else {
      syncVisualToJson();
      payloadItem = JSON.parse(textareaDynamoJson.value);
    }

    spinnerSaveDynamo.classList.remove('hidden');
    btnModalSaveDynamo.disabled = true;

    try {
      const body = {
        ...getPayloadCredentials(),
        tableName: state.activeTable,
        item: payloadItem,
      };

      const res = await fetch('/api/dynamodb/item/put', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error);
      }

      showToast('Item e variáveis salvos com sucesso!');
      modalDynamoItem.classList.add('hidden');
      scanTable(false);
    } catch (err) {
      showToast(`Falha ao salvar: ${err.message}`, 4000);
    } finally {
      spinnerSaveDynamo.classList.add('hidden');
      btnModalSaveDynamo.disabled = false;
    }
  }

  // 7. Modal de Exclusão de Item
  function openDeleteModal(item) {
    state.itemToDelete = item;

    const pkName = state.tableMetadata?.keySchema?.find((k) => k.keyType === 'HASH')?.attributeName || 'id';
    const skName = state.tableMetadata?.keySchema?.find((k) => k.keyType === 'RANGE')?.attributeName;

    const keyObj = { [pkName]: item[pkName] };
    if (skName && item[skName] !== undefined) {
      keyObj[skName] = item[skName];
    }

    modalDynamoDeleteKey.textContent = JSON.stringify(keyObj);
    modalDynamoDelete.classList.remove('hidden');
  }

  async function confirmDeleteItem() {
    if (!state.activeTable || !state.itemToDelete) return;

    const pkName = state.tableMetadata?.keySchema?.find((k) => k.keyType === 'HASH')?.attributeName || 'id';
    const skName = state.tableMetadata?.keySchema?.find((k) => k.keyType === 'RANGE')?.attributeName;

    const keyObj = { [pkName]: state.itemToDelete[pkName] };
    if (skName && state.itemToDelete[skName] !== undefined) {
      keyObj[skName] = state.itemToDelete[skName];
    }

    try {
      const body = {
        ...getPayloadCredentials(),
        tableName: state.activeTable,
        key: keyObj,
      };

      const res = await fetch('/api/dynamodb/item/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error);
      }

      showToast('Item excluído com sucesso.');
      modalDynamoDelete.classList.add('hidden');
      scanTable(false);
    } catch (err) {
      showToast(`Erro ao excluir: ${err.message}`);
    }
  }

  // Configurar Event Listeners
  function setupEventListeners() {
    // Alternar Gaveta de Credenciais
    btnToggleDynamoCreds?.addEventListener('click', () => {
      drawerDynamoCreds.classList.toggle('hidden');
    });

    // Mostrar/Ocultar Segredo
    btnToggleSecretVisibility?.addEventListener('click', () => {
      if (inputDynamoSecretKey.type === 'password') {
        inputDynamoSecretKey.type = 'text';
        btnToggleSecretVisibility.textContent = '🔒 Ocultar';
      } else {
        inputDynamoSecretKey.type = 'password';
        btnToggleSecretVisibility.textContent = '👁️ Mostrar';
      }
    });

    // Presets de Endpoint
    presetDynamoAws?.addEventListener('click', () => {
      inputDynamoEndpoint.value = '';
      inputDynamoRegion.value = 'us-east-1';
      showToast('Preset: AWS Cloud (Nuvem)');
    });

    presetDynamoDocker?.addEventListener('click', () => {
      inputDynamoEndpoint.value = 'http://dynamodb-local:8000';
      inputDynamoAccessKey.value = inputDynamoAccessKey.value || 'local';
      inputDynamoSecretKey.value = inputDynamoSecretKey.value || 'local';
      showToast('Preset: DynamoDB Local Docker');
    });

    presetDynamoHost?.addEventListener('click', () => {
      inputDynamoEndpoint.value = 'http://localhost:8000';
      inputDynamoAccessKey.value = inputDynamoAccessKey.value || 'local';
      inputDynamoSecretKey.value = inputDynamoSecretKey.value || 'local';
      showToast('Preset: DynamoDB Localhost:8000');
    });

    presetDynamoLocalstack?.addEventListener('click', () => {
      inputDynamoEndpoint.value = 'http://localhost:4566';
      inputDynamoAccessKey.value = inputDynamoAccessKey.value || 'test';
      inputDynamoSecretKey.value = inputDynamoSecretKey.value || 'test';
      showToast('Preset: LocalStack :4566');
    });

    // Conectar & Listar Tabelas
    btnDynamoConnect?.addEventListener('click', () => connectAndListTables(true));
    btnRefreshDynamoTables?.addEventListener('click', () => connectAndListTables(false));

    // Filtrar Tabelas
    inputSearchTables?.addEventListener('input', () => renderTablesList(state.tables));

    // Ações de Tabela
    btnDynamoScan?.addEventListener('click', () => scanTable(false));
    btnDynamoNewItem?.addEventListener('click', () => openItemModal(null));
    btnDynamoLoadMore?.addEventListener('click', () => scanTable(true));
    inputFilterItems?.addEventListener('input', () => renderItemsTable(state.items));

    // Tabs do Modal
    tabBtnVisual?.addEventListener('click', () => {
      state.activeTab = 'visual';
      tabBtnVisual.classList.add('active');
      tabBtnJson.classList.remove('active');
      panelDynamoVisual.classList.remove('hidden');
      panelDynamoVisual.classList.add('active');
      panelDynamoJson.classList.add('hidden');
      panelDynamoJson.classList.remove('active');
      syncJsonToVisual();
    });

    tabBtnJson?.addEventListener('click', () => {
      state.activeTab = 'json';
      tabBtnJson.classList.add('active');
      tabBtnVisual.classList.remove('active');
      panelDynamoJson.classList.remove('hidden');
      panelDynamoJson.classList.add('active');
      panelDynamoVisual.classList.add('hidden');
      panelDynamoVisual.classList.remove('active');
      syncVisualToJson();
    });

    // Adicionar Atributo
    btnAddAttribute?.addEventListener('click', () => {
      addAttributeRow('', '', false);
    });

    // Validação JSON no textarea
    textareaDynamoJson?.addEventListener('input', validateJson);

    // Salvar e Cancelar Modal
    btnModalSaveDynamo?.addEventListener('click', saveItem);
    btnModalCancelDynamo?.addEventListener('click', () => {
      modalDynamoItem.classList.add('hidden');
    });

    // Modal de Confirmação de Exclusão
    btnModalConfirmDeleteDynamo?.addEventListener('click', confirmDeleteItem);
    btnModalCancelDeleteDynamo?.addEventListener('click', () => {
      modalDynamoDelete.classList.add('hidden');
    });
  }

  // Inicialização ao carregar o DOM
  document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    loadInitialConfig();
  });
})();
