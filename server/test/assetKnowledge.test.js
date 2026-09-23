import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createAssetKnowledgeRouter } from '../src/routes/assetKnowledge.js';
import { knowledgeRequest } from '../src/integrations/knowledgeClient.js';

const uid = '1aa78157-9969-4e10-af68-1c56ebefbba8';
const published = { id: 7, title: 'Cambiar batería', body: 'Procedimiento vigente', status: 'published' };

test('Tickets client forwards session with timeout and refuses redirects', async () => {
  const data = await knowledgeRequest('/7', 'Bearer user-session', async (url, options) => {
    assert.match(url, /\/api\/kb-articles\/7$/);
    assert.equal(options.headers.Authorization, 'Bearer user-session');
    assert.equal(options.redirect, 'error');
    assert.ok(options.signal);
    return Response.json({ success: true, data: published });
  });
  assert.deepEqual(data, published);
});

test('Tickets client distinguishes denied access, expired sessions, missing and unavailable articles', async () => {
  for (const status of [401, 403, 404, 500, 502]) {
    await assert.rejects(knowledgeRequest('', 'Bearer test', async () => new Response('', { status })), { status: status < 500 ? status : 503 });
  }
  await assert.rejects(knowledgeRequest('', 'Bearer test', async () => { throw new Error('network'); }), { status: 503 });
  await assert.rejects(knowledgeRequest('', 'Bearer test', async () => Response.json({ success: false })), { status: 503 });
});

async function fixture(t) {
  const state = { links: [], articles: [published], writes: 0, calls: [], unavailable: false };
  const db = { query: async (sql, params) => {
    if (sql.startsWith('SELECT asset_uid')) return [[params[0] === uid ? { asset_uid: uid } : undefined].filter(Boolean)];
    if (sql.startsWith('SELECT article_id')) return [state.links.filter((l) => !l.archived_at)];
    state.writes += 1;
    if (sql.startsWith('INSERT')) {
      const old = state.links.find((l) => l.article_id === params[1]);
      if (!old) state.links.push({ article_id: params[1], created_by: params[2] });
      else if (old.archived_at) { old.archived_at = null; old.created_by = params[2]; }
      return [{ affectedRows: 1 }];
    }
    const link = state.links.find((l) => l.article_id === params[2] && !l.archived_at && (l.created_by === params[3] || params[4] === 'administrator'));
    if (link) link.archived_at = new Date();
    return [{ affectedRows: link ? 1 : 0 }];
  } };
  const request = async (path, authorization) => {
    state.calls.push({ path, authorization });
    if (state.unavailable) throw Object.assign(new Error('Tickets unavailable'), { status: 503 });
    if (authorization === 'Bearer no-tickets') throw Object.assign(new Error('Tickets forbidden'), { status: 403 });
    return path.startsWith('?') ? state.articles : state.articles.find((a) => a.id === Number(path.slice(1))) || { status: 'missing' };
  };
  const app = express(); app.use(express.json());
  app.use((req, res, next) => {
    if (!req.headers.authorization) return res.sendStatus(401);
    req.portalUser = { id: req.headers['x-actor'] || 'author', role: req.headers['x-role'] || 'viewer' }; next();
  });
  app.use(createAssetKnowledgeRouter(db, request));
  app.use((err, req, res, next) => res.status(err.status || 500).json({ error: err.message }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); }));
  const call = (path = '', options = {}) => fetch(`http://127.0.0.1:${server.address().port}/${uid}${path}`, {
    ...options, headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json', ...options.headers },
  });
  return { state, call };
}

test('links are idempotent and never store article content or browser-supplied authors', async (t) => {
  const { state, call } = await fixture(t);
  for (let i = 0; i < 2; i++) assert.equal((await call('', { method: 'POST', body: JSON.stringify({ article_id: 7, created_by: 'forged', title: 'copied' }) })).status, 200);
  assert.deepEqual(state.links, [{ article_id: 7, created_by: 'author' }]);
  let response = await call();
  assert.equal(response.headers.get('cache-control'), 'no-store');
  let body = await response.json();
  assert.equal(body.data[0].article.title, published.title);
  assert.equal(body.data[0].article.href, '/tickets/knowledge-base?open=7');
  state.articles[0] = { ...published, title: 'Versión nueva' };
  body = await (await call()).json();
  assert.equal(body.data[0].article.title, 'Versión nueva');
});

test('drafts are neither searchable nor linkable and withdrawn titles are not disclosed', async (t) => {
  const { state, call } = await fixture(t);
  state.links.push({ article_id: 7, created_by: 'author' });
  state.articles = [{ ...published, status: 'draft', title: 'Private draft' }];
  const body = await (await call()).json();
  assert.equal(body.data[0].article, null);
  assert.equal(JSON.stringify(body).includes('Private draft'), false);
  assert.deepEqual((await (await call('/search')).json()).data, []);
  assert.equal((await call('', { method: 'POST', body: '{"article_id":7}' })).status, 404);
  assert.equal(state.writes, 0);
});

test('Tickets permissions and outages fail closed without mutating local links', async (t) => {
  const { state, call } = await fixture(t);
  for (const path of ['', '/search']) assert.equal((await call(path, { headers: { Authorization: 'Bearer no-tickets' } })).status, 403);
  assert.equal((await call('', { method: 'POST', headers: { Authorization: 'Bearer no-tickets' }, body: '{"article_id":7}' })).status, 403);
  state.unavailable = true;
  assert.equal((await call()).status, 503);
  assert.equal((await call('', { method: 'POST', body: '{"article_id":7}' })).status, 503);
  assert.equal(state.writes, 0);
});

test('only author or administrator can archive links and relinking restores them', async (t) => {
  const { state, call } = await fixture(t);
  state.links.push({ article_id: 7, created_by: 'author' });
  assert.equal((await call('/7', { method: 'DELETE', headers: { 'x-actor': 'other' } })).status, 403);
  assert.equal(state.links[0].archived_at, undefined);
  assert.equal((await call('/7', { method: 'DELETE' })).status, 200);
  assert.equal(state.links.length, 1);
  assert.deepEqual((await (await call()).json()).data, []);
  assert.equal((await call('', { method: 'POST', body: '{"article_id":7}' })).status, 200);
  assert.equal((await call('/7', { method: 'DELETE', headers: { 'x-actor': 'admin', 'x-role': 'administrator' } })).status, 200);
  assert.equal(state.articles.length, 1);
});

test('malformed IDs and long searches are rejected before Tickets calls', async (t) => {
  const { state, call } = await fixture(t);
  for (const id of [0, -1, '1/../../other', 4294967296, {}, null]) {
    assert.equal((await call('', { method: 'POST', body: JSON.stringify({ article_id: id }) })).status, 400);
  }
  assert.equal((await call(`/search?q=${'a'.repeat(301)}`)).status, 400);
  assert.equal(state.calls.length, 0);
  assert.equal(state.writes, 0);
});
