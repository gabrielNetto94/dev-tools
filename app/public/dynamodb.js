// DynamoDB Workbench - Client Controller

(() => {
  const { icon, esc, toast, copy, setNavStatus } = window.DEVinho;

  // Estado local do DynamoDB Workbench
  const state = {
    isEnvConfigured: false,
    isConnected: false,
    tables: [],
    activeTable: null,
    tableMetadata: null,
    items: [],
    lastEvaluatedKey: null,
    editingItem: null,
    activeTab: 'visual',
    isDirty: false,
    itemToDelete: null,
  };

  const TYPE_LABELS = { S: 'String', N: 'Number', BOOL: 'Boolean', M: 'Map', L: 'List', Null: 'Null' };

  const PRESETS = {
    'preset-dynamo-aws': { endpoint: '', fallbackKey: null },
    'preset-dynamo-docker': { endpoint: 'http://dynamodb-local:8000', fallbackKey: 'local' },
    'preset-dynamo-host': { endpoint: 'http://localhost:8000', fallbackKey: 'local' },
    'preset-dynamo-localstack': { endpoint: 'http://localhost:4566', fallbackKey: 'test' },
  };

  // Elementos do DOM - Conexão e Credenciais
  const titleDynamodb = document.getElementById('title-dynamodb');
  const dynamoStatusDot = document.getElementById('dynamo-status-dot');
  const dynamoStatusText = document.getElementById('dynamo-status-text');
  const btnToggleDynamoCreds = document.getElementById('btn-toggle-dynamo-creds');
  const drawerDynamoCreds = document.getElementById('drawer-dynamo-creds');
  const dynamoWorkbench = document.getElementById('dynamo-workbench');
  const dynamoEnvIndicator = document.getElementById('dynamo-env-indicator');
  const dynamoEnvKey = document.getElementById('dynamo-env-key');
  const dynamoConnectError = document.getElementById('dynamo-connect-error');
  const dynamoConnectErrorText = document.getElementById('dynamo-connect-error-text');

  const inputDynamoRegion = document.getElementById('input-dynamo-region');
  const inputDynamoEndpoint = document.getElementById('input-dynamo-endpoint');
  const inputDynamoAccessKey = document.getElementById('input-dynamo-access-key');
  const inputDynamoSecretKey = document.getElementById('input-dynamo-secret-key');
  const inputDynamoSessionToken = document.getElementById('input-dynamo-session-token');
  const btnToggleSecretVisibility = document.getElementById('btn-toggle-secret-visibility');
  const btnDynamoConnect = document.getElementById('btn-dynamo-connect');
  const spinnerDynamoConnect = document.getElementById('spinner-dynamo-connect');

  // Elementos do DOM - Tabelas
  const dynamoTablesCount = document.getElementById('dynamo-tables-count');
  const btnRefreshDynamoTables = document.getElementById('btn-refresh-dynamo-tables');
  const inputSearchTables = document.getElementById('input-search-tables');
  const dynamoTablesList = document.getElementById('dynamo-tables-list');

  // Elementos do DOM - Itens da Tabela
  const dynamoEmptySelection = document.getElementById('dynamo-empty-selection');
  const dynamoTableView = document.getElementById('dynamo-table-view');
  const dynamoKeysBadges = document.getElementById('dynamo-keys-badges');
  const dynamoItemsTotal = document.getElementById('dynamo-items-total');
  const btnDynamoScan = document.getElementById('btn-dynamo-scan');
  const iconDynamoScan = document.getElementById('icon-dynamo-scan');
  const btnDynamoNewItem = document.getElementById('btn-dynamo-new-item');
  const dynamoItemsStatCount = document.getElementById('dynamo-items-stat-count');
  const inputFilterItems = document.getElementById('input-filter-items');
  const dynamoDataTable = document.getElementById('dynamo-data-table');
  const dynamoTableHead = document.getElementById('dynamo-table-head');
  const dynamoTableBody = document.getElementById('dynamo-table-body');
  const dynamoItemsEmpty = document.getElementById('dynamo-items-empty');
  const dynamoItemsEmptyTitle = document.getElementById('dynamo-items-empty-title');
  const dynamoItemsEmptyText = document.getElementById('dynamo-items-empty-text');
  const btnDynamoLoadMore = document.getElementById('btn-dynamo-load-more');

  // Elementos do DOM - Editor de Item
  const modalDynamoItem = document.getElementById('modal-dynamo-item');
  const modalDynamoTitle = document.getElementById('modal-dynamo-title');
  const modalDynamoSubtitle = document.getElementById('modal-dynamo-subtitle');
  const btnCloseDynamoEditor = document.getElementById('btn-close-dynamo-editor');
  const tabBtnVisual = document.getElementById('tab-btn-visual');
  const tabBtnJson = document.getElementById('tab-btn-json');
  const btnFormatJson = document.getElementById('btn-format-json');
  const panelDynamoVisual = document.getElementById('panel-dynamo-visual');
  const panelDynamoJson = document.getElementById('panel-dynamo-json');
  const dynamoAttributesList = document.getElementById('dynamo-attributes-list');
  const btnAddAttribute = document.getElementById('btn-add-attribute');
  const textareaDynamoJson = document.getElementById('textarea-dynamo-json');
  const jsonValidationBar = document.getElementById('json-validation-bar');
  const jsonValidationMsg = document.getElementById('json-validation-msg');
  const dynamoEditorStatus = document.getElementById('dynamo-editor-status');
  const dynamoEditorStatusDot = document.getElementById('dynamo-editor-status-dot');
  const dynamoEditorStatusText = document.getElementById('dynamo-editor-status-text');
  const btnModalCancelDynamo = document.getElementById('btn-modal-cancel-dynamo');
  const btnModalSaveDynamo = document.getElementById('btn-modal-save-dynamo');
  const spinnerSaveDynamo = document.getElementById('spinner-save-dynamo');

  // Elementos do DOM - Modal Delete
  const modalDynamoDelete = document.getElementById('modal-dynamo-delete');
  const modalDynamoDeleteTable = document.getElementById('modal-dynamo-delete-table');
  const modalDynamoDeleteKey = document.getElementById('modal-dynamo-delete-key');
  const btnModalCancelDeleteDynamo = document.getElementById('btn-modal-cancel-delete-dynamo');
  const btnModalConfirmDeleteDynamo = document.getElementById('btn-modal-confirm-delete-dynamo');

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

  function getKeyNames() {
    const schema = state.tableMetadata?.keySchema || [];
    return {
      pkName: schema.find((k) => k.keyType === 'HASH')?.attributeName,
      skName: schema.find((k) => k.keyType === 'RANGE')?.attributeName,
    };
  }

  function endpointLabel() {
    const endpoint = inputDynamoEndpoint.value.trim();
    return endpoint ? endpoint.replace(/^https?:\/\//, '') : 'AWS';
  }

  // --- Status, título e painel de conexão ---
  function setStatus(dotState, label, withTarget = false) {
    dynamoStatusDot.className = `dot ${dotState}`.trim();
    dynamoStatusText.innerHTML = withTarget
      ? `<b>${esc(label)}</b> · <span class="mono">${esc(endpointLabel())}</span> · ${esc(inputDynamoRegion.value.trim())}`
      : `<b>${esc(label)}</b>`;
    setNavStatus('dynamodb', dotState, label);
  }

  function updateTitle() {
    if (state.activeTable && state.isConnected) {
      titleDynamodb.innerHTML = `<span class="muted">DynamoDB</span><span class="faint" aria-hidden="true">/</span><span class="mono">${esc(state.activeTable)}</span>`;
    } else {
      titleDynamodb.textContent = 'DynamoDB Workbench';
    }
  }

  // O painel de conexão e o workbench ocupam o mesmo espaço
  function setConnectOpen(open) {
    drawerDynamoCreds.classList.toggle('hidden', !open);
    dynamoWorkbench.classList.toggle('hidden', open);
    btnToggleDynamoCreds.setAttribute('aria-expanded', String(open));
  }

  function syncPresetChips() {
    const endpoint = inputDynamoEndpoint.value.trim();
    Object.entries(PRESETS).forEach(([id, preset]) => {
      document.getElementById(id).setAttribute('aria-pressed', String(preset.endpoint === endpoint));
    });
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
        syncPresetChips();

        if (data.configuredViaEnv) {
          dynamoEnvIndicator.classList.remove('hidden');
          dynamoEnvKey.textContent = data.maskedAccessKey ? `(${data.maskedAccessKey})` : '';
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
    btnRefreshDynamoTables.disabled = true;
    dynamoConnectError.classList.add('hidden');
    inputDynamoEndpoint.classList.remove('is-error');
    renderTablesSkeleton();

    try {
      const res = await fetch('/api/dynamodb/tables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(getPayloadCredentials()),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Erro desconhecido ao listar tabelas.');
      }

      state.tables = data.tables || [];
      state.isConnected = true;

      // A tabela aberta pode não existir na nova conexão
      if (state.activeTable && !state.tables.includes(state.activeTable)) {
        clearSelection();
      }

      renderTablesList(state.tables);
      setStatus('ok', 'Conectado', true);
      setConnectOpen(false);
      updateTitle();

      if (autoSelectFirst && state.tables.length > 0 && !state.activeTable) {
        selectTable(state.tables[0]);
      }
    } catch (err) {
      state.isConnected = false;
      state.tables = [];
      renderTablesList(state.tables);
      setStatus('warn', 'Não conectado');
      dynamoConnectErrorText.textContent = err.message;
      dynamoConnectError.classList.remove('hidden');
      inputDynamoEndpoint.classList.toggle('is-error', !!inputDynamoEndpoint.value.trim());
      setConnectOpen(true);
      updateTitle();
    } finally {
      spinnerDynamoConnect.classList.add('hidden');
      btnDynamoConnect.disabled = false;
      btnRefreshDynamoTables.disabled = false;
    }
  }

  function clearSelection() {
    state.activeTable = null;
    state.tableMetadata = null;
    state.items = [];
    state.lastEvaluatedKey = null;
    closeItemEditor();
    dynamoTableView.classList.add('hidden');
    dynamoEmptySelection.classList.remove('hidden');
  }

  function renderTablesSkeleton() {
    dynamoTablesList.classList.add('is-loading');
    dynamoTablesList.innerHTML = [70, 52, 80, 46, 64, 58]
      .map((w) => `<div class="sk" style="width: ${w}%"></div>`)
      .join('');
  }

  // Renderizar Lista de Tabelas
  function renderTablesList(tables) {
    dynamoTablesList.classList.remove('is-loading');
    dynamoTablesList.innerHTML = '';
    dynamoTablesCount.textContent = tables.length;

    const filter = (inputSearchTables.value || '').toLowerCase().trim();
    const filtered = tables.filter((t) => t.toLowerCase().includes(filter));

    if (filtered.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'hint';
      empty.textContent = tables.length === 0 ? 'Nenhuma tabela nesta conexão.' : 'Nenhuma tabela corresponde ao filtro.';
      dynamoTablesList.appendChild(empty);
      return;
    }

    filtered.forEach((name) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.title = name;
      item.setAttribute('aria-current', String(state.activeTable === name));
      item.innerHTML = `${icon('table', true)}<span>${esc(name)}</span>`;
      item.addEventListener('click', () => selectTable(name));
      dynamoTablesList.appendChild(item);
    });
  }

  // 3. Selecionar Tabela e Obter Metadados
  async function selectTable(tableName) {
    closeItemEditor();
    state.activeTable = tableName;
    state.tableMetadata = null;
    state.items = [];
    state.lastEvaluatedKey = null;
    inputFilterItems.value = '';
    renderTablesList(state.tables);
    updateTitle();

    dynamoEmptySelection.classList.add('hidden');
    dynamoTableView.classList.remove('hidden');
    dynamoKeysBadges.innerHTML = '';
    dynamoItemsTotal.textContent = '';
    dynamoTableHead.innerHTML = '';
    dynamoTableBody.innerHTML = '';
    dynamoItemsEmpty.classList.add('hidden');
    dynamoItemsStatCount.textContent = 'Carregando itens…';

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
      renderKeyBadges(data.table);
      dynamoItemsTotal.textContent = `~${Number(data.table.itemCount || 0).toLocaleString('pt-BR')} itens`;
      scanTable(false);
    } catch (err) {
      dynamoItemsStatCount.textContent = 'Não foi possível ler o esquema da tabela.';
      toast(`Erro ao descrever tabela: ${err.message}`, 'err', 5000);
    }
  }

  function keyBadge(role, name, detail) {
    return `<span class="key"><em>${role}</em><b>${esc(name)}</b>${esc(detail)}</span>`;
  }

  // Renderizar Badges de Chaves Primárias (PK / SK)
  function renderKeyBadges(table) {
    const types = Object.fromEntries((table.attributeDefinitions || []).map((a) => [a.attributeName, a.attributeType]));
    dynamoKeysBadges.innerHTML = (table.keySchema || [])
      .map((k) => keyBadge(k.keyType === 'HASH' ? 'PK' : 'SK', k.attributeName, types[k.attributeName] || ''))
      .join('');
  }

  // 4. Escanear Itens da Tabela
  async function scanTable(append = false) {
    if (!state.activeTable) return;

    const tableName = state.activeTable;
    iconDynamoScan.classList.add('spin');
    btnDynamoScan.disabled = true;
    btnDynamoLoadMore.disabled = true;

    try {
      const payload = {
        ...getPayloadCredentials(),
        tableName,
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

      // A pessoa pode ter trocado de tabela enquanto o scan rodava
      if (tableName !== state.activeTable) return;

      if (append) {
        state.items = [...state.items, ...(data.items || [])];
      } else {
        state.items = data.items || [];
      }

      state.lastEvaluatedKey = data.lastEvaluatedKey;
      renderItemsTable(state.items);
      btnDynamoLoadMore.classList.toggle('hidden', !state.lastEvaluatedKey);
    } catch (err) {
      dynamoItemsStatCount.textContent = 'Não foi possível carregar os itens.';
      toast(`Erro ao escanear itens: ${err.message}`, 'err', 5000);
    } finally {
      iconDynamoScan.classList.remove('spin');
      btnDynamoScan.disabled = false;
      btnDynamoLoadMore.disabled = false;
    }
  }

  function showItemsEmpty(title, text) {
    dynamoDataTable.classList.add('hidden');
    dynamoItemsEmptyTitle.textContent = title;
    dynamoItemsEmptyText.innerHTML = text;
    dynamoItemsEmpty.classList.remove('hidden');
  }

  // Renderizar Grade de Itens
  function renderItemsTable(items) {
    dynamoTableHead.innerHTML = '';
    dynamoTableBody.innerHTML = '';
    dynamoDataTable.classList.remove('hidden');
    dynamoItemsEmpty.classList.add('hidden');

    if (!items || items.length === 0) {
      showItemsEmpty('Tabela vazia', 'Clique em <b>Novo item</b> para criar o primeiro.');
      dynamoItemsStatCount.textContent = 'Nenhum item carregado';
      return;
    }

    const { pkName, skName } = getKeyNames();

    // Coletar todos os nomes de atributos únicos, com as chaves na frente
    const attrTypes = new Map();
    if (pkName) attrTypes.set(pkName, null);
    if (skName) attrTypes.set(skName, null);

    items.forEach((item) => {
      Object.entries(item).forEach(([name, val]) => {
        if (!attrTypes.get(name)) attrTypes.set(name, detectType(val));
      });
    });

    const allAttrNames = Array.from(attrTypes.keys());

    // Cabeçalhos
    const headerRow = document.createElement('tr');
    allAttrNames.forEach((attrName) => {
      const th = document.createElement('th');
      th.scope = 'col';
      const type = attrTypes.get(attrName);
      if (attrName === pkName) {
        th.className = 'k pk';
        th.title = 'Partition Key';
        th.innerHTML = `<span class="kb">PK</span>${esc(attrName)}`;
      } else if (attrName === skName) {
        th.className = 'k';
        th.title = 'Sort Key';
        th.innerHTML = `<span class="kb">SK</span>${esc(attrName)}`;
      } else {
        if (type === 'N') th.className = 'num';
        th.innerHTML = `${esc(attrName)}${type ? `<span class="ty">${type === 'Null' ? 'NULL' : type}</span>` : ''}`;
      }
      headerRow.appendChild(th);
    });

    const thActions = document.createElement('th');
    thActions.className = 'act';
    thActions.scope = 'col';
    thActions.innerHTML = '<span class="sr">Ações</span>';
    headerRow.appendChild(thActions);
    dynamoTableHead.appendChild(headerRow);

    // Linhas de dados, com filtro de texto sobre os itens já carregados
    const filterText = (inputFilterItems.value || '').toLowerCase().trim();
    let shown = 0;

    items.forEach((item) => {
      if (filterText && !JSON.stringify(item).toLowerCase().includes(filterText)) return;
      shown += 1;

      const row = document.createElement('tr');
      if (item === state.editingItem) row.className = 'sel';

      allAttrNames.forEach((attrName) => {
        const td = document.createElement('td');
        const val = item[attrName];
        const type = detectType(val);

        if (attrName === pkName) td.className = 'k pk';
        else if (attrName === skName) td.className = 'k';
        else if (val === undefined || val === null) td.className = 'nul';
        else if (type === 'N') td.className = 'num';

        if (val === undefined) {
          td.textContent = '—';
        } else {
          td.textContent = formatDisplayValue(val, type);
          td.title = td.textContent;
        }
        row.appendChild(td);
      });

      const tdActions = document.createElement('td');
      tdActions.className = 'act';
      tdActions.innerHTML = `
        <div class="row-actions">
          <button type="button" class="iconbtn" aria-label="Editar item" title="Editar">${icon('edit', true)}</button>
          <button type="button" class="iconbtn" aria-label="Copiar JSON do item" title="Copiar JSON">${icon('copy', true)}</button>
          <button type="button" class="iconbtn danger" aria-label="Excluir item" title="Excluir">${icon('trash', true)}</button>
        </div>
      `;
      const [btnEdit, btnCopy, btnDel] = tdActions.querySelectorAll('button');
      btnEdit.addEventListener('click', () => openItemEditor(item));
      btnCopy.addEventListener('click', () => copy(JSON.stringify(item, null, 2), 'JSON copiado para a área de transferência'));
      btnDel.addEventListener('click', () => openDeleteModal(item));
      row.appendChild(tdActions);

      dynamoTableBody.appendChild(row);
    });

    if (shown === 0) {
      showItemsEmpty('Nenhum item corresponde ao filtro', 'O filtro vale só para os itens já carregados. Carregue mais ou limpe a busca.');
    }

    const loaded = items.length === 1 ? 'item carregado' : 'itens carregados';
    const attrs = `${allAttrNames.length} ${allAttrNames.length === 1 ? 'atributo' : 'atributos'}`;
    dynamoItemsStatCount.innerHTML = filterText
      ? `<b>${shown}</b> de ${items.length} ${loaded} · ${attrs}`
      : `<b>${items.length}</b> ${loaded} · ${attrs}`;
  }

  // Detectar tipo de atributo JS
  function detectType(val) {
    if (val === undefined) return null;
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
    if (type === 'Null') return 'null';
    if (type === 'M' || type === 'L') return JSON.stringify(val);
    return String(val);
  }

  // 5. Editor de Item (painel lateral)
  function setActiveTab(tab) {
    state.activeTab = tab;
    const isJson = tab === 'json';
    tabBtnVisual.setAttribute('aria-selected', String(!isJson));
    tabBtnJson.setAttribute('aria-selected', String(isJson));
    panelDynamoVisual.classList.toggle('hidden', isJson);
    panelDynamoJson.classList.toggle('hidden', !isJson);
    btnFormatJson.classList.toggle('hidden', !isJson);
    updateEditorStatus();
  }

  function setDirty(dirty) {
    state.isDirty = dirty;
    updateEditorStatus();
  }

  // Rodapé do editor: JSON inválido bloqueia o salvamento
  function updateEditorStatus() {
    const jsonInvalid = state.activeTab === 'json' && !validateJson();
    btnModalSaveDynamo.disabled = jsonInvalid;
    dynamoEditorStatus.classList.toggle('hidden', !jsonInvalid && !state.isDirty);
    dynamoEditorStatusDot.className = `dot ${jsonInvalid ? 'err' : 'warn'}`;
    dynamoEditorStatusText.textContent = jsonInvalid ? 'JSON inválido' : 'Alterações não salvas';
  }

  function openItemEditor(item = null) {
    const { pkName = 'id', skName } = getKeyNames();
    state.editingItem = item;

    dynamoAttributesList.innerHTML = '';

    if (item) {
      modalDynamoTitle.textContent = 'Editar item';
      modalDynamoSubtitle.textContent = [pkName, skName]
        .filter((name) => name && item[name] !== undefined)
        .map((name) => `${name} = ${item[name]}`)
        .join(' · ');

      // Chaves primeiro, depois os demais atributos
      const names = [pkName, skName, ...Object.keys(item)].filter((name, i, all) => name in item && all.indexOf(name) === i);
      names.forEach((name) => addAttributeRow(name, item[name]));
      textareaDynamoJson.value = JSON.stringify(item, null, 2);
    } else {
      modalDynamoTitle.textContent = 'Novo item';
      modalDynamoSubtitle.textContent = state.activeTable;

      addAttributeRow(pkName, '');
      if (skName) addAttributeRow(skName, '');
      addAttributeRow('', '');
      syncVisualToJson();
    }

    setActiveTab('visual');
    setDirty(false);
    modalDynamoItem.classList.remove('hidden');
    renderItemsTable(state.items);

    const firstValue = dynamoAttributesList.querySelector('.attr-input-val');
    if (firstValue) firstValue.focus();
  }

  function closeItemEditor() {
    if (modalDynamoItem.classList.contains('hidden')) return;
    modalDynamoItem.classList.add('hidden');
    state.editingItem = null;
    state.isDirty = false;
    renderItemsTable(state.items);
  }

  // Adicionar Linha de Atributo no Editor Visual
  function addAttributeRow(name = '', value = '') {
    const { pkName, skName } = getKeyNames();
    const keyRole = name && name === pkName ? 'PK' : name && name === skName ? 'SK' : null;
    const type = detectType(value) || 'S';

    let valStr = '';
    if (type === 'M' || type === 'L') {
      valStr = JSON.stringify(value);
    } else if (value !== undefined && value !== null) {
      valStr = String(value);
    }

    const row = document.createElement('div');
    row.className = 'attr';
    if (keyRole) row.dataset.key = keyRole;

    const nameInput = `<input type="text" class="input mono attr-input-name" placeholder="nome" aria-label="Nome do atributo" value="${esc(name)}" ${keyRole ? 'readonly' : ''} />`;
    const options = Object.entries(TYPE_LABELS)
      .map(([code, label]) => `<option value="${code}" ${type === code ? 'selected' : ''}>${label}</option>`)
      .join('');

    row.innerHTML = `
      ${keyRole ? `<div class="keyname"><em>${keyRole}</em>${nameInput}</div>` : nameInput}
      <div class="affix">
        <select class="input attr-select-type" aria-label="Tipo">${options}</select>
        ${icon('chevron', true)}
      </div>
      <input type="text" class="input mono attr-input-val" placeholder="valor" aria-label="Valor" value="${esc(valStr)}" />
      ${keyRole ? '<span></span>' : `<button type="button" class="iconbtn danger btn-remove-attr" aria-label="Remover atributo" title="Remover atributo">${icon('close', true)}</button>`}
    `;

    row.querySelector('.attr-input-name').addEventListener('input', syncVisualToJson);
    row.querySelector('.attr-select-type').addEventListener('change', syncVisualToJson);
    row.querySelector('.attr-input-val').addEventListener('input', syncVisualToJson);
    row.querySelector('.btn-remove-attr')?.addEventListener('click', () => {
      row.remove();
      syncVisualToJson();
      setDirty(true);
    });

    dynamoAttributesList.appendChild(row);
    markLastKeyRow();
    return row;
  }

  // Separa visualmente as chaves dos demais atributos
  function markLastKeyRow() {
    const keyRows = dynamoAttributesList.querySelectorAll('.attr[data-key]');
    keyRows.forEach((row, i) => row.classList.toggle('sep', i === keyRows.length - 1));
  }

  // Sincronizar Painel Visual para o JSON
  function syncVisualToJson() {
    const obj = {};
    const rows = dynamoAttributesList.querySelectorAll('.attr');

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

  // Sincronizar JSON para o Painel Visual
  function syncJsonToVisual() {
    try {
      const parsed = JSON.parse(textareaDynamoJson.value);
      dynamoAttributesList.innerHTML = '';
      Object.entries(parsed).forEach(([k, v]) => addAttributeRow(k, v));
    } catch (_) {
      // Não sobrescreve se o JSON for inválido
    }
  }

  // Validar JSON em Tempo Real
  function validateJson() {
    let valid = true;
    try {
      JSON.parse(textareaDynamoJson.value);
      jsonValidationMsg.textContent = 'JSON válido';
    } catch (err) {
      valid = false;
      jsonValidationMsg.textContent = err.message;
    }
    jsonValidationBar.classList.toggle('err', !valid);
    textareaDynamoJson.classList.toggle('is-error', !valid);
    textareaDynamoJson.setAttribute('aria-invalid', String(!valid));
    return valid;
  }

  // 6. Salvar Item no Backend DynamoDB
  async function saveItem() {
    if (!state.activeTable) return;

    if (state.activeTab === 'json') {
      if (!validateJson()) {
        toast('Corrija os erros do JSON antes de salvar.', 'err');
        return;
      }
    } else {
      syncVisualToJson();
    }
    const payloadItem = JSON.parse(textareaDynamoJson.value);

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

      toast('Item salvo');
      closeItemEditor();
      scanTable(false);
    } catch (err) {
      toast(`Falha ao salvar: ${err.message}`, 'err', 5000);
    } finally {
      spinnerSaveDynamo.classList.add('hidden');
      btnModalSaveDynamo.disabled = false;
    }
  }

  // 7. Modal de Exclusão de Item
  function getItemKey(item) {
    const { pkName = 'id', skName } = getKeyNames();
    const keyObj = { [pkName]: item[pkName] };
    if (skName && item[skName] !== undefined) {
      keyObj[skName] = item[skName];
    }
    return keyObj;
  }

  function openDeleteModal(item) {
    state.itemToDelete = item;

    const { skName } = getKeyNames();
    modalDynamoDeleteTable.textContent = state.activeTable;
    modalDynamoDeleteKey.innerHTML = Object.entries(getItemKey(item))
      .map(([name, val]) => keyBadge(name === skName ? 'SK' : 'PK', name, String(val)))
      .join('');
    modalDynamoDelete.classList.remove('hidden');
    btnModalCancelDeleteDynamo.focus();
  }

  function closeDeleteModal() {
    modalDynamoDelete.classList.add('hidden');
    state.itemToDelete = null;
  }

  async function confirmDeleteItem() {
    if (!state.activeTable || !state.itemToDelete) return;

    btnModalConfirmDeleteDynamo.disabled = true;
    try {
      const body = {
        ...getPayloadCredentials(),
        tableName: state.activeTable,
        key: getItemKey(state.itemToDelete),
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

      if (state.itemToDelete === state.editingItem) closeItemEditor();
      toast('Item excluído');
      closeDeleteModal();
      scanTable(false);
    } catch (err) {
      toast(`Erro ao excluir: ${err.message}`, 'err', 5000);
    } finally {
      btnModalConfirmDeleteDynamo.disabled = false;
    }
  }

  // Configurar Event Listeners
  function setupEventListeners() {
    // Abrir / fechar painel de conexão (só fecha se já houver conexão)
    btnToggleDynamoCreds.addEventListener('click', () => {
      const isOpen = !drawerDynamoCreds.classList.contains('hidden');
      if (isOpen && !state.isConnected) return;
      setConnectOpen(!isOpen);
    });

    // Mostrar/Ocultar Segredo
    btnToggleSecretVisibility.addEventListener('click', () => {
      const show = inputDynamoSecretKey.type === 'password';
      inputDynamoSecretKey.type = show ? 'text' : 'password';
      const label = show ? 'Ocultar secret' : 'Mostrar secret';
      btnToggleSecretVisibility.setAttribute('aria-label', label);
      btnToggleSecretVisibility.title = label;
    });

    // Atalhos de Endpoint
    Object.entries(PRESETS).forEach(([id, preset]) => {
      document.getElementById(id).addEventListener('click', () => {
        inputDynamoEndpoint.value = preset.endpoint;
        if (preset.fallbackKey) {
          inputDynamoAccessKey.value = inputDynamoAccessKey.value || preset.fallbackKey;
          inputDynamoSecretKey.value = inputDynamoSecretKey.value || preset.fallbackKey;
        } else {
          inputDynamoRegion.value = inputDynamoRegion.value || 'us-east-1';
        }
        syncPresetChips();
      });
    });
    inputDynamoEndpoint.addEventListener('input', syncPresetChips);

    // Conectar & Listar Tabelas
    btnDynamoConnect.addEventListener('click', () => connectAndListTables(true));
    btnRefreshDynamoTables.addEventListener('click', () => connectAndListTables(false));

    // Filtrar Tabelas
    inputSearchTables.addEventListener('input', () => renderTablesList(state.tables));

    // Ações de Tabela
    btnDynamoScan.addEventListener('click', () => scanTable(false));
    btnDynamoNewItem.addEventListener('click', () => openItemEditor(null));
    btnDynamoLoadMore.addEventListener('click', () => scanTable(true));
    inputFilterItems.addEventListener('input', () => renderItemsTable(state.items));

    // Abas do Editor
    tabBtnVisual.addEventListener('click', () => {
      syncJsonToVisual();
      setActiveTab('visual');
    });

    tabBtnJson.addEventListener('click', () => {
      syncVisualToJson();
      setActiveTab('json');
    });

    btnFormatJson.addEventListener('click', () => {
      if (!validateJson()) return;
      textareaDynamoJson.value = JSON.stringify(JSON.parse(textareaDynamoJson.value), null, 2);
    });

    // Adicionar Atributo
    btnAddAttribute.addEventListener('click', () => {
      addAttributeRow('', '').querySelector('.attr-input-name').focus();
    });

    // Qualquer edição no painel marca alterações pendentes
    modalDynamoItem.addEventListener('input', () => setDirty(true));

    // Salvar e Fechar Editor
    btnModalSaveDynamo.addEventListener('click', saveItem);
    btnModalCancelDynamo.addEventListener('click', closeItemEditor);
    btnCloseDynamoEditor.addEventListener('click', closeItemEditor);

    // Modal de Confirmação de Exclusão
    btnModalConfirmDeleteDynamo.addEventListener('click', confirmDeleteItem);
    btnModalCancelDeleteDynamo.addEventListener('click', closeDeleteModal);
    modalDynamoDelete.addEventListener('click', (e) => {
      if (e.target === modalDynamoDelete) closeDeleteModal();
    });

    // Esc fecha primeiro o modal, depois o editor
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (!modalDynamoDelete.classList.contains('hidden')) closeDeleteModal();
      else closeItemEditor();
    });
  }

  // Inicialização ao carregar o DOM
  document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    setStatus('', 'Não conectado');
    loadInitialConfig();
  });
})();
