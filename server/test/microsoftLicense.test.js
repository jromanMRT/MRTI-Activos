import test from 'node:test';
import assert from 'node:assert/strict';
import { microsoftExpiration, normalizeMicrosoftLicense } from '../src/domain/microsoftLicense.js';

test('calcula el vencimiento por años y ajusta el 29 de febrero', () => {
  assert.equal(microsoftExpiration('2026-10-09', 3), '2029-10-09');
  assert.equal(microsoftExpiration('2024-02-29', 1), '2025-02-28');
});

test('la suscripción exige inicio y años y sobrescribe el vencimiento manual', () => {
  assert.deepEqual(normalizeMicrosoftLicense({
    ms_license_mode: 'subscription', fecha_suscripcion: '2026-03-14', anos_suscripcion: '2', ms_vencimiento: '2099-01-01',
  }), {
    ms_license_mode: 'subscription', fecha_suscripcion: '2026-03-14', anos_suscripcion: 2, ms_vencimiento: '2028-03-14',
  });
  assert.throws(() => normalizeMicrosoftLicense({ ms_license_mode: 'subscription', anos_suscripcion: 1 }), /requiere fecha/);
});

test('la licencia perpetua no conserva vencimiento ni años positivos', () => {
  assert.deepEqual(normalizeMicrosoftLicense({ ms_license_mode: 'perpetual', anos_suscripcion: 5, ms_vencimiento: '2030-01-01' }), {
    ms_license_mode: 'perpetual', anos_suscripcion: 0, ms_vencimiento: null,
  });
});
