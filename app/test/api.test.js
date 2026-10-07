const { test, describe, after } = require('node:test');
const assert = require('node:assert');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const created = [];

const api = (path, opts = {}) =>
  fetch(BASE_URL + path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });

after(async () => {
  for (const name of created) {
    await api(`/api/clones/${name}`, { method: 'DELETE' }).catch(() => {});
  }
});

describe('API', () => {
  test('GET /api/info is online', async () => {
    const res = await api('/api/info');
    assert.strictEqual(res.status, 200);
    assert.strictEqual((await res.json()).status, 'online');
  });

  test('DELETE postgres is rejected', async () => {
    const res = await api('/api/clones/postgres', { method: 'DELETE' });
    assert.strictEqual(res.status, 400);
  });

  test('DELETE invalid name is rejected', async () => {
    const res = await api('/api/clones/bad-name!', { method: 'DELETE' });
    assert.strictEqual(res.status, 400);
  });

  test('template clone with invalid name is rejected', async () => {
    const res = await api('/api/clones/template', {
      method: 'POST',
      body: JSON.stringify({ sourceClone: 'seed_db', newCloneName: 'bad name;' }),
    });
    assert.strictEqual(res.status, 400);
  });

  test('clone-stream without params emits an error event', async () => {
    const res = await api('/api/clone-stream');
    const text = await res.text();
    assert.match(text, /event: error/);
  });

  test('template round trip: create, list, delete', async () => {
    const name = `test_${Date.now()}`;
    // template1 always exists, so the test does not depend on the init-test-db seed
    // (which only runs on an empty pg_data volume).
    const src = 'template1';
    const create = await api('/api/clones/template', {
      method: 'POST',
      body: JSON.stringify({ sourceClone: src, newCloneName: name }),
    });
    if (create.status === 200) created.push(name);
    assert.strictEqual(create.status, 200);

    const list = await (await api('/api/clones')).json();
    assert.ok(list.clones.some((c) => c.name === name));

    const del = await api(`/api/clones/${name}`, { method: 'DELETE' });
    assert.strictEqual(del.status, 200);
  });

  test('template clone validates sourceClone (known gap)', { todo: true }, async () => {
    const res = await api('/api/clones/template', {
      method: 'POST',
      body: JSON.stringify({ sourceClone: 'x"; --', newCloneName: `test_${Date.now()}` }),
    });
    assert.strictEqual(res.status, 400);
  });
});
