import test from 'node:test';
import assert from 'node:assert/strict';
import { matchObservedDevices, normalizeAssetKey } from '../src/reconciliation.js';

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
