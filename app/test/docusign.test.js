const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { generateDocuSignJWT, getAuthAudience, buildConsentUrl } = require('../docusign');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// Gera um par de chaves RSA em memória para execução dos testes unitários
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: {
    type: 'spki',
    format: 'pem',
  },
  privateKeyEncoding: {
    type: 'pkcs8',
    format: 'pem',
  },
});

describe('DocuSign Domain Logic (Unit)', () => {
  it('identifies demo and production audiences correctly', () => {
    assert.equal(getAuthAudience('demo').audience, 'account-d.docusign.com');
    assert.equal(getAuthAudience('sandbox').audience, 'account-d.docusign.com');
    assert.equal(getAuthAudience('production').audience, 'account.docusign.com');
    assert.equal(getAuthAudience('prod').audience, 'account.docusign.com');
    assert.equal(getAuthAudience().audience, 'account-d.docusign.com');
  });

  it('builds consent url with required parameters', () => {
    const url = buildConsentUrl('my-client-id', 'demo', 'https://localhost/callback');
    assert.ok(url.startsWith('https://account-d.docusign.com/oauth/auth?'));
    assert.ok(url.includes('client_id=my-client-id'));
    assert.ok(url.includes('response_type=code'));
    assert.ok(url.includes('scope=signature+impersonation') || url.includes('scope=signature%20impersonation'));
  });

  it('generates a valid RS256 signed JWT assertion', () => {
    const result = generateDocuSignJWT({
      integrationKey: 'test-client-id',
      userId: 'test-user-guid',
      privateRSAKey: privateKey,
      environment: 'demo',
      expiresIn: 1800,
    });

    assert.ok(result.jwt);
    assert.equal(typeof result.jwt, 'string');
    const parts = result.jwt.split('.');
    assert.equal(parts.length, 3);

    // Valida Header
    const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    assert.equal(header.alg, 'RS256');
    assert.equal(header.typ, 'JWT');

    // Valida Claims
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    assert.equal(payload.iss, 'test-client-id');
    assert.equal(payload.sub, 'test-user-guid');
    assert.equal(payload.aud, 'account-d.docusign.com');
    assert.equal(payload.scope, 'signature impersonation');
    assert.equal(payload.exp - payload.iat, 1800);

    // Valida assinatura criptográfica RS256 com a chave pública
    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(`${parts[0]}.${parts[1]}`);
    const isValid = verifier.verify(publicKey, parts[2], 'base64url');
    assert.equal(isValid, true);
  });

  it('handles PEM keys with escaped newlines (\\n)', () => {
    const escapedKey = privateKey.replace(/\n/g, '\\n');
    const result = generateDocuSignJWT({
      integrationKey: 'client-key',
      userId: 'user-guid',
      privateRSAKey: escapedKey,
      environment: 'production',
    });

    assert.ok(result.jwt);
    assert.equal(result.claims.aud, 'account.docusign.com');
  });

  it('extracts privateRSAKey from JSON string or object payload', () => {
    const jsonPayload = JSON.stringify({
      publicRSAKey: '-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8A\n-----END PUBLIC KEY-----',
      privateRSAKey: privateKey,
      authServiceSelected: 0,
    });

    const result = generateDocuSignJWT({
      integrationKey: 'client-from-json-test',
      userId: 'user-from-json-test',
      privateRSAKey: jsonPayload,
      environment: 'demo',
    });

    assert.ok(result.jwt);
    assert.equal(result.claims.iss, 'client-from-json-test');
    assert.equal(result.claims.sub, 'user-from-json-test');
  });

  it('rejects missing integrationKey', () => {
    assert.throws(
      () => generateDocuSignJWT({ integrationKey: '', userId: '123', privateRSAKey: privateKey }),
      /integrationKey é obrigatório/
    );
  });

  it('rejects missing userId', () => {
    assert.throws(
      () => generateDocuSignJWT({ integrationKey: 'abc', userId: '', privateRSAKey: privateKey }),
      /userId é obrigatório/
    );
  });

  it('rejects invalid or missing private key', () => {
    assert.throws(
      () => generateDocuSignJWT({ integrationKey: 'abc', userId: '123', privateRSAKey: 'invalid-pem' }),
      /formato PEM/
    );
  });
});

describe('DocuSign API Endpoints', () => {
  it('POST /api/docusign/jwt generates signed token', async () => {
    const res = await fetch(`${BASE_URL}/api/docusign/jwt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        integrationKey: 'api-test-client',
        userId: 'api-test-user',
        privateRSAKey: privateKey,
        environment: 'demo',
      }),
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.ok(data.jwt);
    assert.equal(data.claims.iss, 'api-test-client');
    assert.equal(data.claims.sub, 'api-test-user');
    assert.equal(data.audience, 'account-d.docusign.com');
  });

  it('POST /api/docusign/jwt accepts alias fields (integradora_chave, integradora_secret_key, integradora_account_id, privateRSAKey in JSON)', async () => {
    const rawJson = JSON.stringify({
      publicRSAKey: '-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8A\n-----END PUBLIC KEY-----',
      privateRSAKey: privateKey,
      authServiceSelected: 0,
    });

    const res = await fetch(`${BASE_URL}/api/docusign/jwt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        integradora_chave: 'alias-client-id',
        integradora_secret_key: 'alias-user-guid',
        integradora_account_id: '12345678',
        privateRSAKey: rawJson,
        environment: 'demo',
      }),
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.ok(data.jwt);
    assert.equal(data.claims.iss, 'alias-client-id');
    assert.equal(data.claims.sub, 'alias-user-guid');
    assert.equal(data.accountId, '12345678');
  });

  it('POST /api/docusign/jwt with missing parameters returns 400', async () => {
    const res = await fetch(`${BASE_URL}/api/docusign/jwt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        integrationKey: '',
        userId: '123',
      }),
    });

    assert.equal(res.status, 400);
    const data = await res.json();
    assert.equal(data.success, false);
    assert.ok(data.error);
  });

  it('POST /api/docusign/consent-url returns valid url', async () => {
    const res = await fetch(`${BASE_URL}/api/docusign/consent-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        integrationKey: 'my-ik-123',
        environment: 'demo',
      }),
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.ok(data.consentUrl.includes('my-ik-123'));
  });

  it('POST /api/docusign/token returns 400 on invalid input parameters', async () => {
    const res = await fetch(`${BASE_URL}/api/docusign/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        integrationKey: '',
        userId: '',
      }),
    });

    assert.equal(res.status, 400);
    const data = await res.json();
    assert.equal(data.success, false);
    assert.ok(data.error);
  });
});
