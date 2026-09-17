// MySQL JSON columns may arrive decoded or as legacy JSON strings.
export function unitHistoryLabel(value) {
  try {
    const snapshot = typeof value === 'string' ? JSON.parse(value) : value;
    if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)
      || !Object.hasOwn(snapshot, 'unidad')) return 'Dato no disponible';
    if (snapshot.unidad == null || snapshot.unidad === '') return 'Sin unidad';
    return typeof snapshot.unidad === 'string' ? snapshot.unidad : 'Dato no disponible';
  } catch {
    return 'Dato no disponible';
  }
}
