import test from 'node:test';
import assert from 'node:assert/strict';
import { assertCanComplete, checklistProgress, normalizeEntryUpdate, normalizeItemInput, reorderPlan } from '../src/domain/setupChecklist.js';

test('un paso de la plantilla exige texto y sección', () => {
  assert.deepEqual(normalizeItemInput({ section: ' Red ', label: '  Wi-Fi   corporativo ' }), { section: 'Red', label: 'Wi-Fi corporativo', help_text: null });
  assert.throws(() => normalizeItemInput({ section: 'Red', label: ' ' }), /El paso es obligatorio/);
  assert.deepEqual(normalizeItemInput({ is_active: false }, { partial: true }), { is_active: 0 });
});

test('solo acepta estados válidos para un paso', () => {
  assert.deepEqual(normalizeEntryUpdate({ status: 'na', note: ' no tiene VPN ' }), { status: 'na', note: 'no tiene VPN' });
  assert.throws(() => normalizeEntryUpdate({ status: 'hecho' }), /no es válido/);
  assert.throws(() => normalizeEntryUpdate({}), /No hay cambios/);
});

test('"no aplica" cuenta como resuelto y bloquea el cierre si queda algo pendiente', () => {
  const entries = [{ status: 'done' }, { status: 'na' }, { status: 'pending' }];
  assert.deepEqual(checklistProgress(entries), { total: 3, done: 1, na: 1, pending: 1, percent: 67 });
  assert.throws(() => assertCanComplete(entries), /Quedan 1 paso/);
  assert.doesNotThrow(() => assertCanComplete(entries.slice(0, 2)));
});

test('el nuevo orden se calcula en saltos de 10 y rechaza ids repetidos', () => {
  assert.deepEqual(reorderPlan([3, 1]), [{ id: 3, sort_order: 10 }, { id: 1, sort_order: 20 }]);
  assert.throws(() => reorderPlan([1, 1]), /no es válido/);
});
