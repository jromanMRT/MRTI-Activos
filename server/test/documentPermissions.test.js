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

test('protege cargas de otros usuarios y documentos importados', () => {
  assert.equal(canDeleteAssetDocument(
    { document_origin: 'local', uploaded_by_user_id: 'user-one' },
    { id: 'user-two', role: 'viewer' }
  ), false);
  assert.equal(canDeleteAssetDocument(
    { document_origin: 'sap', uploaded_by_user_id: null },
    { id: 'admin', role: 'administrator' }
  ), false);
});
