// No hay login propio: la sesión la emite MRTI Core (identidad). La validación
// es la pieza compartida de MRTI-Platform (vendor/mrti-platform/core-auth.js),
// con el contrato 401/403/503 de CORE_INFRA_MIGRATION_GUIDE.md §8.
import { createCoreAuth } from './vendor/mrti-platform/core-auth.js';

const auth = createCoreAuth({ service: 'mrti-activos-api', moduleCode: 'activos' });

export const moduleAccessRequired = auth.moduleAccessRequired;

// Las lecturas auxiliares conservan su contrato best-effort.
export const fetchCurrentUser = auth.fetchCurrentUser;

// Autoservicio (Fase 7): sólo requiere una sesión válida, no acceso al
// módulo Activos completo.
export const portalSessionRequired = auth.portalSessionRequired;

// Para llamadas entre módulos sin usuario navegando (ej. Tickets validando
// un asset_uid al crear un ticket automático desde un evento de Agent
// Core) — no hay sesión de Core que reenviar. Acepta la sesión normal de un
// usuario real O una llave de servicio compartida, nunca ambas condiciones
// a la vez relajadas: si viene Authorization se valida igual que siempre
// (portalSessionRequired), la llave de servicio es solo el camino
// alternativo cuando no hay usuario.
export async function portalSessionOrServiceKey(req, res, next) {
  const serviceKey = req.headers['x-service-key'];
  if (serviceKey) {
    if (!process.env.INTERNAL_SERVICE_KEY || serviceKey !== process.env.INTERNAL_SERVICE_KEY) {
      return res.status(401).json({ error: 'Llave de servicio inválida' });
    }
    req.portalUser = null;
    req.isServiceCall = true;
    return next();
  }
  return portalSessionRequired(req, res, next);
}

export const administratorOnly = auth.administratorRequiredWith('Esta acción está reservada para administradores');
