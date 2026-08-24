import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { pool } from '../db.js';

export const tercerosRouter = Router();

// Personas que pueden tener un activo a su nombre sin ser empleado ni
// usuario de la plataforma (contratista, proveedor, visita). No dependen
// de MRTI Core -- se registran y administran enteramente aqui.

tercerosRouter.get('/terceros', async (req, res, next) => {
  try {
    const where = [];
    const params = [];
    if (!req.query.estado || req.query.estado !== 'todos') {
      where.push('estado <> ?');
      params.push('Inactivo');
    }
    if (req.query.q) {
      where.push('(nombre LIKE ? OR organizacion LIKE ? OR correo LIKE ?)');
      const term = `%${String(req.query.q).trim()}%`;
      params.push(term, term, term);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const [rows] = await pool.query(`SELECT * FROM terceros ${whereSql} ORDER BY nombre`, params);
    res.json({ data: rows });
  } catch (error) {
    next(error);
  }
});

tercerosRouter.get('/terceros/:id', async (req, res, next) => {
  try {
    const [[row]] = await pool.query('SELECT * FROM terceros WHERE id = ?', [req.params.id]);
    if (!row) return res.status(404).json({ error: 'Tercero no encontrado' });

    const [assets] = await pool.query(
      `SELECT a.id, a.center_code, a.descripcion, a.tipo
         FROM activos a WHERE a.tercero_id = ? AND a.estado <> 'Inactivo'`,
      [req.params.id]
    );
    res.json({ data: { ...row, activos_asignados: assets } });
  } catch (error) {
    next(error);
  }
});

tercerosRouter.post('/terceros', async (req, res, next) => {
  try {
    const nombre = String(req.body?.nombre || '').trim();
    if (!nombre) return res.status(400).json({ error: 'nombre es obligatorio' });
    const id = randomUUID();
    await pool.query(
      `INSERT INTO terceros (id, nombre, organizacion, motivo, telefono, correo, notas)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        nombre,
        req.body?.organizacion || null,
        req.body?.motivo || null,
        req.body?.telefono || null,
        req.body?.correo || null,
        req.body?.notas || null,
      ]
    );
    const [[row]] = await pool.query('SELECT * FROM terceros WHERE id = ?', [id]);
    res.status(201).json({ data: row });
  } catch (error) {
    next(error);
  }
});

tercerosRouter.patch('/terceros/:id', async (req, res, next) => {
  try {
    const fields = {};
    for (const key of ['nombre', 'organizacion', 'motivo', 'telefono', 'correo', 'notas', 'estado']) {
      if (Object.prototype.hasOwnProperty.call(req.body || {}, key)) {
        fields[key] = req.body[key] === '' ? null : req.body[key];
      }
    }
    if (Object.prototype.hasOwnProperty.call(fields, 'nombre') && !fields.nombre) {
      return res.status(400).json({ error: 'nombre no puede quedar vacío' });
    }
    const columns = Object.keys(fields);
    if (!columns.length) return res.status(400).json({ error: 'Nada que actualizar' });
    const [result] = await pool.query(
      `UPDATE terceros SET ${columns.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`,
      [...columns.map((c) => fields[c]), req.params.id]
    );
    if (!result.affectedRows) return res.status(404).json({ error: 'Tercero no encontrado' });
    const [[row]] = await pool.query('SELECT * FROM terceros WHERE id = ?', [req.params.id]);
    res.json({ data: row });
  } catch (error) {
    next(error);
  }
});
