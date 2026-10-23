const express = require('express');
const crypto = require('crypto');

const router = express.Router();

const BASE_AUTH_PRODUCTION = 'account.docusign.com';
const BASE_AUTH_SANDBOX = 'account-d.docusign.com';

/**
 * Normaliza e formata a chave privada PEM.
 * É flexível: aceita a chave PEM pura, ou um objeto/string JSON contendo o campo `privateRSAKey` (ou variações).
 * Trata também quebras de linha escapadas (\n).
 */
function normalizePrivateKey(rawKey) {
  if (!rawKey) {
    throw new Error('Chave privada RSA não fornecida.');
  }

  let key = rawKey;

  // Se já for um objeto JavaScript (ex: se o body enviou um objeto)
  if (typeof key === 'object') {
    let extracted = key.privateRSAKey || key.private_rsa_key || key.privateKey || key.private_key;
    if (!extracted && key.integradora_dados) {
      const dados = typeof key.integradora_dados === 'string'
        ? (() => { try { return JSON.parse(key.integradora_dados); } catch (_) { return null; } })()
        : key.integradora_dados;
      if (dados && typeof dados === 'object') {
        extracted = dados.privateRSAKey || dados.private_rsa_key || dados.privateKey || dados.private_key;
      }
    }
    key = extracted || '';
  }

  if (typeof key !== 'string') {
    throw new Error('Chave privada RSA em formato inválido.');
  }

  key = key.trim();

  // Tenta extrair de string JSON (caso o usuário tenha colado o JSON inteiro no campo de texto)
  if (key.startsWith('{') && key.endsWith('}')) {
    try {
      const parsed = JSON.parse(key);
      if (parsed && typeof parsed === 'object') {
        let extracted = parsed.privateRSAKey || parsed.private_rsa_key || parsed.privateKey || parsed.private_key;
        if (!extracted && parsed.integradora_dados) {
          const dados = typeof parsed.integradora_dados === 'string'
            ? JSON.parse(parsed.integradora_dados)
            : parsed.integradora_dados;
          if (dados && typeof dados === 'object') {
            extracted = dados.privateRSAKey || dados.private_rsa_key || dados.privateKey || dados.private_key;
          }
        }
        if (extracted && typeof extracted === 'string') {
          key = extracted.trim();
        }
      }
    } catch (_) {
      // Se não for JSON válido, segue com o texto puro colado
    }
  }

  if (key.includes('\\n')) {
    key = key.replace(/\\n/g, '\n');
  }

  if (!key.includes('-----BEGIN') || !key.includes('PRIVATE KEY-----')) {
    throw new Error('A chave deve estar no formato PEM (ex: -----BEGIN RSA PRIVATE KEY----- ou -----BEGIN PRIVATE KEY-----) ou em um JSON contendo o campo privateRSAKey.');
  }

  return key;
}

/**
 * Normaliza parâmetros de requisição para aceitar múltiplos padrões de nomenclatura:
 * - DocuSign / OAuth: integrationKey, client_id, userId, privateRSAKey, accountId
 * - Banco tb_integradoras: integradora_chave, integradora_secret_key, integradora_account_id, integradora_url, integradora_dados
 */
function parseRequestParams(body = {}) {
  const integrationKey = (body.integrationKey || body.client_id || body.integradora_chave || '').toString().trim();
  const userId = (body.userId || body.user_id || body.integradora_secret_key || '').toString().trim();
  const accountId = (body.accountId || body.account_id || body.integradora_account_id || '').toString().trim();

  let privateRSAKey = body.privateRSAKey || body.private_rsa_key || body.privateKey;
  if (!privateRSAKey && body.integradora_dados) {
    if (typeof body.integradora_dados === 'object') {
      privateRSAKey = body.integradora_dados.privateRSAKey || body.integradora_dados.private_rsa_key || body.integradora_dados.privateKey;
    } else if (typeof body.integradora_dados === 'string') {
      try {
        const parsed = JSON.parse(body.integradora_dados);
        privateRSAKey = parsed.privateRSAKey || parsed.private_rsa_key || parsed.privateKey;
      } catch (_) {
        privateRSAKey = body.integradora_dados;
      }
    }
  }

  // Se o body inteiro for o objeto integradora e privateRSAKey ainda não tiver sido preenchido
  if (!privateRSAKey && (body.integradora || body.integradora_chave)) {
    privateRSAKey = body;
  }

  const environment = body.environment || body.integradora_url;

  return {
    integrationKey,
    userId,
    accountId,
    privateRSAKey,
    environment,
    expiresIn: body.expiresIn,
  };
}

/**
 * Retorna o host de autenticação e a URL do endpoint OAuth com base no ambiente.
 */
function getAuthAudience(environment) {
  const env = (environment || 'demo').toLowerCase().trim();
  const isDemo = env === 'demo' || env === 'sandbox';
  const audience = isDemo ? BASE_AUTH_SANDBOX : BASE_AUTH_PRODUCTION;
  return {
    environment: isDemo ? 'demo' : 'production',
    audience,
    tokenUrl: `https://${audience}/oauth/token`,
  };
}

/**
 * Constrói a URL para concessão de consentimento único (One-Time Consent).
 */
function buildConsentUrl(integrationKey, environment, redirectUri = 'https://localhost') {
  const { audience } = getAuthAudience(environment);
  const params = new URLSearchParams({
    response_type: 'code',
    scope: 'signature impersonation',
    client_id: integrationKey,
    redirect_uri: redirectUri,
  });
  return `https://${audience}/oauth/auth?${params.toString()}`;
}

/**
 * Gera e assina digitalmente a asserção JWT com RS256 para DocuSign.
 */
function generateDocuSignJWT({ integrationKey, userId, privateRSAKey, environment, expiresIn = 3600 }) {
  if (!integrationKey || typeof integrationKey !== 'string' || !integrationKey.trim()) {
    throw new Error('O parâmetro integrationKey é obrigatório.');
  }
  if (!userId || typeof userId !== 'string' || !userId.trim()) {
    throw new Error('O parâmetro userId é obrigatório.');
  }

  const pemKey = normalizePrivateKey(privateRSAKey);
  const { audience, environment: env } = getAuthAudience(environment);

  // Expiração: máximo de 3600 segundos (1 hora) conforme especificação da DocuSign
  const validitySeconds = Math.min(Math.max(parseInt(expiresIn, 10) || 3600, 60), 3600);
  const now = Math.floor(Date.now() / 1000);

  const header = {
    alg: 'RS256',
    typ: 'JWT',
  };

  const claims = {
    iss: integrationKey.trim(),
    sub: userId.trim(),
    aud: audience,
    iat: now,
    exp: now + validitySeconds,
    scope: 'signature impersonation',
  };

  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(claims)).toString('base64url');
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  try {
    const signer = crypto.createSign('RSA-SHA256');
    signer.update(signingInput);
    const signature = signer.sign(pemKey, 'base64url');
    const jwt = `${signingInput}.${signature}`;

    return {
      jwt,
      claims,
      environment: env,
      audience,
      expiresIn: validitySeconds,
    };
  } catch (err) {
    throw new Error(`Falha ao assinar JWT com chave privada RSA: ${err.message}`);
  }
}

/**
 * 1. POST /api/docusign/jwt
 * Gera apenas a asserção JWT assinada com RS256 e retorna as claims.
 */
router.post('/jwt', (req, res) => {
  try {
    const params = parseRequestParams(req.body);
    const result = generateDocuSignJWT(params);

    res.json({
      success: true,
      jwt: result.jwt,
      claims: result.claims,
      audience: result.audience,
      environment: result.environment,
      expiresIn: result.expiresIn,
      ...(params.accountId ? { accountId: params.accountId } : {}),
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err.message,
    });
  }
});

/**
 * 2. POST /api/docusign/token
 * Gera a asserção JWT e requisita o Access Token diretamente ao endpoint OAuth da DocuSign.
 */
router.post('/token', async (req, res) => {
  const params = parseRequestParams(req.body);
  let jwtResult;
  try {
    jwtResult = generateDocuSignJWT(params);
  } catch (err) {
    return res.status(400).json({
      success: false,
      error: err.message,
    });
  }

  const { audience, tokenUrl } = getAuthAudience(params.environment);
  const formData = new URLSearchParams();
  formData.append('grant_type', 'urn:ietf:params:oauth:grant-type:jwt-bearer');
  formData.append('assertion', jwtResult.jwt);

  try {
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    const bodyText = await response.text();
    let bodyJson = null;
    try {
      bodyJson = JSON.parse(bodyText);
    } catch (_) {
      // Deixa nulo caso o corpo não seja JSON
    }

    if (!response.ok) {
      const errorType = bodyJson?.error || 'oauth_error';
      const errorDesc = bodyJson?.error_description || bodyText || 'Erro desconhecido na DocuSign';

      // Tratamento especial para erro de consentimento obrigatório
      if (errorType === 'consent_required') {
        const consentUrl = buildConsentUrl(params.integrationKey, params.environment);
        return res.status(400).json({
          success: false,
          error: 'consent_required',
          message: 'Consentimento prévio obrigatório. O usuário personificado precisa autorizar a aplicação uma única vez.',
          consentUrl,
          jwt: jwtResult.jwt,
          details: bodyJson || bodyText,
        });
      }

      return res.status(response.status).json({
        success: false,
        error: errorType,
        message: errorDesc,
        jwt: jwtResult.jwt,
        details: bodyJson || bodyText,
      });
    }

    res.json({
      success: true,
      jwt: jwtResult.jwt,
      access_token: bodyJson.access_token,
      token_type: bodyJson.token_type || 'Bearer',
      expires_in: bodyJson.expires_in || 3600,
      claims: jwtResult.claims,
      audience,
      environment: jwtResult.environment,
      ...(params.accountId ? { accountId: params.accountId } : {}),
    });
  } catch (err) {
    res.status(502).json({
      success: false,
      error: 'network_error',
      message: `Falha na comunicação com o servidor OAuth da DocuSign (${tokenUrl}): ${err.message}`,
      jwt: jwtResult.jwt,
    });
  }
});

/**
 * 3. POST /api/docusign/consent-url
 * Helper para obter a URL de consentimento prévio da DocuSign.
 */
router.post('/consent-url', (req, res) => {
  const params = parseRequestParams(req.body);
  const redirectUri = req.body?.redirectUri || 'https://localhost';
  if (!params.integrationKey) {
    return res.status(400).json({ success: false, error: 'O parâmetro integrationKey (ou client_id / integradora_chave) é obrigatório.' });
  }

  const consentUrl = buildConsentUrl(params.integrationKey, params.environment, redirectUri);
  res.json({
    success: true,
    consentUrl,
  });
});

module.exports = router;
module.exports.generateDocuSignJWT = generateDocuSignJWT;
module.exports.getAuthAudience = getAuthAudience;
module.exports.buildConsentUrl = buildConsentUrl;
module.exports.normalizePrivateKey = normalizePrivateKey;
module.exports.parseRequestParams = parseRequestParams;
