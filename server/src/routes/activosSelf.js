import { Router } from 'express';
import { pool } from '../db.js';
import { portalSessionRequired, portalSessionOrServiceKey } from '../auth.js';
import { normalizeAssetDates } from '../meta.js';

export const activosSelfRouter = Router();

// Resumen no sensible para lectura cruzada entre módulos (ej. la tarjeta de
// "activo relacionado" en un ticket) -- nunca credenciales/win_*/ms_*/
// correo_*. Acepta sesión real de Core (uso interactivo) o llave de
// servicio (uso automático, ej. Tickets validando un asset_uid al crear un
// ticket sin que haya un usuario navegando).
const CROSS_MODULE_COLUMNS = `id, asset_uid, center_code, descripcion, tipo, marca, modelo,
  service_tag, numero_serie, estado, unidad, empresa, usuario_asignado, physical_area_id`;

activosSelfRouter.get('/uid/:assetUid', portalSessionOrServiceKey, async (req, res, next) => {
  try {
    const [[row]] = await pool.query(`SELECT ${CROSS_MODULE_COLUMNS} FROM activos WHERE asset_uid = ?`, [req.params.assetUid]);
    if (!row) return res.status(404).json({ error: 'Activo no encontrado' });
    res.json({ data: row });
  } catch (error) {
    next(error);
  }
});

const SELF_COLUMNS = `id, asset_uid, center_code, cod_activo_fijo, tipo, descripcion,
  marca, modelo, service_tag, numero_serie, estado, physical_area_id,
  fecha_compra, garantia_hasta, bitlocker, notas`;

// Un empleado puede tener varios activos (1:N) — a diferencia de RH, no hay
// "ficha única"; por eso no vinculado no es un 404, es simplemente una
// lista vacía.
async function resolveAssignments(user) {
  const [linked] = await pool.query(
    `SELECT ${SELF_COLUMNS} FROM activos WHERE portal_user_id = ? ORDER BY id`,
    [user.id]
  );
  if (linked.length || !user.email) return linked;

  const [result] = await pool.query(
    `UPDATE activos SET portal_user_id = ?
      WHERE LOWER(correo_corporativo) = LOWER(?) AND portal_user_id IS NULL`,
    [user.id, user.email]
  );
  if (!result.affectedRows) return linked;

  const [rows] = await pool.query(
    `SELECT ${SELF_COLUMNS} FROM activos WHERE portal_user_id = ? ORDER BY id`,
    [user.id]
  );
  return rows;
}

activosSelfRouter.get('/me', portalSessionRequired, async (req, res, next) => {
  try {
    const data = await resolveAssignments(req.portalUser);
    res.json({ data: data.map(normalizeAssetDates) });
  } catch (error) {
    next(error);
  }
});
