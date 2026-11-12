const SEARCHABLE_COLUMNS = Object.freeze([
  'descripcion',
  'usuario_asignado',
  'numero_serie',
  'service_tag',
  'modelo',
  'marca',
  'center_code',
]);

function escapeLikeTerm(value) {
  return value.replaceAll('=', '==').replaceAll('%', '=%').replaceAll('_', '=_');
}

export function buildAssetTextSearch(query) {
  const terms = String(query || '').trim().split(/\s+/u).filter(Boolean);
  if (!terms.length) return { sql: '', params: [] };

  const searchableText = `CONCAT_WS(' ', ${SEARCHABLE_COLUMNS.map((column) => `COALESCE(${column}, '')`).join(', ')})`;
  return {
    sql: terms.map(() => `${searchableText} LIKE ? ESCAPE '='`).join(' AND '),
    params: terms.map((term) => `%${escapeLikeTerm(term)}%`),
  };
}
