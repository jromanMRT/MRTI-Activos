// Activos owns these references; no cross-database writes or reassignment.
import 'dotenv/config';
import assert from 'node:assert/strict';
import { pool } from '../src/db.js';
import { randomUUID } from 'node:crypto';
const mode = process.argv[2] || '--preview';
assert(['--install','--preview','--apply','--rehearse','--rollback','--rehearse-rollback'].includes(mode));
const operation = 'rh-merge-2017-2039-20261005';
const db = await pool.getConnection();
const query = (sql,values=[])=>db.query({sql,dateStrings:true},values);
const decode = v=>typeof v==='string'?JSON.parse(v):v;
try {
  if (mode==='--install') {
    await query(`CREATE TABLE IF NOT EXISTS rh_reference_repairs (
      operation_key VARCHAR(100) PRIMARY KEY, snapshot_json JSON NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
    console.log('Repair ledger installed (idempotent)');
  } else {
    await db.beginTransaction();
    const [[saved]]=await query('SELECT * FROM rh_reference_repairs WHERE operation_key=? FOR UPDATE',[operation]);
    if (saved && !mode.includes('rollback')) {
      console.log('Already migrated');
    } else if (!saved && mode.includes('rollback')) {
      console.log('Already restored');
    } else {
      const [assets]=await query('SELECT id,asset_uid,center_code,rh_employee_id,portal_user_id FROM activos WHERE id=110 FOR UPDATE');
      const [assignments]=await query('SELECT id,asset_uid,rh_employee_id,portal_user_id,assigned_at,unassigned_at FROM activo_asignaciones WHERE id=? FOR UPDATE',['b6b7db9b-6ee0-4172-a458-4e98ab073fd7']);
      const [[extra]]=await query(`SELECT
        (SELECT COUNT(*) FROM activos WHERE rh_employee_id IN (2017,2056) AND id<>110)+
        (SELECT COUNT(*) FROM activo_asignaciones WHERE rh_employee_id IN (2017,2056) AND id<>'b6b7db9b-6ee0-4172-a458-4e98ab073fd7')+
        (SELECT COUNT(*) FROM employee_offboarding_cases WHERE reference_type='rh_employee' AND reference_value IN ('2017','2056')) AS n`);
      assert.equal(extra.n,0,'Unexpected references');
      assert.equal(assets.length,1); assert.equal(assignments.length,1);
      assert.equal(assets[0].center_code,'TI-00110');
      assert.equal(assets[0].asset_uid,assignments[0].asset_uid);
      assert.equal(assignments[0].unassigned_at,null);
      const rollback=mode.includes('rollback');
      const from=rollback?2039:2017, to=rollback?2017:2039;
      assert.equal(assets[0].rh_employee_id,from); assert.equal(assignments[0].rh_employee_id,from);
      assert.equal(assets[0].portal_user_id,null); assert.equal(assignments[0].portal_user_id,null);
      if (rollback) {
        const original=decode(saved.snapshot_json);
        assert.deepEqual(assets,original.assets.map(r=>({...r,rh_employee_id:2039})));
        assert.deepEqual(assignments,original.assignments.map(r=>({...r,rh_employee_id:2039})));
      }
      console.log(JSON.stringify({asset:'TI-00110',from,to,assignments:assignments.length}));
      if (mode!=='--preview') {
        if (!rollback) await query('INSERT INTO rh_reference_repairs VALUES (?,?,CURRENT_TIMESTAMP)',[operation,JSON.stringify({assets,assignments})]);
        await query('UPDATE activos SET rh_employee_id=? WHERE id=110',[to]);
        await query('UPDATE activo_asignaciones SET rh_employee_id=? WHERE id=?',[to,assignments[0].id]);
        await query(`INSERT INTO audit_events (event_uuid,module_code,actor_name,action,entity_type,entity_id,request_id,metadata_json,status_code)
          VALUES (?,'activos','Migración autorizada en conversación',?,'activos','110',?,?,200)`,
        [randomUUID(),rollback?'asset.rh_reference_merge_reverted':'asset.rh_reference_merged',randomUUID(),JSON.stringify({operation,from,to,assignment_id:assignments[0].id})]);
        if (rollback) await query('DELETE FROM rh_reference_repairs WHERE operation_key=?',[operation]);
      }
    }
    if (mode==='--apply'||mode==='--rollback') {await db.commit();console.log('Committed');}
    else {await db.rollback();console.log('Rolled back (preview/rehearsal)');}
  }
} catch(error) {await db.rollback(); console.error(error.code||error.message);process.exitCode=1;}
finally {db.release();await pool.end();}
