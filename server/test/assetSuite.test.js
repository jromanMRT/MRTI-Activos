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

test('fortigate, impresoras, starlink, dominios, componentes, mantenimientos y nvr admiten edición manual; unidades y passwords no', () => {
  const editableResources = Object.entries(RESOURCE_CONFIG).filter(([, config]) => config.editable).map(([name]) => name);
  assert.deepEqual(new Set(editableResources), new Set(['impresoras', 'starlink', 'fortigate', 'dominios', 'componentes', 'mantenimientos', 'nvr']));
  assert.equal(RESOURCE_CONFIG.unidades.editable, undefined);
  // passwords exige la contraseña como campo obligatorio en create.required;
  // permitir `editable` forzaría re-enviarla en cada PATCH aunque el edit
  // genérico nunca la guarda (ver siguiente test) -- confusión de seguridad,
  // no sólo de UX. Se queda sin edición manual a propósito.
  assert.equal(RESOURCE_CONFIG.passwords.editable, undefined);
  const { values } = normalizeResourceCreateInput(RESOURCE_CONFIG.fortigate, { numero_serie: 'FGT60ETK19060496', ip_address: '192.168.10.1', sap_id: 999 });
  assert.deepEqual(values, { numero_serie: 'FGT60ETK19060496', ip_address: '192.168.10.1' });
  assert.equal(Object.prototype.hasOwnProperty.call(values, 'sap_id'), false);
});

test('el PATCH genérico de nvr nunca puede tocar las contraseñas (normalizeResourceCreateInput sólo expone `values`, no `secretValues`)', () => {
  const nvrEdit = normalizeResourceCreateInput(RESOURCE_CONFIG.nvr, { alias: 'Cámara entrada', password: 'intento-de-fuga' });
  assert.deepEqual(nvrEdit.values, { alias: 'Cámara entrada' });
  assert.equal(Object.prototype.hasOwnProperty.call(nvrEdit.values, 'password'), false);
});

test('sólo fortigate está marcado con linksMonitor (asset_uid es exclusivo del enlace con Monitor)', () => {
  const linked = Object.entries(RESOURCE_CONFIG).filter(([, config]) => config.linksMonitor).map(([name]) => name);
  assert.deepEqual(linked, ['fortigate']);
});
