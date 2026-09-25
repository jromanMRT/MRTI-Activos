import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { normalizeNote, canEditNote, noteRevision, noteSearch } from '../src/domain/technicalNotes.js';
import { createTechnicalNotesRouter } from '../src/routes/technicalNotes.js';

const valid = { title: ' Batería laptop ', content: 'P/N ABC-123, 11.4 V', purchase_url: 'https://example.com/battery' };

test('notes preserve specifications and accept optional equipment linkage', () => {
  const result = normalizeNote(valid);
  assert.equal(result.title, 'Batería laptop');
  assert.equal(result.content, valid.content);
  assert.equal(result.asset_uid, null);
  assert.equal(normalizeNote({ ...valid, asset_uid: '1aa78157-9969-4e10-af68-1c56ebefbba8' }).asset_uid, '1aa78157-9969-4e10-af68-1c56ebefbba8');
  assert.ok(!Object.hasOwn(normalizeNote({ ...valid, created_by: 'forged' }), 'created_by'));
});

test('notes reject blank content, invalid IDs and oversized or structured inputs', () => {
  for (const patch of [{ title: ' ' }, { content: '' }, { title: 'a'.repeat(181) }, { content: 'a'.repeat(20001) }, { serial_reference: {} }, { asset_uid: 'bad' }]) {
    assert.throws(() => normalizeNote({ ...valid, ...patch }), { status: 400 });
  }
});

test('purchase references only permit web URLs without embedded credentials', () => {
  for (const purchase_url of ['javascript:alert(1)', 'data:text/html,hi', 'file:///tmp/file', 'https://user:pass@example.com', 'not-a-url']) {
    assert.throws(() => normalizeNote({ ...valid, purchase_url }), { status: 400 });
  }
});

test('editing is restricted to author or administrator and revisions are explicit', () => {
  const note = { created_by: 'author' };
  assert.equal(canEditNote(note, { id: 'author', role: 'viewer' }), true);
  assert.equal(canEditNote(note, { id: 'admin', role: 'administrator' }), true);
  assert.equal(canEditNote(note, { id: 'other', role: 'viewer' }), false);
  assert.equal(canEditNote(note, null), false);
  for (const revision of [null, undefined, '1', -1, 0.5]) assert.throws(() => noteRevision(revision));
  assert.equal(noteRevision(0), 0);
});

test('search uses all words and escapes literal percent and underscore', () => {
  assert.deepEqual(noteSearch(' batería   ABC_12 100% '), ['%batería%', '%ABC=_12%', '%100=%%']);
  assert.deepEqual(noteSearch(''), []);
  assert.throws(() => noteSearch('a'.repeat(301)), { status: 400 });
});

test('HTTP rejects another author and concurrent edits before altering a note', async () => {
  let writes = 0;
  const db = { query: async (sql) => {
    if (sql.startsWith('SELECT')) return [[{ id: 'note', created_by: 'author', revision: 2 }]];
    writes += 1;
    return [{ affectedRows: 0 }];
  } };
  const app = express(); app.use(express.json());
  app.use((req, _res, next) => { req.portalUser = { id: req.headers['x-test-actor'], role: 'viewer' }; next(); });
  app.use(createTechnicalNotesRouter(db));
  app.use((err, _req, res, _next) => res.status(err.status || 500).json({ error: err.message }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const request = (actor, path, body) => fetch(`http://127.0.0.1:${server.address().port}${path}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'x-test-actor': actor }, body: JSON.stringify(body) });
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    assert.equal((await request('other', '/note', { ...valid, revision: 2 })).status, 403);
    assert.equal((await request('other', '/note/archive', { archived: true, revision: 2 })).status, 403);
    assert.equal(writes, 0);
    assert.equal((await request('author', '/note', { ...valid, revision: 1 })).status, 409);
    assert.equal((await request('author', '/note/archive', { archived: true, revision: 1 })).status, 409);
    // Agregar o quitar imágenes está sujeto a la misma regla de autor/administrador.
    const writesBeforeImages = writes;
    assert.equal((await fetch(`${base}/note/images`, { method: 'POST', headers: { 'x-test-actor': 'other' } })).status, 403);
    assert.equal((await fetch(`${base}/note/images/img-1`, { method: 'DELETE', headers: { 'x-test-actor': 'other' } })).status, 403);
    assert.equal(writes, writesBeforeImages);
  } finally { await new Promise((resolve) => server.close(resolve)); }
});
