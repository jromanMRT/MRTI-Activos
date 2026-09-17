import test from 'node:test';
import assert from 'node:assert/strict';
import { assetPersonSearch } from '../src/assetPersonSearch.js';

test('search resolves full names without accents and employee numbers through RH references', async (t) => {
  const db = { query: async () => [[{ rh_employee_id: 1417 }, { portal_user_id: 'core-id' }]] };
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    assert.equal(options.headers.Authorization, 'Bearer test');
    assert.deepEqual(JSON.parse(options.body).references, [{ employee_id: 1417 }, { portal_user_id: 'core-id' }]);
    return Response.json({ data: [{ id: 1417, full_name: 'MARÍA GLORIA MUÑOZ VERDUGO', employee_number: '1931', portal_user_id: 'core-id' }] });
  });
  for (const query of ['maria gloria muñoz verdugo', '  gloria   munoz ', '1931']) {
    const result = await assetPersonSearch(db, 'Bearer test', query);
    assert.deepEqual(result.params, [1417, 'core-id']);
    assert.match(result.sql, /rh_employee_id IS NULL AND portal_user_id IN/);
    assert.ok(!result.sql.includes(query));
  }
  assert.deepEqual(await assetPersonSearch(db, 'Bearer test', 'otra persona'), { sql: '', params: [] });
});

test('search includes assignments beyond the first RH batch', async (t) => {
  const db = { query: async () => [Array.from({ length: 1001 }, (_, index) => ({ rh_employee_id: index + 1 }))] };
  const sizes = [];
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    const refs = JSON.parse(options.body).references;
    sizes.push(refs.length);
    return Response.json({ data: refs.map(({ employee_id }) => ({ id: employee_id, full_name: `Persona ${employee_id}` })) });
  });
  const result = await assetPersonSearch(db, 'Bearer test', 'Persona 1001');
  assert.deepEqual(sizes, [1000, 1]);
  assert.deepEqual(result.params, [1001]);
});

test('RH failure reports incomplete search instead of false empty results', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response('', { status: 503 }));
  await assert.rejects(assetPersonSearch({ query: async () => [[{ rh_employee_id: 1 }]] }, '', 'nombre'), { status: 503 });
});

test('inventory without linked people does not require RH', async (t) => {
  t.mock.method(globalThis, 'fetch', () => { throw new Error('Unexpected request'); });
  assert.deepEqual(await assetPersonSearch({ query: async () => [[]] }, '', 'TI-00274'), { sql: '', params: [] });
});
