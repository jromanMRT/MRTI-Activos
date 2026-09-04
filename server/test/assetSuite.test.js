import test from 'node:test';
import assert from 'node:assert/strict';
import { findIncompleteAssetFields, normalizeResourceCreateInput, RESOURCE_CONFIG, resolveResourceSort, safeDocumentPath } from '../src/routes/assetSuite.js';

test('los catálogos públicos nunca incluyen columnas cifradas', () => {
  for (const config of Object.values(RESOURCE_CONFIG)) {
    assert.equal(config.columns.some((column) => /password|encrypted|clave_cifrado|codigo_verificacion/i.test(column)), false);
  }
  assert.deepEqual(RESOURCE_CONFIG.nvr.secretColumns, ['password_encrypted', 'clave_cifrado_encrypted', 'codigo_verificacion_encrypted']);
});

test('la descarga rechaza rutas absolutas y traversal', () => {
  assert.equal(safeDocumentPath('/etc/passwd'), null);
  assert.equal(safeDocumentPath('../../etc/passwd'), null);
  assert.match(safeDocumentPath('10-documento.pdf'), /storage\/asset-documents\/10-documento\.pdf$/);
});

test('el orden de catálogos sólo admite columnas públicas conocidas', () => {
  assert.equal(resolveResourceSort(RESOURCE_CONFIG.componentes, 'marca', 'asc'), '`marca` ASC');
  assert.equal(resolveResourceSort(RESOURCE_CONFIG.componentes, 'marca', 'desc'), '`marca` DESC');
  assert.equal(resolveResourceSort(RESOURCE_CONFIG.componentes, 'marca; DROP TABLE activos', 'asc'), '`id` ASC');
  assert.equal(resolveResourceSort(RESOURCE_CONFIG['config-alertas'], 'clave', 'desc'), '`clave` DESC');
});

test('los campos incompletos se reportan sin considerar espacios como información', () => {
  const fields = findIncompleteAssetFields({
    marca: 'MRT', modelo: '  ', service_tag: null, numero_serie: 'SER-1', usuario_asignado: 'Ana', unidad: 'TI', fecha_compra: '2026-09-04', empresa: '',
  });
  assert.deepEqual(fields, ['modelo', 'service_tag', 'empresa']);
});

test('las altas locales aceptan sólo campos permitidos y normalizan tipos', () => {
  const { values, secretValues } = normalizeResourceCreateInput(RESOURCE_CONFIG.impresoras, { modelo: ' LaserJet ', conteo_paginas: '42', sap_id: 999, archived_at: '2020-01-01' });
  assert.deepEqual(values, { modelo: 'LaserJet', conteo_paginas: 42 });
  assert.deepEqual(secretValues, {});
  assert.equal(Object.prototype.hasOwnProperty.call(values, 'sap_id'), false);
});

test('las contraseñas locales se separan de los valores públicos y se exigen', () => {
  const result = normalizeResourceCreateInput(RESOURCE_CONFIG.passwords, { categoria: 'Red', password: 'secreto' });
  assert.deepEqual(result.values, { categoria: 'Red' });
  assert.deepEqual(result.secretValues, { password_encrypted: 'secreto' });
  assert.throws(() => normalizeResourceCreateInput(RESOURCE_CONFIG.passwords, { categoria: 'Red' }), /password/);
});
