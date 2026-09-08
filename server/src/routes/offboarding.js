import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { pool } from '../db.js';
import { fetchCurrentUser } from '../auth.js';
import { destinationAssetState, normalizeOffboardingChecklist, normalizeOffboardingItem, parseAccessories, parseTasks } from '../domain/offboarding.js';
import { syncToSapBestEffort } from './activos.js';

export const offboardingRouter = Router();

const OFFBOARDING_SELECT = `SELECT oi.id AS offboarding_id, oi.status AS return_status,
    DATE_FORMAT(oi.due_date,'%Y-%m-%d') AS due_date,
    DATE_FORMAT(oi.returned_at,'%Y-%m-%dT%H:%i:%s') AS returned_at,
    oi.condition_state, oi.destination, oi.accessories_json, oi.notes AS return_notes,
    oi.received_by_user_id, oi.received_by_name, oi.updated_at AS return_updated_at,
    aa.id AS assignment_id, aa.portal_user_id, aa.rh_employee_id, aa.assigned_at, aa.unassigned_at,
    a.id AS asset_id, a.asset_uid, a.center_code, a.tipo, a.descripcion, a.marca, a.modelo,
    a.service_tag, a.numero_serie, a.estado AS asset_status, a.usuario_asignado
  FROM activo_asignaciones aa
  JOIN activos a ON a.asset_uid=aa.asset_uid
  LEFT JOIN asset_offboarding_items oi ON oi.assignment_id=aa.id`;

function normalizeRow(row) {
  return { ...row, accessories: parseAccessories(row.accessories_json), accessories_json: undefined };
}

function normalizeCase(row) { return { ...row, tasks: parseTasks(row.tasks_json), tasks_json: undefined }; }
function referenceOf(assignment) {
  return assignment.rh_employee_id
    ? { type: 'rh_employee', value: String(assignment.rh_employee_id) }
    : { type: 'core_user', value: assignment.portal_user_id };
}

offboardingRouter.get('/offboarding', async (_req, res, next) => {
  try {
    const [open] = await pool.query(`${OFFBOARDING_SELECT}
      WHERE aa.unassigned_at IS NULL AND aa.tercero_id IS NULL
      ORDER BY COALESCE(oi.status,'pending')='not_returned' DESC, oi.due_date, aa.assigned_at`);
    const [history] = await pool.query(`${OFFBOARDING_SELECT}
      WHERE oi.status='returned' ORDER BY oi.returned_at DESC LIMIT 250`);
    const [cases] = await pool.query(`SELECT id,reference_type,reference_value,employee_name,status,tasks_json,notes,
        DATE_FORMAT(completed_at,'%Y-%m-%dT%H:%i:%s') completed_at,completed_by_name,updated_at
      FROM employee_offboarding_cases ORDER BY status='open' DESC,updated_at DESC LIMIT 500`);
    res.json({ data: { open: open.map(normalizeRow), history: history.map(normalizeRow), cases: cases.map(normalizeCase) } });
  } catch (error) { next(error); }
});

offboardingRouter.put('/offboarding/:assignmentId', async (req, res, next) => {
  let connection;
  try {
    const item = normalizeOffboardingItem(req.body);
    const actor = await fetchCurrentUser(req.headers.authorization);
    if (!actor) return res.status(401).json({ error: 'No autenticado' });
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [[assignment]] = await connection.query(`SELECT aa.id, aa.asset_uid, aa.unassigned_at,aa.portal_user_id,aa.rh_employee_id,
        a.id AS asset_id, a.usuario_asignado
      FROM activo_asignaciones aa JOIN activos a ON a.asset_uid=aa.asset_uid
      WHERE aa.id=? FOR UPDATE`, [req.params.assignmentId]);
    if (!assignment) { await connection.rollback(); return res.status(404).json({ error: 'Asignación no encontrada' }); }
    const [[existing]] = await connection.query('SELECT id,status FROM asset_offboarding_items WHERE assignment_id=? FOR UPDATE', [assignment.id]);
    if (existing?.status === 'returned') { await connection.rollback(); return res.status(409).json({ error: 'Esta devolución ya fue cerrada y forma parte del historial' }); }
    if (assignment.unassigned_at && item.status !== 'returned') { await connection.rollback(); return res.status(409).json({ error: 'La asignación ya fue cerrada' }); }
    const offboardingId = existing?.id || randomUUID();
    const employeeReference = referenceOf(assignment);
    const [[openCase]] = await connection.query(`SELECT id FROM employee_offboarding_cases
      WHERE reference_type=? AND reference_value=? AND status='open' ORDER BY created_at DESC LIMIT 1 FOR UPDATE`, [employeeReference.type, employeeReference.value]);
    if (!openCase) await connection.query(`INSERT INTO employee_offboarding_cases
      (id,reference_type,reference_value,employee_name,status,tasks_json,updated_by_user_id,updated_by_name)
      VALUES (?,?,?,?, 'open',JSON_OBJECT(),?,?)`, [randomUUID(), employeeReference.type, employeeReference.value, assignment.usuario_asignado, actor.id, actor.name]);
    const returnedAtSql = item.status === 'returned' ? (item.return_date ? `${item.return_date} 12:00:00` : new Date()) : null;
    await connection.query(`INSERT INTO asset_offboarding_items
        (id,assignment_id,asset_uid,status,due_date,returned_at,condition_state,destination,accessories_json,notes,
         received_by_user_id,received_by_name,updated_by_user_id,updated_by_name)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON DUPLICATE KEY UPDATE status=VALUES(status),due_date=VALUES(due_date),returned_at=VALUES(returned_at),
        condition_state=VALUES(condition_state),destination=VALUES(destination),accessories_json=VALUES(accessories_json),
        notes=VALUES(notes),received_by_user_id=VALUES(received_by_user_id),received_by_name=VALUES(received_by_name),
        updated_by_user_id=VALUES(updated_by_user_id),updated_by_name=VALUES(updated_by_name)`, [
      offboardingId, assignment.id, assignment.asset_uid, item.status, item.due_date, returnedAtSql,
      item.condition_state, item.destination, JSON.stringify(item.accessories), item.notes,
      item.status === 'returned' ? actor.id : null, item.status === 'returned' ? actor.name : null, actor.id, actor.name,
    ]);
    if (item.status === 'returned') {
      const state = destinationAssetState(item.destination);
      await connection.query(`UPDATE activo_asignaciones
        SET unassigned_at=?, notes=CONCAT_WS('\n',NULLIF(notes,''),?) WHERE id=? AND unassigned_at IS NULL`,
      [returnedAtSql, item.notes ? `Devolución por baja: ${item.notes}` : 'Devolución por baja confirmada', assignment.id]);
      await connection.query(`UPDATE activos SET portal_user_id=NULL,tercero_id=NULL,rh_employee_id=NULL,
        usuario_asignado=NULL,estado=?,active=? WHERE id=?`, [state.estado, state.active, assignment.asset_id]);
    }
    await connection.commit();
    if (item.status === 'returned' && process.env.SAP_SYNC_DISABLED !== '1') void syncToSapBestEffort(assignment.asset_id);
    const [[row]] = await pool.query(`${OFFBOARDING_SELECT} WHERE aa.id=?`, [assignment.id]);
    res.json({ data: normalizeRow(row) });
  } catch (error) {
    await connection?.rollback().catch(() => {});
    next(error);
  } finally { connection?.release(); }
});

offboardingRouter.put('/offboarding/cases/:referenceType/:referenceValue', async (req, res, next) => {
  let connection;
  try {
    const referenceType = String(req.params.referenceType);
    const referenceValue = String(req.params.referenceValue);
    if (!['rh_employee', 'core_user'].includes(referenceType)) return res.status(400).json({ error: 'Referencia de empleado no válida' });
    if (referenceType === 'rh_employee' && !/^\d+$/.test(referenceValue)) return res.status(400).json({ error: 'Referencia RH no válida' });
    if (referenceType === 'core_user' && !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(referenceValue)) return res.status(400).json({ error: 'Referencia Core no válida' });
    const checklist = normalizeOffboardingChecklist(req.body);
    const actor = await fetchCurrentUser(req.headers.authorization);
    if (!actor) return res.status(401).json({ error: 'No autenticado' });
    connection = await pool.getConnection(); await connection.beginTransaction();
    const holderColumn = referenceType === 'rh_employee' ? 'rh_employee_id' : 'portal_user_id';
    const [[pending]] = await connection.query(`SELECT COUNT(*) total FROM activo_asignaciones WHERE ${holderColumn}=? AND unassigned_at IS NULL`, [referenceValue]);
    if (checklist.status === 'completed' && Number(pending.total)) { await connection.rollback(); return res.status(409).json({ error: `Todavía hay ${pending.total} activo(s) sin devolución confirmada` }); }
    const [[existing]] = await connection.query(`SELECT id FROM employee_offboarding_cases WHERE reference_type=? AND reference_value=? AND status='open' ORDER BY created_at DESC LIMIT 1 FOR UPDATE`, [referenceType, referenceValue]);
    const id = existing?.id || randomUUID();
    if (existing) await connection.query(`UPDATE employee_offboarding_cases SET employee_name=COALESCE(?,employee_name),status=?,tasks_json=?,notes=?,
      completed_at=IF(?='completed',NOW(),NULL),completed_by_user_id=IF(?='completed',?,NULL),completed_by_name=IF(?='completed',?,NULL),
      updated_by_user_id=?,updated_by_name=? WHERE id=?`, [checklist.employee_name, checklist.status, JSON.stringify(checklist.tasks), checklist.notes,
      checklist.status, checklist.status, actor.id, checklist.status, actor.name, actor.id, actor.name, id]);
    else await connection.query(`INSERT INTO employee_offboarding_cases
      (id,reference_type,reference_value,employee_name,status,tasks_json,notes,completed_at,completed_by_user_id,completed_by_name,updated_by_user_id,updated_by_name)
      VALUES (?,?,?,?,?,?,?,IF(?='completed',NOW(),NULL),IF(?='completed',?,NULL),IF(?='completed',?,NULL),?,?)`, [id, referenceType, referenceValue,
      checklist.employee_name, checklist.status, JSON.stringify(checklist.tasks), checklist.notes, checklist.status, checklist.status, actor.id, checklist.status, actor.name, actor.id, actor.name]);
    await connection.commit();
    const [[row]] = await pool.query('SELECT * FROM employee_offboarding_cases WHERE id=?', [id]);
    res.json({ data: normalizeCase(row) });
  } catch (error) { await connection?.rollback().catch(() => {}); next(error); }
  finally { connection?.release(); }
});
