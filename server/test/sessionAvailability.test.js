import test from 'node:test';
import assert from 'node:assert/strict';
import { portalSessionRequired, administratorOnly, fetchCurrentUser } from '../src/auth.js';

async function run(middleware, authorization = 'Bearer fixture') {
  const req = { headers: { authorization } };
  let status, body, passed = false;
  const res = { status(code) { status = code; return this; }, json(value) { body = value; return this; } };
  await middleware(req, res, () => { passed = true; });
  return { status, body, passed, user: req.portalUser };
}

for (const [label, middleware] of [['autoservicio', portalSessionRequired], ['administración', administratorOnly]]) {
  test(`${label}: sin sesión no consulta Core`, async (t) => {
    t.mock.method(globalThis, 'fetch', async () => { assert.fail('No debe consultar Core'); });
    assert.equal((await run(middleware, '')).status, 401);
  });
  for (const status of [401, 403]) test(`${label}: rechazo ${status} de Core deniega la sesión`, async (t) => {
    t.mock.method(globalThis, 'fetch', async () => new Response('{}', { status }));
    const result = await run(middleware); assert.equal(result.status, 401); assert.equal(result.passed, false);
  });
  for (const failure of ['network', 'timeout', '500', 'invalid-json', 'missing-profile']) {
    test(`${label}: ${failure} devuelve 503 sin autorizar ni invalidar la sesión`, async (t) => {
      t.mock.method(globalThis, 'fetch', async () => {
        if (failure === 'network') throw new Error('offline');
        if (failure === 'timeout') throw new DOMException('timeout', 'TimeoutError');
        if (failure === '500') return new Response('{}', { status: 500 });
        return new Response(failure === 'invalid-json' ? '<html>' : '{}');
      });
      const result = await run(middleware); assert.equal(result.status, 503); assert.equal(result.passed, false);
    });
  }
  test(`${label}: sesión administrativa válida conserva identidad`, async (t) => {
    t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ profile: { id: 'qa-user', role: 'administrator' } })));
    const result = await run(middleware); assert.equal(result.passed, true); assert.equal(result.user.id, 'qa-user');
  });
}

test('un lector puede usar autoservicio pero no administrar', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ profile: { id: 'qa-viewer', role: 'viewer' } })));
  assert.equal((await run(portalSessionRequired)).passed, true);
  assert.equal((await run(administratorOnly)).status, 403);
});

test('la consulta auxiliar conserva null cuando Core no está disponible', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('offline'); });
  assert.equal(await fetchCurrentUser('Bearer fixture'), null);
});
