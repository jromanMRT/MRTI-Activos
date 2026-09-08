// Bandeja accionable "Por revisar": extiende la proyección de sólo lectura
// de unitInventory.js con los motivos por los que un grupo necesita
// atención humana. No decide ni fusiona nada -- sólo explica por qué
// aparece, para que un administrador clasifique o corrija desde la ficha.
import { readUnitInventory } from './unitInventory.js';

export const REVIEW_REASON_LABELS = Object.freeze({
  sin_unidad: 'Equipos sin unidad registrada',
  fuera_de_catalogo: 'Nombre usado fuera del catálogo',
  catalogo_inactivo: 'Catálogo inactivo o archivado',
  nombre_repetido: 'Nombre repetido en el catálogo',
  sin_clasificar: 'Aún sin clasificar',
  etiqueta_historica_en_uso: 'Etiqueta histórica todavía asignada a equipos',
  referencia_pendiente: 'Clasificación sin referencia vigente',
});

export function unitReviewReasons(group, catalogRows) {
  const reasons = [];
  if (group.nombre === null) reasons.push('sin_unidad');
  else if (!group.registros) reasons.push('fuera_de_catalogo');
  else if (!group.vigentes) reasons.push('catalogo_inactivo');
  if (group.registros > 1) reasons.push('nombre_repetido');
  const usageKinds = catalogRows.map((row) => row.usage_kind || 'pending');
  if (catalogRows.length && usageKinds.every((kind) => kind === 'pending')) reasons.push('sin_clasificar');
  if (group.total > 0 && usageKinds.some((kind) => kind === 'legacy' || kind === 'obsolete')) reasons.push('etiqueta_historica_en_uso');
  if (catalogRows.some((row) => ['physical', 'organizational'].includes(row.usage_kind) && !row.reference_id)) reasons.push('referencia_pendiente');
  return reasons;
}

export async function unitReviewQueue(db) {
  const [inventory, [catalog]] = await Promise.all([
    readUnitInventory(db),
    db.query(`SELECT id, nombre, activa, orden, archived_at, usage_kind, reference_id, review_note,
        reviewed_by, reviewed_at, review_revision
      FROM sap_unidades`),
  ]);
  const byName = new Map();
  for (const row of catalog) {
    const key = row.nombre === null || row.nombre === undefined ? null : String(row.nombre).trim();
    if (!byName.has(key)) byName.set(key, []);
    byName.get(key).push(row);
  }
  return inventory
    .map((group) => {
      const catalogRows = group.nombre === null ? [] : (byName.get(group.nombre) || []);
      return { ...group, catalog: catalogRows, reasons: unitReviewReasons(group, catalogRows) };
    })
    .filter((row) => row.reasons.length > 0);
}
