// Read-only integration check against the configured inventory; no fixtures.
import 'dotenv/config';
import assert from 'node:assert/strict';
import { pool } from '../src/db.js';
import { readUnitInventory, unitInventoryFilter } from '../src/unitInventory.js';

try {
  const rows = await readUnitInventory(pool);
  const [[inventory]] = await pool.query('SELECT COUNT(*) AS total FROM activos');
  assert.equal(rows.reduce((sum, row) => sum + row.total, 0), inventory.total);
  for (const row of rows) {
    const filter = unitInventoryFilter(row.nombre === null ? { sin_unidad: '1' } : { unidad_operativa: row.nombre });
    const [[actual]] = await pool.query(`SELECT COUNT(*) AS total,
      SUM(estado = 'Activo') AS activos, SUM(estado = 'En mantenimiento') AS mantenimiento,
      SUM(estado = 'Baja') AS bajas,
      SUM(portal_user_id IS NOT NULL OR rh_employee_id IS NOT NULL OR tercero_id IS NOT NULL) AS asignados
      FROM activos WHERE ${filter.sql}`, filter.values);
    for (const key of ['total', 'activos', 'mantenimiento', 'bajas', 'asignados']) {
      assert.equal(row[key], Number(actual[key] || 0), `${row.nombre}: ${key}`);
    }
  }
  console.log(JSON.stringify({ ok: true, groups: rows.length, assets: inventory.total, persistentWrites: 0 }));
} finally { await pool.end(); }
