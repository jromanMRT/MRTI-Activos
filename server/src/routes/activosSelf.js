import { Router } from 'express';
import { pool } from '../db.js';

export const activosSelfRouter = Router();

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

activosSelfRouter.get('/me', async (req, res, next) => {
  try {
    const data = await resolveAssignments(req.portalUser);
    res.json({ data });
  } catch (error) {
    next(error);
  }
});
