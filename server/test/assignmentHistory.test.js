import test from 'node:test';
import assert from 'node:assert/strict';
import { assignmentPerson, assignmentReference, assignedUnit } from '../../src/assignmentHistory.js';

test('el historial resuelve personas por ID estable, no por nombres coincidentes', () => {
  const people = [{ id: 7, portal_user_id: 'core-a', full_name: 'Persona A' }, { id: 8, portal_user_id: 'core-b', full_name: 'Persona B' }];
  assert.equal(assignmentPerson({ rh_employee_id: '8' }, people), 'Persona B');
  assert.equal(assignmentPerson({ portal_user_id: 'core-a' }, people), 'Persona A');
  assert.deepEqual(assignmentReference({ rh_employee_id: 8 }), { employee_id: 8 });
  assert.deepEqual(assignmentReference({ portal_user_id: 'core-a' }), { portal_user_id: 'core-a' });
});
test('una caída de RH conserva referencias y terceros históricos legibles', () => {
  assert.equal(assignmentPerson({ rh_employee_id: 8 }, []), 'Empleado RH #8');
  assert.equal(assignmentPerson({ portal_user_id: 'core-a' }, []), 'Cuenta core-a');
  assert.equal(assignmentPerson({ tercero_nombre: 'Persona externa' }, []), 'Persona externa');
  assert.equal(assignmentReference({ tercero_id: 3 }), null);
});
test('la unidad procede del activo y no se sustituye por empresa de nómina', () => {
  assert.equal(assignedUnit(' Planta Norte '), 'Planta Norte');
  assert.equal(assignedUnit(null), 'Sin unidad asignada');
  assert.equal(assignedUnit('  '), 'Sin unidad asignada');
});
