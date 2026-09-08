import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeEquivalentSelfAssignments } from '../src/domain/selfAssignments.js';

test('combina activos Core y RH de Gerardo aunque el nombre cambie de orden y el número tenga ceros', () => {
  const core = [{ asset_uid: 'asset-253', id_empleado: '168', usuario_asignado: 'Sanchez Contreras Gerardo' }];
  const rh = [
    { asset_uid: 'asset-179', id_empleado: '0168', usuario_asignado: 'Gerardo Sanchez Contreras' },
    { asset_uid: 'otro', id_empleado: '0168', usuario_asignado: 'Otra Persona Distinta' },
  ];
  assert.deepEqual(mergeEquivalentSelfAssignments(core, rh).map((asset) => asset.asset_uid), ['asset-253', 'asset-179']);
});

test('no mezcla homónimos parciales, números diferentes ni repite un mismo activo', () => {
  const core = [{ asset_uid: 'one', id_empleado: '0100', usuario_asignado: 'Ana Lopez Garcia' }];
  const rh = [
    { asset_uid: 'one', id_empleado: '100', usuario_asignado: 'Garcia Ana Lopez' },
    { asset_uid: 'two', id_empleado: '101', usuario_asignado: 'Ana Lopez Garcia' },
    { asset_uid: 'three', id_empleado: '100', usuario_asignado: 'Ana Ramirez' },
  ];
  assert.deepEqual(mergeEquivalentSelfAssignments(core, rh).map((asset) => asset.asset_uid), ['one']);
});
