export function noteError(message, status = 400) {
  return Object.assign(new Error(message), { status });
}

export function canEditNote(note, actor) {
  return Boolean(actor?.id && (actor.role === 'administrator' || note.created_by === actor.id));
}

export function noteRevision(value) {
  if (!Number.isInteger(value) || value < 0) throw noteError('La revisión de la nota no es válida. Recarga la lista.');
  return value;
}

export function normalizeNote(body = {}) {
  const limits = { title: 180, equipment_reference: 500, serial_reference: 180, replacement_reference: 500, purchase_url: 2000, content: 20000, asset_uid: 36 };
  const result = {};
  for (const [field, max] of Object.entries(limits)) {
    const value = body[field] ?? '';
    if (typeof value !== 'string' || value.length > max) throw noteError(`El campo ${field} debe ser texto de hasta ${max} caracteres.`);
    result[field] = value.trim() || null;
  }
  if (!result.title || !result.content) throw noteError('Escribe un título y el contenido de la nota.');
  if (result.asset_uid && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(result.asset_uid)) throw noteError('El equipo vinculado no es válido.');
  if (result.purchase_url) {
    let url;
    try { url = new URL(result.purchase_url); } catch { throw noteError('El enlace de compra debe ser una dirección http o https válida.'); }
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw noteError('El enlace de compra debe ser una dirección http o https sin credenciales.');
  }
  return result;
}

export function noteSearch(query) {
  const text = String(query || '').trim();
  if (text.length > 300) throw noteError('La búsqueda admite hasta 300 caracteres.');
  // LIKE uses '=' as escape so percent/underscore remain literal search text.
  return text.split(/\s+/).filter(Boolean).map((word) => `%${word.replace(/[=%_]/g, '=$&')}%`);
}
