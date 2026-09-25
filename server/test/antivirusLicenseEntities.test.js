import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeLicenseInput } from '../src/routes/antivirusLicenses.js';

test('una licencia nueva usa capacidad explícita y normaliza su clave', () => {
  assert.deepEqual(normalizeLicenseInput({
    product_id: '1', license_key: '  eset   123 ', seat_capacity: '5',
    purchase_date: '2026-09-01', expires_on: '2027-09-01',
  }), {
    product_id: 1, license_key: 'eset   123', license_key_normalized: 'ESET 123',
    seat_capacity: 5, display_name: null, provider: null, purchase_reference: null,
    notes: null, purchase_date: '2026-09-01', expires_on: '2027-09-01',
  });
});

test('rechaza capacidad inválida y caducidad anterior a la compra', () => {
  assert.throws(() => normalizeLicenseInput({ product_id: 1, license_key: 'A', seat_capacity: 0 }), /capacidad/);
  assert.throws(() => normalizeLicenseInput({ product_id: 1, license_key: 'A', seat_capacity: 5, purchase_date: '2027-01-01', expires_on: '2026-01-01' }), /anterior/);
});

test('una edición parcial no borra campos ausentes', () => {
  assert.deepEqual(normalizeLicenseInput({ seat_capacity: 8 }, { partial: true }), { seat_capacity: 8 });
});
