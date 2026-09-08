import test from 'node:test';
import assert from 'node:assert/strict';
import { destinationAssetState, normalizeOffboardingItem, parseAccessories } from '../src/domain/offboarding.js';

test('mantiene abierta una devolución pendiente con fecha compromiso', () => {
  assert.deepEqual(normalizeOffboardingItem({ status: 'pending', due_date: '2026-09-12', accessories: ['charger', 'charger', 'invalid'], notes: 'Por entregar' }), {
    status: 'pending', due_date: '2026-09-12', return_date: null, condition_state: null,
    destination: null, accessories: ['charger'], notes: 'Por entregar',
  });
});

test('exige condición y destino al confirmar una devolución', () => {
  assert.throws(() => normalizeOffboardingItem({ status: 'returned' }), /Condición y destino/);
  assert.throws(() => normalizeOffboardingItem({ status: 'returned', condition_state: 'good', destination: 'unknown' }), /destino/);
  assert.throws(() => normalizeOffboardingItem({ status: 'pending', due_date: '2026-02-30' }), /fecha compromiso/);
  const item = normalizeOffboardingItem({ status: 'returned', return_date: '2026-09-08', condition_state: 'fair', destination: 'maintenance', accessories: ['charger'] });
  assert.equal(item.status, 'returned');
  assert.equal(item.destination, 'maintenance');
});

test('traduce el destino a los valores canónicos del activo y tolera JSON histórico', () => {
  assert.deepEqual(destinationAssetState('available'), { estado: 'Activo', active: 'Libre' });
  assert.deepEqual(destinationAssetState('maintenance'), { estado: 'En mantenimiento', active: 'tYES' });
  assert.deepEqual(destinationAssetState('retired'), { estado: 'Baja', active: 'tNO' });
  assert.deepEqual(parseAccessories('["charger","bag"]'), ['charger', 'bag']);
  assert.deepEqual(parseAccessories('incorrecto'), []);
});
