import test from 'node:test';
import assert from 'node:assert/strict';
import { unitHistoryLabel } from '../../src/unitHistory.js';

test('unit history accepts decoded API snapshots and legacy JSON strings', () => {
  for (const snapshot of [{ unidad: 'Oficinas' }, { unidad: null }, { unidad: '' }]) {
    const expected = snapshot.unidad || 'Sin unidad';
    assert.equal(unitHistoryLabel(snapshot), expected);
    assert.equal(unitHistoryLabel(JSON.stringify(snapshot)), expected);
  }
});

test('unreadable history stays visible without crashing or inventing an empty unit', () => {
  for (const value of [undefined, null, '', '[object Object]', '{', 'null', '42', '[]', [], {}, { unidad: {} }]) {
    assert.equal(unitHistoryLabel(value), 'Dato no disponible');
  }
});
