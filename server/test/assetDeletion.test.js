import test from 'node:test';
import assert from 'node:assert/strict';
import { confirmationMatches, deleteAsset } from '../src/domain/assetDeletion.js';

test('el Código TI debe coincidir; sólo se ignoran mayúsculas y espacios en los extremos', () => {
  assert.equal(confirmationMatches('TI-0123', 'TI-0123'), true);
  assert.equal(confirmationMatches('TI-0123', '  ti-0123 '), true);
  assert.equal(confirmationMatches('TI-0123', 'TI-012'), false);
  assert.equal(confirmationMatches('TI-0123', 'TI-01234'), false);
  assert.equal(confirmationMatches('TI-0123', 'TI 0123'), false);
  assert.equal(confirmationMatches('TI-0123', ''), false);
  assert.equal(confirmationMatches('TI-0123', undefined), false);
  assert.equal(confirmationMatches('', ''), false);
  assert.equal(confirmationMatches(null, null), false);
});

function mockPool(asset) {
  const queries = [];
  const connection = {
    async beginTransaction() { queries.push('BEGIN'); },
    async commit() { queries.push('COMMIT'); },
    async rollback() { queries.push('ROLLBACK'); },
    release() { queries.push('RELEASE'); },
    async query(sql, params) {
      queries.push([sql.replace(/\s+/g, ' ').trim(), params]);
      if (/^\s*SELECT id, asset_uid, center_code FROM activos WHERE id = \? AND deleted_at IS NULL FOR UPDATE/.test(sql)) return [[asset].filter(Boolean)];
      return [{ affectedRows: 1 }];
    },
  };
  return { queries, pool: { async getConnection() { return connection; } } };
}

const ASSET = { id: 7, asset_uid: '11111111-2222-3333-4444-555555555555', center_code: 'TI-0123' };
const ACTOR = { id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', name: 'Administrador TI' };

test('con el Código TI correcto marca el activo como eliminado y cierra su asignación', async () => {
  const { queries, pool } = mockPool(ASSET);
  const result = await deleteAsset(pool, '7', 'ti-0123', ACTOR);
  assert.deepEqual(result, { id: 7, asset_uid: ASSET.asset_uid, center_code: 'TI-0123', deleted: true });
  const updates = queries.filter((entry) => Array.isArray(entry) && entry[0].startsWith('UPDATE'));
  assert.match(updates[0][0], /UPDATE activo_asignaciones SET unassigned_at/);
  assert.deepEqual(updates[0][1], [ASSET.asset_uid]);
  assert.match(updates[1][0], /deleted_at = NOW\(\).*estado = 'Inactivo'.*portal_user_id = NULL/);
  assert.deepEqual(updates[1][1], [ACTOR.id, ACTOR.name, 7]);
  assert.ok(queries.includes('COMMIT'));
  assert.ok(queries.includes('RELEASE'));
});

test('un código distinto no toca nada y responde 422 con el código esperado', async () => {
  const { queries, pool } = mockPool(ASSET);
  await assert.rejects(deleteAsset(pool, '7', 'TI-0124', ACTOR), (error) => {
    assert.equal(error.status, 422);
    assert.match(error.message, /TI-0123/);
    return true;
  });
  assert.equal(queries.some((entry) => Array.isArray(entry) && entry[0].startsWith('UPDATE')), false);
  assert.ok(queries.includes('ROLLBACK'));
  assert.ok(queries.includes('RELEASE'));
});

test('un activo inexistente o ya eliminado responde 404', async () => {
  const { pool } = mockPool(null);
  await assert.rejects(deleteAsset(pool, '7', 'TI-0123', ACTOR), (error) => error.status === 404);
});
