const MRTI_OBS_URL = process.env.MRTI_OBS_URL || process.env.MRTI_INFRA_URL || 'http://127.0.0.1:3002';
const TIMEOUT_MS = 3000;

// Autoservicio de MRTI-Obs (topología física): sitios/edificios/pisos/áreas
// son propiedad de ese módulo (CORE_INFRA_MIGRATION_GUIDE.md §3). Activos
// sólo valida en vivo una referencia elegida por un administrador al
// clasificar una unidad -- nunca copia ni cachea la tabla. Mismo patrón que
// MRTI-RH/server/src/integrations/infraClient.js. Degrada a []/null si Obs
// no responde: no debe tumbar el resto del módulo.
export async function listPhysicalAreas(authorization) {
  try {
    const response = await fetch(`${MRTI_OBS_URL}/api/self/physical-areas`, {
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

export async function getPhysicalArea(areaId, authorization) {
  if (!areaId) return null;
  try {
    const response = await fetch(`${MRTI_OBS_URL}/api/self/physical-areas/${encodeURIComponent(areaId)}`, {
      headers: authorization ? { Authorization: authorization } : {},
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) return null;
    const body = await response.json();
    return body.data || null;
  } catch {
    return null;
  }
}
