const MRTI_RH_URL = process.env.MRTI_RH_URL || 'http://127.0.0.1:3004';
const TIMEOUT_MS = 3000;

// Organización laboral: propiedad de RH (CORE_INFRA_MIGRATION_GUIDE.md §3).
// Activos sólo valida en vivo una referencia elegida por un administrador al
// clasificar una unidad -- nunca copia la tabla. Degrada a []/null si RH no
// responde: no debe tumbar el resto del módulo.
//
// Límite conocido: /api/rh/org-units exige que la sesión reenviada tenga
// acceso al módulo RH (moduleAccessRequiredFor('rh') en MRTI-RH), no sólo a
// Activos. Un administrador sin acceso a RH recibirá 403 al intentar
// clasificar una unidad como "organizational" -- ver UNIT_REVIEW_PLAN.md.
export async function listOrgUnits(authorization, { status = 'activo' } = {}) {
  try {
    const response = await fetch(`${MRTI_RH_URL}/api/rh/org-units?status=${encodeURIComponent(status)}`, {
      headers: authorization ? { Authorization: authorization } : {},
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) return [];
    const body = await response.json();
    return body.data || [];
  } catch {
    return [];
  }
}

export async function getOrgUnit(unitId, authorization) {
  if (!unitId) return null;
  try {
    const response = await fetch(`${MRTI_RH_URL}/api/rh/org-units/${encodeURIComponent(unitId)}`, {
      headers: authorization ? { Authorization: authorization } : {},
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) return null;
    const body = await response.json();
    return body.data && body.data.status === 'activo' ? body.data : null;
  } catch {
    return null;
  }
}

export async function getAssetAssignmentProfile(authorization, { employeeId, portalUserId }) {
  const params = new URLSearchParams(employeeId
    ? { employee_id: String(employeeId) }
    : { portal_user_id: String(portalUserId) });
  let response;
  try {
    response = await fetch(`${MRTI_RH_URL}/api/rh-self/asset-assignment-profile?${params}`, {
      headers: authorization ? { Authorization: authorization } : {},
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    const error = new Error('No se pudo consultar la ficha laboral en RH');
    error.status = 503;
    throw error;
  }
  if (response.status === 404) {
    const error = new Error('El empleado no existe en RH');
    error.status = 400;
    throw error;
  }
  if (!response.ok) {
    const error = new Error('RH no pudo validar la empresa del empleado');
    error.status = response.status === 401 || response.status === 403 ? response.status : 503;
    throw error;
  }
  const body = await response.json();
  if (!body?.data?.full_name) {
    const error = new Error('RH devolvió una ficha laboral incompleta');
    error.status = 503;
    throw error;
  }
  return body.data;
}
