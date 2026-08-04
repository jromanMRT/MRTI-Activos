const MRTI_INFRA_URL = process.env.MRTI_INFRA_URL || 'http://127.0.0.1:3002';

// No hay login propio: la sesión la emite MRTI-Infra. Este middleware valida
// el JWT del usuario reenviando el header Authorization al endpoint de
// permisos por módulo de MRTI-Infra (mismo patrón que usa MRTI Core para
// proteger sus rutas de operador vía requirePortalAccess).
export async function moduleAccessRequired(req, res, next) {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(401).json({ error: 'No autenticado' });
  }
  try {
    const response = await fetch(`${MRTI_INFRA_URL}/api/auth/module-access/activos`, {
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
    return res.status(503).json({ error: 'MRTI Infra no disponible' });
  }
}
