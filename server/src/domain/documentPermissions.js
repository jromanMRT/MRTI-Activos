export function canDeleteAssetDocument(document, actor) {
  if (!document || !actor?.id) return false;
  const administrator = String(actor.role || '').toLowerCase() === 'administrator';
  if (document.document_origin === 'local') {
    return administrator || Boolean(document.uploaded_by_user_id && document.uploaded_by_user_id === actor.id);
  }
  // Los documentos anteriores a la migración sólo pueden retirarse por un
  // administrador. El endpoint los archiva y conserva cualquier binario local
  // para recuperación; nunca intenta eliminarlos o modificarlos en SAP.
  return administrator;
}
