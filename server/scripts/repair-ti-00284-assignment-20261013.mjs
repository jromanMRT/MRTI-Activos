// Reparación autorizada: une tres movimientos creados por bajas implícitas de
// Core en una única asignación continua. Conserva snapshot, auditoría y filas
// redundantes archivadas; --rollback restaura exactamente el estado previo.
import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { pool } from '../src/db.js';

const mode = process.argv[2] || '--preview';
assert(['--install', '--preview', '--apply', '--rehearse', '--rollback', '--rehearse-rollback'].includes(mode));
const operation = 'repair-ti-00284-assignment-20261013';
const assetId = 2027;
const assignmentIds = [
  'ce985bbc-f10b-4b97-a1fe-8fb47cad976a',
  'ec24f03e-24e1-42a5-bbbc-0123705de331',
  'd8ffe9e2-84da-42c1-ba59-c85ef313f398',
];
const db = await pool.getConnection();
const query = (sql, values = []) => db.query({ sql, dateStrings: true }, values);
const decode = (value) => typeof value === 'string' ? JSON.parse(value) : value;

try {
  if (mode === '--install') {
    await query(`CREATE TABLE IF NOT EXISTS assignment_repair_ledger (
      operation_key VARCHAR(100) PRIMARY KEY,
      snapshot_json JSON NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
    console.log('Repair ledger installed (idempotent)');
  } else {
    await db.beginTransaction();
    const [[saved]] = await query('SELECT * FROM assignment_repair_ledger WHERE operation_key=? FOR UPDATE', [operation]);
    const rollback = mode.includes('rollback');
    if (saved && !rollback) {
      console.log('Already repaired');
    } else if (!saved && rollback) {
      console.log('Already restored');
    } else {
      const [[asset]] = await query('SELECT id,asset_uid,center_code,portal_user_id,usuario_asignado FROM activos WHERE id=? FOR UPDATE', [assetId]);
      assert.ok(asset, 'Asset TI-00284 not found');
      assert.equal(asset.center_code, 'TI-00284');
      const [rows] = await query(`SELECT id,asset_uid,portal_user_id,rh_employee_id,tercero_id,assigned_at,unassigned_at,archived_at,archived_by,archive_reason,notes
        FROM activo_asignaciones WHERE id IN (?) ORDER BY assigned_at FOR UPDATE`, [assignmentIds]);
      assert.equal(rows.length, 3, 'Unexpected assignment history');
      assert.ok(rows.every((row) => row.asset_uid === asset.asset_uid));
      assert.ok(rows.every((row) => row.portal_user_id === asset.portal_user_id));
      assert.equal(rows[0].assigned_at, '2026-10-05 12:02:29');
      assert.equal(rows[0].unassigned_at, '2026-10-06 08:09:35');
      assert.equal(rows[1].unassigned_at, '2026-10-13 11:38:38');
      assert.equal(rows[2].unassigned_at, null);
      if (rollback) {
        const original = decode(saved.snapshot_json);
        assert.equal(rows[0].unassigned_at, null, 'Repair no longer has its expected open movement');
        for (const row of original.assignments) {
          await query('UPDATE activo_asignaciones SET unassigned_at=?,archived_at=?,archived_by=?,archive_reason=?,notes=? WHERE id=?',
            [row.unassigned_at, row.archived_at, row.archived_by, row.archive_reason, row.notes, row.id]);
        }
        await query('DELETE FROM assignment_repair_ledger WHERE operation_key=?', [operation]);
      } else {
        const snapshot = { asset, assignments: rows };
        await query('INSERT INTO assignment_repair_ledger (operation_key,snapshot_json) VALUES (?,?)', [operation, JSON.stringify(snapshot)]);
        await query('UPDATE activo_asignaciones SET unassigned_at=NULL,notes=CONCAT_WS(\'\\n\',NULLIF(notes,\'\'),?) WHERE id=?',
          ['Reparación autorizada: asignación continua restituida; cierre automático de Core no correspondía a devolución física.', rows[0].id]);
        await query(`UPDATE activo_asignaciones SET archived_at=CURRENT_TIMESTAMP,archived_by=?,archive_reason=?
          WHERE id IN (?,?)`, [
          'c2cdaa65-ba97-4437-a209-a9f94bdf3bef',
          'Movimientos redundantes creados por bajas implícitas de Core; se conserva evidencia en auditoría y ledger de reparación.',
          rows[1].id, rows[2].id,
        ]);
      }
      await query(`INSERT INTO audit_events
        (event_uuid,module_code,actor_user_id,actor_name,actor_email,action,entity_type,entity_id,request_id,metadata_json,status_code)
        VALUES (?,'activos','c2cdaa65-ba97-4437-a209-a9f94bdf3bef','Jorge Roman','jroman@mrtcorporativo.mx',?,'activo',?, ?, ?,200)`, [
        randomUUID(), rollback ? 'asset.assignment_repair_reverted' : 'asset.assignment_repaired', String(assetId), randomUUID(),
        JSON.stringify({ operation, assignment_ids: assignmentIds, rollback }),
      ]);
      console.log(JSON.stringify({ asset: asset.center_code, rollback, assignments: rows.map((row) => row.id) }));
    }
    if (mode === '--apply' || mode === '--rollback') { await db.commit(); console.log('Committed'); }
    else { await db.rollback(); console.log('Rolled back (preview/rehearsal)'); }
  }
} catch (error) {
  await db.rollback().catch(() => {});
  console.error(error.stack || error.message);
  process.exitCode = 1;
} finally {
  db.release();
  await pool.end();
}
