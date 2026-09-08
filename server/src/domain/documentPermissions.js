export function canDeleteAssetDocument(document, actor) {
  if (!document || document.document_origin !== 'local' || !actor?.id) return false;
  if (String(actor.role || '').toLowerCase() === 'administrator') return true;
  return Boolean(document.uploaded_by_user_id && document.uploaded_by_user_id === actor.id);
}
