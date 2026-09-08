import test from 'node:test';
import assert from 'node:assert/strict';
import { planUnitSync } from '../src/integrations/sapSync.js';

test('una unidad protegida (unit_is_manual) nunca se toca aunque SAP traiga otro valor', () => {
  assert.deepEqual(
    planUnitSync({ unit_is_manual: 1, unidad: 'Contabilidad' }, { unidad: 'DONADA' }),
    { skipUnit: true, bumpRevision: false }
  );
});

test('una unidad no protegida se actualiza normalmente y sube la revisión si SAP la cambió', () => {
  assert.deepEqual(
    planUnitSync({ unit_is_manual: 0, unidad: 'TI' }, { unidad: 'Contabilidad' }),
    { skipUnit: false, bumpRevision: true }
  );
});

test('si SAP manda el mismo valor que ya había, no hay nada que auditar', () => {
  assert.deepEqual(
    planUnitSync({ unit_is_manual: 0, unidad: 'TI' }, { unidad: 'TI' }),
    { skipUnit: false, bumpRevision: false }
  );
});

test('null y cadena vacía se tratan como el mismo valor "sin unidad"', () => {
  assert.deepEqual(
    planUnitSync({ unit_is_manual: 0, unidad: null }, { unidad: null }),
    { skipUnit: false, bumpRevision: false }
  );
});

test('una fila de SAP sin la columna unidad no toca nada de esta lógica', () => {
  assert.deepEqual(
    planUnitSync({ unit_is_manual: 0, unidad: 'TI' }, { marca: 'Dell' }),
    { skipUnit: false, bumpRevision: false }
  );
});

test('unit_is_manual con valores truthy heredados (1 numérico o "1" de MySQL) protege igual', () => {
  assert.equal(planUnitSync({ unit_is_manual: '1', unidad: 'TI' }, { unidad: 'Otra' }).skipUnit, true);
});
