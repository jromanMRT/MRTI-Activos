export function unitInventoryHref(name) {
  const params = new URLSearchParams(name === null ? { sin_unidad: '1' } : { unidad_operativa: name });
  return `/inventario?${params}`;
}

export function inventoryContext(search) {
  const source = new URLSearchParams(search);
  const params = new URLSearchParams();
  if (source.get('sin_unidad') === '1') params.set('sin_unidad', '1');
  else if (source.get('unidad_operativa')) params.set('unidad_operativa', source.get('unidad_operativa'));
  return params.toString();
}

export function inventoryReturnHref(search) {
  const query = inventoryContext(search);
  return `/inventario${query ? `?${query}` : ''}`;
}

export function unitCatalogStatus(row) {
  if (row.nombre === null) return 'Sin unidad registrada';
  if (!row.registros) return 'Fuera del catálogo';
  if (!row.vigentes) return 'Catálogo inactivo / archivado';
  if (row.registros > 1) return 'Nombre repetido en catálogo';
  return 'En catálogo';
}
