import { Router } from 'express';
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
      `INSERT INTO activos (${columns.join(',')}) VALUES (${columns.map(() => '?').join(',')})`,
      columns.map((c) => fields[c])
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
    const [result] = await pool.query('DELETE FROM activos WHERE id = ?', [req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ error: 'Activo no encontrado' });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});
