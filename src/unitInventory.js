export function unitInventoryHref(name) {
  const params = new URLSearchParams(name === null ? { sin_unidad: '1' } : { unidad_operativa: name });
  return `/inventario?${params}`;
}

export function unitCatalogStatus(row) {
  if (row.nombre === null) return 'Sin unidad registrada';
  if (!row.registros) return 'Fuera del catálogo';
  if (!row.vigentes) return 'Catálogo inactivo / archivado';
  if (row.registros > 1) return 'Nombre repetido en catálogo';
  return 'En catálogo';
}
