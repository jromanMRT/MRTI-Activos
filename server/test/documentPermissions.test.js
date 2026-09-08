import test from 'node:test';
import assert from 'node:assert/strict';
import { canDeleteAssetDocument } from '../src/domain/documentPermissions.js';

test('permite al autor eliminar su propia carga local', () => {
  assert.equal(canDeleteAssetDocument(
    { document_origin: 'local', uploaded_by_user_id: 'user-one' },
    { id: 'user-one', role: 'viewer' }
  ), true);
});

test('un administrador puede corregir cualquier carga local', () => {
  assert.equal(canDeleteAssetDocument(
    { document_origin: 'local', uploaded_by_user_id: 'user-one' },
    { id: 'admin', role: 'administrator' }
  ), true);
});

test('protege cargas de otros usuarios y documentos importados disponibles', () => {
  assert.equal(canDeleteAssetDocument(
    { document_origin: 'local', uploaded_by_user_id: 'user-one' },
    { id: 'user-two', role: 'viewer' }
  ), false);
  assert.equal(canDeleteAssetDocument(
    { document_origin: 'sap', uploaded_by_user_id: null, local_storage_path: 'archivo.pdf' },
    { id: 'admin', role: 'administrator' }
  ), false);
});

test('permite al administrador retirar una referencia importada sin archivo', () => {
  assert.equal(canDeleteAssetDocument(
    { document_origin: 'sap', uploaded_by_user_id: null, local_storage_path: null },
    { id: 'admin', role: 'administrator' }
  ), true);
  assert.equal(canDeleteAssetDocument(
    { document_origin: 'sap', uploaded_by_user_id: null, local_storage_path: null },
    { id: 'user-one', role: 'viewer' }
  ), false);
});
