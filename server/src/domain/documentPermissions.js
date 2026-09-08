export function canDeleteAssetDocument(document, actor) {
  if (!document || !actor?.id) return false;
  const administrator = String(actor.role || '').toLowerCase() === 'administrator';
  if (document.document_origin === 'local') {
    return administrator || Boolean(document.uploaded_by_user_id && document.uploaded_by_user_id === actor.id);
  }
  // Un registro importado sin binario local es sólo una referencia rota. Un
  // administrador puede archivarlo, pero nunca borrar desde aquí un documento
  // histórico que sí tenga archivo disponible.
  return administrator && !document.local_storage_path;
}
