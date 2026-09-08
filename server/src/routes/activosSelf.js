import { Router } from 'express';
import { pool } from '../db.js';
import { portalSessionRequired, portalSessionOrServiceKey } from '../auth.js';
import { normalizeAssetDates } from '../meta.js';
import { mergeEquivalentSelfAssignments } from '../domain/selfAssignments.js';

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

const SELF_ASSIGNMENT_COLUMNS = `${SELF_COLUMNS}, id_empleado, usuario_asignado`;

// Un empleado puede tener varios activos (1:N). Durante la compatibilidad,
// unos pueden conservar el UUID de Core y otros el id de su ficha RH; ambos
// se resuelven sin reescribir ni borrar la referencia propietaria.
async function resolveAssignments(user) {
  let [linked] = await pool.query(
    `SELECT ${SELF_ASSIGNMENT_COLUMNS} FROM activos WHERE portal_user_id = ? ORDER BY id`,
    [user.id]
  );
  if (!linked.length && user.email) {
    const [result] = await pool.query(
      `UPDATE activos SET portal_user_id = ?
        WHERE LOWER(correo_corporativo) = LOWER(?) AND portal_user_id IS NULL AND rh_employee_id IS NULL`,
      [user.id, user.email]
    );
    if (result.affectedRows) {
      [linked] = await pool.query(`SELECT ${SELF_ASSIGNMENT_COLUMNS} FROM activos WHERE portal_user_id = ? ORDER BY id`, [user.id]);
    }
  }
  if (!linked.length) return [];
  const [rhLinked] = await pool.query(`SELECT ${SELF_ASSIGNMENT_COLUMNS} FROM activos WHERE rh_employee_id IS NOT NULL ORDER BY id`);
  return mergeEquivalentSelfAssignments(linked, rhLinked);
}

activosSelfRouter.get('/me', portalSessionRequired, async (req, res, next) => {
  try {
    const data = await resolveAssignments(req.portalUser);
    res.json({ data: data.map(({ id_empleado: _employeeNumber, usuario_asignado: _holderName, ...asset }) => normalizeAssetDates(asset)) });
  } catch (error) {
    next(error);
  }
});
