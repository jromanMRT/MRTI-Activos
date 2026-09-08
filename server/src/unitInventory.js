// Read-only projection of legacy inventory labels, not RH units or physical sites.
export const UNIT_INVENTORY_SQL = `
  SELECT names.nombre, COALESCE(c.registros, 0) AS registros,
    COALESCE(c.vigentes, 0) AS vigentes, c.orden,
    COALESCE(a.total, 0) AS total, COALESCE(a.activos, 0) AS activos,
    COALESCE(a.mantenimiento, 0) AS mantenimiento, COALESCE(a.bajas, 0) AS bajas,
    COALESCE(a.asignados, 0) AS asignados
  FROM (
    SELECT NULLIF(TRIM(nombre), '') AS nombre FROM sap_unidades
    UNION SELECT NULLIF(TRIM(unidad), '') FROM activos
  ) names
  LEFT JOIN (
    SELECT NULLIF(TRIM(nombre), '') AS nombre, COUNT(*) AS registros,
      SUM(activa = 1 AND archived_at IS NULL) AS vigentes, MIN(orden) AS orden
    FROM sap_unidades GROUP BY NULLIF(TRIM(nombre), '')
  ) c ON c.nombre <=> names.nombre
  LEFT JOIN (
    SELECT NULLIF(TRIM(unidad), '') AS nombre, COUNT(*) AS total,
      SUM(estado = 'Activo') AS activos,
      SUM(estado = 'En mantenimiento') AS mantenimiento,
      SUM(estado = 'Baja') AS bajas,
      SUM(portal_user_id IS NOT NULL OR rh_employee_id IS NOT NULL OR tercero_id IS NOT NULL) AS asignados
    FROM activos GROUP BY NULLIF(TRIM(unidad), '')
  ) a ON a.nombre <=> names.nombre
  ORDER BY total DESC, names.nombre`;

export function unitInventoryFilter(query) {
  if (query.sin_unidad === '1') return { sql: "NULLIF(TRIM(unidad), '') IS NULL", values: [] };
  if (typeof query.unidad_operativa === 'string' && query.unidad_operativa.trim()) {
    return { sql: "NULLIF(TRIM(unidad), '') = ?", values: [query.unidad_operativa.trim()] };
  }
  return null;
}

export async function readUnitInventory(db) {
  const [rows] = await db.query(UNIT_INVENTORY_SQL);
  return rows.map((row) => ({ ...row, ...Object.fromEntries(
    ['registros', 'vigentes', 'total', 'activos', 'mantenimiento', 'bajas', 'asignados']
      .map((key) => [key, Number(row[key] || 0)]),
  ) }));
}
