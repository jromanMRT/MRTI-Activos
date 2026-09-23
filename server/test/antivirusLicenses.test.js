import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalAntivirusLicense, groupAntivirusLicenses } from '../src/antivirusLicenses.js';

test('agrupa por la misma licencia sin importar espacios o mayúsculas', () => {
  assert.equal(canonicalAntivirusLicense('  abc   123 '), 'ABC 123');
  const [group] = groupAntivirusLicenses([
    { id: 2, center_code: 'TI-2', av_licencia: 'abc 123', fecha_adquisicion: '2026-01-01', fecha_vence: '2027-01-01', dias_restantes: 100 },
    { id: 1, center_code: 'TI-1', av_licencia: ' ABC   123 ', fecha_adquisicion: '2026-01-01', fecha_vence: '2027-01-01', dias_restantes: 100 },
  ]);
  assert.equal(group.device_count, 2);
  assert.equal(group.capacity, 5);
  assert.equal(group.available_seats, 3);
  assert.equal(group.center_codes, 'TI-1, TI-2');
  assert.equal(group.date_status, 'Fechas uniformes');
});

test('señala fechas distintas y capacidad excedida sin elegir una fecha silenciosamente', () => {
  const [group] = groupAntivirusLicenses(Array.from({ length: 6 }, (_, index) => ({
    id: index + 1,
    center_code: `TI-${index + 1}`,
    av_licencia: 'LIC-1',
    fecha_adquisicion: index ? '2026-01-02' : '2026-01-01',
    fecha_vence: index ? '2027-01-02' : '2027-01-01',
    dias_restantes: index ? 101 : 100,
  })));
  assert.equal(group.fecha_vence, '2027-01-01');
  assert.equal(group.fecha_vence_hasta, '2027-01-02');
  assert.equal(group.date_status, 'Compras y vencimientos distintos');
  assert.equal(group.over_capacity, true);
  assert.equal(group.available_seats, 0);
});

test('equipos sin clave permanecen separados para no crear vínculos falsos', () => {
  const groups = groupAntivirusLicenses([
    { id: 1, center_code: 'TI-1', av_licencia: null, fecha_vence: '2027-01-01', dias_restantes: 100 },
    { id: 2, center_code: 'TI-2', av_licencia: '', fecha_vence: '2027-01-01', dias_restantes: 100 },
  ]);
  assert.equal(groups.length, 2);
  assert.ok(groups.every((group) => group.device_count === 1 && group.license_key === null));
});
