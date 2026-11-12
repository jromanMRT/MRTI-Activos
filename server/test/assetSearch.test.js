import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAssetTextSearch } from '../src/domain/assetSearch.js';

test('inventory search requires every separated term without requiring a contiguous phrase', () => {
  const result = buildAssetTextSearch('  jorge   roman ');

  assert.deepEqual(result.params, ['%jorge%', '%roman%']);
  assert.equal((result.sql.match(/LIKE \? ESCAPE '='/g) || []).length, 2);
  assert.match(result.sql, /LIKE \? ESCAPE '=' AND CONCAT_WS/);
});

test('inventory search can match terms across any visible searchable field', () => {
  const result = buildAssetTextSearch('dell 00274');

  assert.deepEqual(result.params, ['%dell%', '%00274%']);
  assert.match(result.sql, /COALESCE\(marca, ''\)/);
  assert.match(result.sql, /COALESCE\(center_code, ''\)/);
});

test('inventory search binds LIKE metacharacters as literal text', () => {
  const result = buildAssetTextSearch('TI_00 100%');

  assert.deepEqual(result.params, ['%TI=_00%', '%100=%%']);
  assert.ok(!result.sql.includes('TI_00'));
});

test('blank inventory searches do not add SQL', () => {
  assert.deepEqual(buildAssetTextSearch('   '), { sql: '', params: [] });
});
