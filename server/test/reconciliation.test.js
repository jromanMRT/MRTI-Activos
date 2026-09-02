import test from 'node:test';
import assert from 'node:assert/strict';
import { matchObservedDevices, matchRhEmployees, nameTokens, namesLikelyMatch, normalizeAssetKey, normalizeEmployeeNumber } from '../src/reconciliation.js';

test('normaliza series y etiquetas sin separadores', () => {
  assert.equal(normalizeAssetKey(' ab-12 34 '), 'AB1234');
});

test('vincula por serie o etiqueta patrimonial sólo cuando el resultado es único', () => {
  const assets = [
    { asset_uid: 'asset-1', numero_serie: 'SER-001', service_tag: null, cod_activo_fijo: 'AF-10' },
    { asset_uid: 'asset-2', numero_serie: 'SER-002', service_tag: 'TAG-2', cod_activo_fijo: 'AF-20' },
  ];
  const result = matchObservedDevices(assets, [
    { id: 'device-1', serial_number: 'ser001', inventory_tag: null },
    { id: 'device-2', serial_number: null, inventory_tag: 'af 20' },
    { id: 'device-3', serial_number: 'missing', inventory_tag: null },
  ]);
  assert.deepEqual(result.map(({ device_id, asset_id, status }) => ({ device_id, asset_id, status })), [
    { device_id: 'device-1', asset_id: 'asset-1', status: 'matched' },
    { device_id: 'device-2', asset_id: 'asset-2', status: 'matched' },
    { device_id: 'device-3', asset_id: null, status: 'unmatched' },
  ]);
});

test('normaliza el número de empleado sin depender de ceros a la izquierda', () => {
  assert.equal(normalizeEmployeeNumber('0926'), '926');
  assert.equal(normalizeEmployeeNumber('926'), '926');
  assert.equal(normalizeEmployeeNumber('0000'), '0');
  assert.equal(normalizeEmployeeNumber(''), '');
});

test('compara nombres por palabras compartidas, sin importar acentos ni orden', () => {
  assert.equal(namesLikelyMatch('Martinez Mendoza Genoveva', 'GENOVEVA MARTINEZ MENDOZA'), true);
  assert.equal(namesLikelyMatch('Alberto Piñon Carta', 'Alberto Piñon Carta'), true);
  assert.equal(namesLikelyMatch('Ramirez Calderon Francisco Javier', 'Rodolfo Polanco Dominguez'), false);
  assert.equal(namesLikelyMatch('Dañada', 'Fernando Rubio Rubio'), false);
  assert.equal(nameTokens('Dañada').size, 1);
});

test('vincula un activo con su empleado de RH solo cuando el número y el nombre coinciden', () => {
  const employees = [
    { id: 1, employee_number: '0584', full_name: 'GENOVEVA MARTINEZ MENDOZA', portal_user_id: null },
    { id: 2, employee_number: '0055', full_name: 'Rodolfo Polanco Dominguez', portal_user_id: null },
    { id: 3, employee_number: '0703', full_name: 'JORGE PATRICIO PACHECO IBARRA', portal_user_id: 'uuid-3' },
  ];
  const assets = [
    { id: 10, id_empleado: '0584', usuario_asignado: 'Martinez Mendoza Genoveva' }, // matched
    { id: 11, id_empleado: '0055', usuario_asignado: 'Ramirez Calderon Francisco Javier' }, // name_mismatch
    { id: 12, id_empleado: '0703', usuario_asignado: 'Dañada' }, // name_mismatch (no es una persona)
    { id: 13, id_empleado: '9999', usuario_asignado: 'Alguien' }, // not_found
    { id: 14, id_empleado: '', usuario_asignado: 'Laboratorio Absorcion' }, // no_id
  ];
  const result = matchRhEmployees(assets, employees);
  assert.deepEqual(result.map(({ asset_id, status, employee }) => ({ asset_id, status, employeeId: employee?.id ?? null })), [
    { asset_id: 10, status: 'matched', employeeId: 1 },
    { asset_id: 11, status: 'name_mismatch', employeeId: 2 },
    { asset_id: 12, status: 'name_mismatch', employeeId: 3 },
    { asset_id: 13, status: 'not_found', employeeId: null },
    { asset_id: 14, status: 'no_id', employeeId: null },
  ]);
});

test('marca ambiguo cuando dos empleados de RH comparten el mismo número', () => {
  const employees = [
    { id: 1, employee_number: '0100', full_name: 'Ana Lopez' },
    { id: 2, employee_number: '0100', full_name: 'Beto Ramirez' },
  ];
  const result = matchRhEmployees([{ id: 20, id_empleado: '0100', usuario_asignado: 'Ana Lopez' }], employees);
  assert.equal(result[0].status, 'ambiguous');
});
