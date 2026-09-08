import { namesLikelyMatch, normalizeEmployeeNumber } from '../reconciliation.js';

// Durante la migración una misma persona puede tener activos vinculados por
// UUID de Core y otros por ficha RH. Un activo ya enlazado al UUID sirve como
// ancla sólo cuando número de empleado y nombre coinciden con suficiente
// fuerza; nunca se agrupa únicamente por un número reutilizable entre empresas.
export function mergeEquivalentSelfAssignments(coreLinked = [], rhLinked = []) {
  const anchors = coreLinked.filter((asset) => normalizeEmployeeNumber(asset.id_empleado) && asset.usuario_asignado);
  const equivalent = rhLinked.filter((candidate) => anchors.some((anchor) => (
    normalizeEmployeeNumber(candidate.id_empleado) === normalizeEmployeeNumber(anchor.id_empleado)
      && namesLikelyMatch(candidate.usuario_asignado, anchor.usuario_asignado)
  )));
  return [...new Map([...coreLinked, ...equivalent].map((asset) => [asset.asset_uid, asset])).values()];
}
