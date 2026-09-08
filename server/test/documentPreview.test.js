import test from 'node:test';
import assert from 'node:assert/strict';
import { apiPreview } from '../../src/api.js';

function setup(t, response) {
  const events = [];
  const tab = {
    closed: false, opener: {},
    document: {
      body: { textContent: '', replaceChildren(frame) { tab.frame = frame; } },
      createElement() { return { style: {} }; },
    },
    addEventListener(name, callback) { tab[name] = callback; },
    close() { tab.closed = true; },
  };
  t.mock.method(globalThis, 'fetch', async (path, options) => {
    events.push('fetch');
    assert.equal(path, '/activos-api/api/activos-suite/documents/1/download');
    assert.equal(options.headers.Authorization, 'Bearer test-session');
    return response;
  });
  globalThis.localStorage = { getItem: () => 'test-session' };
  globalThis.window = { open() { events.push('open'); return tab; } };
  t.after(() => { delete globalThis.window; delete globalThis.localStorage; });
  return { tab, events };
}

for (const type of ['application/pdf', 'image/png', 'image/jpeg']) {
  test(`vista previa ${type} usa una pestaña y libera el archivo al cerrarla`, async (t) => {
    const { tab, events } = setup(t, new Response(new Blob(['fixture'], { type })));
    t.mock.method(URL, 'createObjectURL', () => 'blob:preview');
    const revoke = t.mock.method(URL, 'revokeObjectURL', () => {});
    await apiPreview('/activos-suite/documents/1/download', '<Documento>');
    assert.deepEqual(events, ['open', 'fetch']);
    assert.equal(tab.opener, null);
    assert.equal(tab.document.title, '<Documento>');
    assert.equal(tab.frame.src, 'blob:preview');
    assert.equal(revoke.mock.callCount(), 0);
    tab.pagehide();
    assert.equal(revoke.mock.calls[0].arguments[0], 'blob:preview');
  });
}

for (const [status, type, message] of [[403, 'application/json', 'Sin permiso'], [200, 'text/html', 'Este formato']]) {
  test(`rechaza contenido no visible o acceso denegado (${status})`, async (t) => {
    const { tab } = setup(t, new Response(JSON.stringify({ error: 'Sin permiso' }), { status, headers: { 'Content-Type': type } }));
    await assert.rejects(apiPreview('/activos-suite/documents/1/download'), new RegExp(message));
    assert.equal(tab.closed, true);
    assert.equal(tab.frame, undefined);
  });
}

test('una pestaña bloqueada no solicita el documento', async (t) => {
  const { events } = setup(t);
  window.open = () => null;
  await assert.rejects(apiPreview('/activos-suite/documents/1/download'), /ventanas emergentes/);
  assert.deepEqual(events, []);
});
