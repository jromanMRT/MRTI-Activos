import test from 'node:test';
import assert from 'node:assert/strict';
import { pickFortiGateWritableFields } from '../src/integrations/sapClient.js';

test('sólo los campos que existen en dbo.FortiGate se envían a SAP', () => {
  assert.deepEqual(pickFortiGateWritableFields({
    software: 'FortiOS 7.2', numero_serie: 'FGT60ETK19060496', proyecto: 'Matriz',
    fecha_expira: '2027-01-01', comentario: 'Licencia renovada',
    ip_address: '192.168.10.1', asset_uid: 'uuid', sap_id: 4, id: 12,
    record_origin: 'local', synced_at: '2026-01-01', archived_at: null,
    locally_edited_at: '2026-01-01', locally_edited_by: 'uuid-user',
    sap_synced_at: null, sap_sync_error: null,
  }), {
    software: 'FortiOS 7.2', numero_serie: 'FGT60ETK19060496', proyecto: 'Matriz',
    fecha_expira: '2027-01-01', comentario: 'Licencia renovada',
  });
});

test('un alta sin sap_id no incluye ip_address aunque venga en el body', () => {
  const picked = pickFortiGateWritableFields({ numero_serie: 'FGT-1', ip_address: '10.0.0.1' });
  assert.deepEqual(picked, { numero_serie: 'FGT-1' });
  assert.equal(Object.prototype.hasOwnProperty.call(picked, 'ip_address'), false);
});
