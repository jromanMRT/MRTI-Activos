import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { getAssetAssignmentProfile } from '../src/integrations/rhClient.js';

test('la empresa y el nombre de una asignación se validan en RH', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.match(String(url), /asset-assignment-profile\?employee_id=42$/);
    assert.equal(options.headers.Authorization, 'Bearer fixture');
    return new Response(JSON.stringify({ data: { full_name: 'Persona RH', company_name: 'Empresa RH' } }));
  });
  assert.deepEqual(await getAssetAssignmentProfile('Bearer fixture', { employeeId: 42 }), {
    full_name: 'Persona RH', company_name: 'Empresa RH',
  });
});

test('si RH no valida la ficha, la asignación falla cerrada', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('offline'); });
  await assert.rejects(getAssetAssignmentProfile('Bearer fixture', { portalUserId: 'fixture' }),
    (error) => error.status === 503);
});

test('el historial se archiva sin borrar y sólo cuando está finalizado', async () => {
  const root = new URL('../../', import.meta.url);
  const [route, migration, meta] = await Promise.all([
    readFile(new URL('server/src/routes/activos.js', root), 'utf8'),
    readFile(new URL('mysql/migrations/020_assignment_history_archive.sql', root), 'utf8'),
    readFile(new URL('server/src/meta.js', root), 'utf8'),
  ]);
  assert.match(route, /archived_at IS NULL/);
  assert.match(route, /unassigned_at IS NOT NULL/);
  assert.match(route, /administratorOnly/);
  assert.doesNotMatch(route, /DELETE FROM activo_asignaciones/);
  assert.match(migration, /archive_reason/);
  assert.match(meta, /Empresa \(según empleado asignado\).*readOnly: true/);
});
