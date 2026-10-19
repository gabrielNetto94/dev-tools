// DocuSign Token Generator - Client-side Controller

document.addEventListener('DOMContentLoaded', () => {
  const { esc, toast, copy } = window.DEVinho;

  // Elementos do Formulário
  const presetDemo = document.getElementById('preset-docusign-demo');
  const presetProd = document.getElementById('preset-docusign-prod');
  const inputIntegrationKey = document.getElementById('input-docusign-integration-key');
  const inputUserId = document.getElementById('input-docusign-user-id');
  const inputAccountId = document.getElementById('input-docusign-account-id');
  const inputPrivateKey = document.getElementById('input-docusign-private-key');
  const filePrivateKey = document.getElementById('file-docusign-private-key');
  const inputExpires = document.getElementById('input-docusign-expires');
  const checkRemember = document.getElementById('check-docusign-remember');

  // Botões de Ação
  const btnGenerateToken = document.getElementById('btn-docusign-generate-token');
  const btnGenerateJwt = document.getElementById('btn-docusign-generate-jwt');
  const btnGetConsent = document.getElementById('btn-docusign-get-consent');
  const btnClear = document.getElementById('btn-docusign-clear');
  const spinnerToken = document.getElementById('spinner-docusign-token');

  // Alertas e Resultados
  const alertError = document.getElementById('docusign-error');
  const errorTitle = document.getElementById('docusign-error-title');
  const errorText = document.getElementById('docusign-error-text');
  const alertConsent = document.getElementById('docusign-consent-alert');
  const linkConsent = document.getElementById('link-docusign-consent');
  const btnCopyConsent = document.getElementById('btn-copy-docusign-consent');

  const panelResult = document.getElementById('docusign-result');
  const resultTitle = document.getElementById('docusign-result-title');
  const resultMeta = document.getElementById('docusign-result-meta');
  const boxAccessToken = document.getElementById('docusign-access-token-box');
  const codeAccessToken = document.getElementById('code-docusign-access-token');
  const labelTokenExpires = document.getElementById('docusign-token-expires-label');
  const codeJwt = document.getElementById('code-docusign-jwt');
  const codeClaims = document.getElementById('code-docusign-claims');

  const btnCopyAccessToken = document.getElementById('btn-copy-docusign-access-token');
  const btnCopyJwt = document.getElementById('btn-copy-docusign-jwt');

  // Status no cabeçalho
  const statusBadge = document.getElementById('docusign-status-badge');
  const statusDot = document.getElementById('docusign-status-dot');
  const statusText = document.getElementById('docusign-status-text');

  let currentEnvironment = 'demo';
  const STORAGE_KEY = 'dblab_docusign_config';

  // 1. Alternância de Ambiente (Demo vs Produção)
  function setEnvironment(env) {
    currentEnvironment = env === 'production' ? 'production' : 'demo';
    const isDemo = currentEnvironment === 'demo';
    presetDemo.setAttribute('aria-pressed', isDemo ? 'true' : 'false');
    presetProd.setAttribute('aria-pressed', !isDemo ? 'true' : 'false');

    if (statusBadge) {
      statusText.textContent = isDemo ? 'Demo (Sandbox)' : 'Produção';
      statusDot.className = 'dot ok';
    }
    savePreferences();
  }

  presetDemo.addEventListener('click', () => setEnvironment('demo'));
  presetProd.addEventListener('click', () => setEnvironment('production'));

  // 2. Extração flexível de JSON (para privateRSAKey e campos associados)
  function parsePossibleJson(text) {
    if (!text || typeof text !== 'string') return null;
    const trimmed = text.trim();
    if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return null;
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === 'object') {
        return parsed;
      }
    } catch (_) {}
    return null;
  }

  function handleJsonAutoExtraction(rawInput, showFeedback = true) {
    const parsed = parsePossibleJson(rawInput);
    if (!parsed) return false;

    let extractedAny = false;
    const key = parsed.privateRSAKey || parsed.private_rsa_key || parsed.privateKey || parsed.private_key;
    if (key && typeof key === 'string') {
      inputPrivateKey.value = key.trim();
      extractedAny = true;
    }

    // Se o JSON contiver outros campos da integradora, auto-preenche se estiverem vazios
    const incomingKey = parsed.integradora_chave || parsed.client_id || parsed.integrationKey;
    if (incomingKey && !inputIntegrationKey.value) {
      inputIntegrationKey.value = incomingKey;
    }

    const incomingUser = parsed.integradora_secret_key || parsed.userId || parsed.user_id;
    if (incomingUser && !inputUserId.value) {
      inputUserId.value = incomingUser;
    }

    const incomingAccount = parsed.integradora_account_id || parsed.accountId || parsed.account_id;
    if (incomingAccount && inputAccountId && !inputAccountId.value) {
      inputAccountId.value = incomingAccount;
    }

    if (extractedAny && showFeedback) {
      toast('Chave privada (privateRSAKey) extraída do JSON!', 'ok');
      savePreferences();
    }
    return extractedAny;
  }

  // Detecta quando o usuário cola ou digita JSON no campo de chave privada
  inputPrivateKey.addEventListener('paste', () => {
    setTimeout(() => {
      handleJsonAutoExtraction(inputPrivateKey.value, true);
    }, 40);
  });

  inputPrivateKey.addEventListener('blur', () => {
    handleJsonAutoExtraction(inputPrivateKey.value, true);
  });

  // 3. Persistência local de credenciais não-sensíveis
  function savePreferences() {
    if (!checkRemember.checked) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    const data = {
      environment: currentEnvironment,
      integrationKey: inputIntegrationKey.value.trim(),
      userId: inputUserId.value.trim(),
      accountId: inputAccountId ? inputAccountId.value.trim() : '',
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  function loadPreferences() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data.environment) setEnvironment(data.environment);
      if (data.integrationKey) inputIntegrationKey.value = data.integrationKey;
      if (data.userId) inputUserId.value = data.userId;
      if (data.accountId && inputAccountId) inputAccountId.value = data.accountId;
    } catch (_) {
      // Ignora falhas de parse no storage
    }
  }

  inputIntegrationKey.addEventListener('input', savePreferences);
  inputUserId.addEventListener('input', savePreferences);
  if (inputAccountId) inputAccountId.addEventListener('input', savePreferences);
  checkRemember.addEventListener('change', savePreferences);
  loadPreferences();

  // 4. Upload de arquivo (.pem / .key / .json)
  filePrivateKey.addEventListener('change', e => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = event => {
      const content = event.target?.result || '';
      const extracted = handleJsonAutoExtraction(content, true);
      if (!extracted) {
        inputPrivateKey.value = content;
        toast('Chave privada carregada do arquivo.', 'ok');
      }
      inputPrivateKey.focus();
    };
    reader.onerror = () => {
      toast('Falha ao ler o arquivo de chave privada.', 'err');
    };
    reader.readAsText(file);
    filePrivateKey.value = '';
  });

  // Utilitários de interface
  function hideFeedback() {
    alertError.classList.add('hidden');
    alertConsent.classList.add('hidden');
  }

  function showError(title, message) {
    errorTitle.textContent = title;
    errorText.textContent = message;
    alertError.classList.remove('hidden');
  }

  function showConsentAlert(url) {
    linkConsent.href = url;
    alertConsent.classList.remove('hidden');
  }

  function setLoading(isLoading) {
    spinnerToken.classList.toggle('hidden', !isLoading);
    btnGenerateToken.disabled = isLoading;
    btnGenerateJwt.disabled = isLoading;
    btnGetConsent.disabled = isLoading;
  }

  function getFormData() {
    const integrationKey = inputIntegrationKey.value.trim();
    const userId = inputUserId.value.trim();
    const accountId = inputAccountId ? inputAccountId.value.trim() : '';
    let privateRSAKey = inputPrivateKey.value.trim();
    const expiresIn = parseInt(inputExpires.value, 10) || 3600;

    // Extrai de JSON caso ainda esteja como JSON no textarea
    const parsed = parsePossibleJson(privateRSAKey);
    if (parsed) {
      const extractedKey = parsed.privateRSAKey || parsed.private_rsa_key || parsed.privateKey || parsed.private_key;
      if (extractedKey && typeof extractedKey === 'string') {
        privateRSAKey = extractedKey.trim();
      }
    }

    if (!integrationKey) {
      inputIntegrationKey.focus();
      throw new Error('Preencha a Integration Key (client_id / integradora_chave).');
    }
    if (!userId) {
      inputUserId.focus();
      throw new Error('Preencha o User ID (integradora_secret_key).');
    }
    if (!privateRSAKey) {
      inputPrivateKey.focus();
      throw new Error('Insira a Chave Privada RSA (PEM direto ou JSON com privateRSAKey).');
    }

    return {
      integrationKey,
      userId,
      accountId,
      privateRSAKey,
      environment: currentEnvironment,
      expiresIn,
    };
  }

  // 5. Ação: Gerar Access Token (comunicação com a DocuSign)
  btnGenerateToken.addEventListener('click', async () => {
    hideFeedback();
    panelResult.classList.add('hidden');

    let payload;
    try {
      payload = getFormData();
    } catch (err) {
      showError('Dados incompletos', err.message);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/docusign/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        if (data.error === 'consent_required' && data.consentUrl) {
          showConsentAlert(data.consentUrl);
          toast('Consentimento prévio necessário na DocuSign.', 'warn');
          return;
        }

        const msg = data.message || data.error || 'Erro ao comunicar com a DocuSign.';
        showError('Falha na autenticação DocuSign', msg);
        toast(msg, 'err');
        return;
      }

      // Renderiza resultado completo
      resultTitle.textContent = 'Access Token Gerado com Sucesso';
      resultMeta.textContent = `${data.audience} · ${data.token_type}${data.accountId ? ' · Conta: ' + data.accountId : ''}`;
      boxAccessToken.classList.remove('hidden');
      codeAccessToken.textContent = data.access_token;
      labelTokenExpires.textContent = `Válido por ${data.expires_in}s (${data.token_type})`;
      codeJwt.textContent = data.jwt;
      codeClaims.textContent = JSON.stringify(data.claims, null, 2);

      panelResult.classList.remove('hidden');
      toast('Access Token emitido pela DocuSign!', 'ok');
    } catch (err) {
      showError('Erro de conexão', `Não foi possível contatar o servidor: ${err.message}`);
      toast('Erro de rede ao solicitar token.', 'err');
    } finally {
      setLoading(false);
    }
  });

  // 6. Ação: Apenas Gerar JWT (offline / sem chamada à DocuSign)
  btnGenerateJwt.addEventListener('click', async () => {
    hideFeedback();
    panelResult.classList.add('hidden');

    let payload;
    try {
      payload = getFormData();
    } catch (err) {
      showError('Dados incompletos', err.message);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/docusign/jwt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        showError('Falha ao gerar JWT', data.error || 'Erro desconhecido.');
        toast(data.error || 'Erro ao gerar asserção JWT.', 'err');
        return;
      }

      resultTitle.textContent = 'Asserção JWT Gerada (RS256)';
      resultMeta.textContent = `Público-alvo: ${data.audience} · Validade: ${data.expiresIn}s${data.accountId ? ' · Conta: ' + data.accountId : ''}`;
      boxAccessToken.classList.add('hidden');
      codeJwt.textContent = data.jwt;
      codeClaims.textContent = JSON.stringify(data.claims, null, 2);

      panelResult.classList.remove('hidden');
      toast('Asserção JWT assinada com sucesso!', 'ok');
    } catch (err) {
      showError('Erro de conexão', err.message);
    } finally {
      setLoading(false);
    }
  });

  // 7. Ação: Gerar Link de Consentimento Prévio
  btnGetConsent.addEventListener('click', async () => {
    hideFeedback();
    const integrationKey = inputIntegrationKey.value.trim();
    if (!integrationKey) {
      showError('Integration Key necessária', 'Preencha a Integration Key (integradora_chave) para obter a URL de consentimento.');
      inputIntegrationKey.focus();
      return;
    }

    try {
      const response = await fetch('/api/docusign/consent-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          integrationKey,
          environment: currentEnvironment,
        }),
      });
      const data = await response.json();
      if (data.success && data.consentUrl) {
        showConsentAlert(data.consentUrl);
        copy(data.consentUrl, 'Link de consentimento copiado!');
      }
    } catch (err) {
      showError('Erro', err.message);
    }
  });

  // 8. Ações de Cópia
  btnCopyAccessToken.addEventListener('click', () => {
    const text = codeAccessToken.textContent;
    if (text) copy(text, 'Access Token copiado!');
  });

  btnCopyJwt.addEventListener('click', () => {
    const text = codeJwt.textContent;
    if (text) copy(text, 'JWT Assertion copiado!');
  });

  btnCopyConsent.addEventListener('click', () => {
    const url = linkConsent.href;
    if (url && url !== '#') copy(url, 'URL de consentimento copiada!');
  });

  // 9. Limpar campos
  btnClear.addEventListener('click', () => {
    inputPrivateKey.value = '';
    if (inputAccountId) inputAccountId.value = '';
    hideFeedback();
    panelResult.classList.add('hidden');
    toast('Campos limpos.', 'info');
  });
});
