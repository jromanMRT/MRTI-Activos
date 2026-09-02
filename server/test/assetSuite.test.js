import test from 'node:test';
import assert from 'node:assert/strict';
import { RESOURCE_CONFIG, safeDocumentPath } from '../src/routes/assetSuite.js';

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
