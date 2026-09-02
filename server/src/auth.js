// No hay login propio: la sesión la emite MRTI Core (identidad). MRTI_INFRA_URL
// se conserva como fallback temporal mientras se completa la Fase 4 de
// CORE_INFRA_MIGRATION_GUIDE.md en el resto de módulos.
const MRTI_CORE_URL = process.env.MRTI_CORE_URL;
const MRTI_INFRA_URL = process.env.MRTI_INFRA_URL || 'http://127.0.0.1:3002';
const AUTH_BASE_URL = MRTI_CORE_URL || MRTI_INFRA_URL;
if (!MRTI_CORE_URL) {
  console.warn('[mrti-activos] MRTI_CORE_URL no está definida; validando sesiones contra MRTI_INFRA_URL (ruta obsoleta).');
}

// Este middleware valida el JWT del usuario reenviando el header Authorization
// al endpoint de permisos por módulo de MRTI Core (mismo patrón que usa MRTI Core
// para proteger sus propias rutas de operador vía requirePortalAccess).
export async function moduleAccessRequired(req, res, next) {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(401).json({ error: 'No autenticado' });
  }
  try {
    const response = await fetch(`${AUTH_BASE_URL}/api/auth/module-access/activos`, {
      headers: { Authorization: authorization },
      signal: AbortSignal.timeout(5000),
    });
    if (response.status === 204) return next();
    if (response.status === 401) {
      return res.status(401).json({ error: 'No autenticado o sesión expirada' });
    }
    if (response.status === 403) {
      return res.status(403).json({ error: 'Tu área no tiene acceso a este módulo' });
    }
    return res.status(503).json({ error: 'No se pudo validar la sesión con MRTI' });
  } catch {
    return res.status(503).json({ error: 'No se pudo contactar a MRTI Core/Infra' });
  }
}

// Autoservicio (Fase 7): sólo requiere una sesión válida, no acceso al
// módulo Activos completo — mismo patrón que MRTI-RH/server/src/auth.js.
export async function fetchCurrentUser(authorization) {
  try {
    const response = await fetch(`${AUTH_BASE_URL}/api/auth/me`, {
      headers: { Authorization: authorization },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return null;
    const body = await response.json();
    return body.profile ? { id: body.profile.id, name: body.profile.full_name, email: body.profile.email, role: body.profile.role } : null;
  } catch {
    return null;
  }
}

export async function portalSessionRequired(req, res, next) {
  const authorization = req.headers.authorization;
  if (!authorization) return res.status(401).json({ error: 'No autenticado' });
  const user = await fetchCurrentUser(authorization);
  if (!user) return res.status(401).json({ error: 'Sesión inválida o expirada' });
  req.portalUser = user;
  return next();
}

export async function administratorOnly(req, res, next) {
  const actor = req.portalUser || await fetchCurrentUser(req.headers.authorization);
  if (!actor) return res.status(401).json({ error: 'No autenticado' });
  if (String(actor.role || '').toLowerCase() !== 'administrator') {
    return res.status(403).json({ error: 'Esta acción está reservada para administradores' });
  }
  req.portalUser = actor;
  return next();
}
