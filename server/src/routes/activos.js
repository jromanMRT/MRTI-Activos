import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { pool } from '../db.js';
import { ALL_FIELDS, FIELD_GROUPS, LIST_COLUMNS } from '../meta.js';

export const activosRouter = Router();

function pickAllowedFields(body) {
  const fields = {};
  for (const key of ALL_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(body, key)) {
      fields[key] = body[key] === '' ? null : body[key];
    }
  }
  return fields;
}

activosRouter.get('/meta', (_req, res) => {
  res.json({ groups: FIELD_GROUPS });
});

activosRouter.get('/', async (req, res, next) => {
  try {
    const { q, tipo, estado, unidad, empresa, limit } = req.query;
    const where = [];
    const params = [];

    if (q) {
      where.push('(descripcion LIKE ? OR usuario_asignado LIKE ? OR numero_serie LIKE ? OR service_tag LIKE ? OR modelo LIKE ? OR center_code LIKE ?)');
      const term = `%${q}%`;
      params.push(term, term, term, term, term, term);
    }
    if (tipo) { where.push('tipo = ?'); params.push(tipo); }
    if (estado) { where.push('estado = ?'); params.push(estado); }
    if (unidad) { where.push('unidad = ?'); params.push(unidad); }
    if (empresa) { where.push('empresa = ?'); params.push(empresa); }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const cap = Math.min(Math.max(Number(limit) || 500, 1), 1000);

    const [rows] = await pool.query(
      `SELECT ${LIST_COLUMNS.join(',')} FROM activos ${whereSql} ORDER BY actualizado_en DESC LIMIT ${cap}`,
      params
    );
    res.json({ data: rows });
  } catch (error) {
    next(error);
  }
});

activosRouter.get('/filtros', async (_req, res, next) => {
  try {
    const [tipos] = await pool.query('SELECT DISTINCT tipo FROM activos WHERE tipo IS NOT NULL ORDER BY tipo');
    const [estados] = await pool.query('SELECT DISTINCT estado FROM activos WHERE estado IS NOT NULL ORDER BY estado');
    const [unidades] = await pool.query('SELECT DISTINCT unidad FROM activos WHERE unidad IS NOT NULL ORDER BY unidad');
    const [empresas] = await pool.query('SELECT DISTINCT empresa FROM activos WHERE empresa IS NOT NULL ORDER BY empresa');
    res.json({
      tipos: tipos.map((r) => r.tipo),
      estados: estados.map((r) => r.estado),
      unidades: unidades.map((r) => r.unidad),
      empresas: empresas.map((r) => r.empresa),
    });
  } catch (error) {
    next(error);
  }
});

activosRouter.get('/assignment-options', async (_req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, asset_uid, center_code AS internal_id,
              COALESCE(descripcion, CONCAT(tipo, ' ', marca, ' ', modelo)) AS name,
              cod_activo_fijo AS inventory_tag, physical_area_id AS area_id,
              portal_user_id AS assigned_user_id,
              CASE WHEN portal_user_id IS NULL THEN 0 ELSE 1 END AS is_primary_user_device
         FROM activos
        WHERE estado <> 'Inactivo'
        ORDER BY center_code, descripcion`
    );
    res.json({ data: rows.map((row) => ({ ...row, is_primary_user_device: Boolean(row.is_primary_user_device) })) });
  } catch (error) {
    next(error);
  }
});

activosRouter.post('/primary-assignment', async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const portalUserId = String(req.body?.portal_user_id || '').trim();
    const assetInternalId = req.body?.asset_id || null;
    const assetUid = req.body?.asset_uid || null;
    if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(portalUserId)) {
      return res.status(400).json({ error: 'portal_user_id debe ser un UUID de MRTI Core' });
    }
    let asset = null;
    if (assetInternalId || assetUid) {
      [[asset]] = await connection.query(
        "SELECT id, asset_uid, physical_area_id FROM activos WHERE (id = ? OR asset_uid = ?) AND estado <> 'Inactivo'",
        [assetInternalId, assetUid]
      );
      if (!asset) return res.status(400).json({ error: 'El activo no existe o está retirado' });
      const [[conflict]] = await connection.query(
        'SELECT portal_user_id FROM activos WHERE id = ? AND portal_user_id IS NOT NULL AND portal_user_id <> ?',
        [asset.id, portalUserId]
      );
      if (conflict) return res.status(409).json({ error: 'Ese activo ya está asignado a otra persona' });
    }

    await connection.beginTransaction();
    const [currentAssets] = await connection.query(
      'SELECT asset_uid FROM activos WHERE portal_user_id = ? FOR UPDATE',
      [portalUserId]
    );
    const currentAssetUids = currentAssets.map((row) => row.asset_uid);
    if (currentAssetUids.length) {
      await connection.query(
        'UPDATE activo_asignaciones SET unassigned_at = CURRENT_TIMESTAMP WHERE asset_uid IN (?) AND unassigned_at IS NULL',
        [currentAssetUids]
      );
    }
    await connection.query(
      'UPDATE activos SET portal_user_id = NULL, usuario_asignado = NULL WHERE portal_user_id = ?',
      [portalUserId]
    );
    if (asset) {
      await connection.query(
        'UPDATE activos SET portal_user_id = ?, usuario_asignado = ? WHERE id = ?',
        [portalUserId, req.body?.user_name || null, asset.id]
      );
      await connection.query(
        `INSERT INTO activo_asignaciones (id, asset_uid, portal_user_id, notes)
         VALUES (?, ?, ?, ?)`,
        [randomUUID(), asset.asset_uid, portalUserId, 'Equipo habitual asignado desde MRTI Core']
      );
    }
    await connection.commit();
    res.json({ ok: true, area_id: asset?.physical_area_id || null });
  } catch (error) {
    await connection.rollback().catch(() => {});
    next(error);
  } finally {
    connection.release();
  }
});

activosRouter.get('/uid/:assetUid', async (req, res, next) => {
  try {
    const [[row]] = await pool.query('SELECT * FROM activos WHERE asset_uid = ?', [req.params.assetUid]);
    if (!row) return res.status(404).json({ error: 'Activo no encontrado' });
    res.json({ data: row });
  } catch (error) {
    next(error);
  }
});

activosRouter.get('/:id/asignaciones', async (req, res, next) => {
  try {
    const [[asset]] = await pool.query('SELECT asset_uid FROM activos WHERE id = ?', [req.params.id]);
    if (!asset) return res.status(404).json({ error: 'Activo no encontrado' });
    const [rows] = await pool.query(
      'SELECT * FROM activo_asignaciones WHERE asset_uid = ? ORDER BY assigned_at DESC',
      [asset.asset_uid]
    );
    res.json({ data: rows });
  } catch (error) {
    next(error);
  }
});

activosRouter.post('/:id/asignaciones', async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const portalUserId = String(req.body?.portal_user_id || '').trim();
    if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(portalUserId)) {
      return res.status(400).json({ error: 'portal_user_id debe ser un UUID de MRTI Core' });
    }
    const [[asset]] = await connection.query('SELECT asset_uid FROM activos WHERE id = ?', [req.params.id]);
    if (!asset) return res.status(404).json({ error: 'Activo no encontrado' });
    await connection.beginTransaction();
    await connection.query(
      'UPDATE activo_asignaciones SET unassigned_at = CURRENT_TIMESTAMP WHERE asset_uid = ? AND unassigned_at IS NULL',
      [asset.asset_uid]
    );
    const assignmentId = randomUUID();
    await connection.query(
      `INSERT INTO activo_asignaciones (id, asset_uid, portal_user_id, notes)
       VALUES (?, ?, ?, ?)`,
      [assignmentId, asset.asset_uid, portalUserId, req.body?.notes || null]
    );
    await connection.query('UPDATE activos SET portal_user_id = ? WHERE id = ?', [portalUserId, req.params.id]);
    await connection.commit();
    res.status(201).json({ data: { id: assignmentId, asset_uid: asset.asset_uid, portal_user_id: portalUserId } });
  } catch (error) {
    await connection.rollback().catch(() => {});
    next(error);
  } finally {
    connection.release();
  }
});

activosRouter.delete('/:id/asignacion', async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const [[asset]] = await connection.query('SELECT asset_uid FROM activos WHERE id = ?', [req.params.id]);
    if (!asset) return res.status(404).json({ error: 'Activo no encontrado' });
    await connection.beginTransaction();
    await connection.query(
      'UPDATE activo_asignaciones SET unassigned_at = CURRENT_TIMESTAMP WHERE asset_uid = ? AND unassigned_at IS NULL',
      [asset.asset_uid]
    );
    await connection.query('UPDATE activos SET portal_user_id = NULL, usuario_asignado = NULL WHERE id = ?', [req.params.id]);
    await connection.commit();
    res.status(204).end();
  } catch (error) {
    await connection.rollback().catch(() => {});
    next(error);
  } finally {
    connection.release();
  }
});

activosRouter.get('/:id/mantenimientos', async (req, res, next) => {
  try {
    const [[asset]] = await pool.query('SELECT asset_uid FROM activos WHERE id = ?', [req.params.id]);
    if (!asset) return res.status(404).json({ error: 'Activo no encontrado' });
    const [rows] = await pool.query(
      'SELECT * FROM activo_mantenimientos WHERE asset_uid = ? ORDER BY fecha_inicio DESC, created_at DESC',
      [asset.asset_uid]
    );
    res.json({ data: rows });
  } catch (error) {
    next(error);
  }
});

activosRouter.post('/:id/mantenimientos', async (req, res, next) => {
  try {
    const [[asset]] = await pool.query('SELECT asset_uid FROM activos WHERE id = ?', [req.params.id]);
    if (!asset) return res.status(404).json({ error: 'Activo no encontrado' });
    const tipo = String(req.body?.tipo || '').trim();
    if (!tipo) return res.status(400).json({ error: 'tipo es obligatorio' });
    const maintenanceId = randomUUID();
    await pool.query(
      `INSERT INTO activo_mantenimientos
         (id, asset_uid, tipo, estado, fecha_inicio, fecha_fin, proveedor, costo, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [maintenanceId, asset.asset_uid, tipo, req.body?.estado || 'Programado',
        req.body?.fecha_inicio || null, req.body?.fecha_fin || null,
        req.body?.proveedor || null, req.body?.costo || null, req.body?.notes || null]
    );
    const [[row]] = await pool.query('SELECT * FROM activo_mantenimientos WHERE id = ?', [maintenanceId]);
    res.status(201).json({ data: row });
  } catch (error) {
    next(error);
  }
});

activosRouter.get('/:id', async (req, res, next) => {
  try {
    const [[row]] = await pool.query('SELECT * FROM activos WHERE id = ?', [req.params.id]);
    if (!row) return res.status(404).json({ error: 'Activo no encontrado' });
    res.json({ data: row });
  } catch (error) {
    next(error);
  }
});

activosRouter.post('/', async (req, res, next) => {
  try {
    const fields = pickAllowedFields(req.body || {});
    if (!fields.center_code) {
      return res.status(400).json({ error: 'center_code es obligatorio' });
    }
    const columns = Object.keys(fields);
    const [result] = await pool.query(
      `INSERT INTO activos (asset_uid, ${columns.join(',')}) VALUES (?, ${columns.map(() => '?').join(',')})`,
      [randomUUID(), ...columns.map((c) => fields[c])]
    );
    const [[row]] = await pool.query('SELECT * FROM activos WHERE id = ?', [result.insertId]);
    res.status(201).json({ data: row });
  } catch (error) {
    next(error);
  }
});

activosRouter.patch('/:id', async (req, res, next) => {
  try {
    const fields = pickAllowedFields(req.body || {});
    const columns = Object.keys(fields);
    if (!columns.length) return res.status(400).json({ error: 'Nada que actualizar' });
    const [result] = await pool.query(
      `UPDATE activos SET ${columns.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`,
      [...columns.map((c) => fields[c]), req.params.id]
    );
    if (!result.affectedRows) return res.status(404).json({ error: 'Activo no encontrado' });
    const [[row]] = await pool.query('SELECT * FROM activos WHERE id = ?', [req.params.id]);
    res.json({ data: row });
  } catch (error) {
    next(error);
  }
});

activosRouter.delete('/:id', async (req, res, next) => {
  try {
    // Retiro lógico: conserva asignaciones, mantenimientos y referencias que
    // MRTI-Obs guarde mediante asset_uid.
    const [result] = await pool.query(
      "UPDATE activos SET estado = 'Inactivo', active = 'NO', portal_user_id = NULL, usuario_asignado = NULL WHERE id = ?",
      [req.params.id]
    );
    if (!result.affectedRows) return res.status(404).json({ error: 'Activo no encontrado' });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});
