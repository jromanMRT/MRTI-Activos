import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { pool } from '../db.js';
import { administratorOnly } from '../auth.js';
import { assertCanComplete, checklistProgress, normalizeEntryUpdate, normalizeItemInput, reorderPlan } from '../domain/setupChecklist.js';

// Checklist de preparación de equipos. La plantilla la editan
// administradores; marcar pasos lo puede hacer cualquier usuario del módulo
// y queda registrado quién y cuándo.
export const setupChecklistRouter = Router();

const ITEM_COLUMNS = 'id, section, label, help_text, sort_order, is_active, updated_by_name, updated_at';
const ENTRY_COLUMNS = `id, checklist_id, item_id, section, label, sort_order, status, note,
  DATE_FORMAT(done_at,'%Y-%m-%dT%H:%i:%s') AS done_at, done_by_name`;
const CHECKLIST_COLUMNS = `c.id, c.asset_uid, c.status, c.notes, c.started_by_name,
  DATE_FORMAT(c.created_at,'%Y-%m-%dT%H:%i:%s') AS created_at,
  DATE_FORMAT(c.completed_at,'%Y-%m-%dT%H:%i:%s') AS completed_at, c.completed_by_name,
  DATE_FORMAT(c.updated_at,'%Y-%m-%dT%H:%i:%s') AS updated_at`;

const notFound = (res, what = 'Checklist no encontrado') => res.status(404).json({ error: what });

async function loadChecklist(id, db = pool) {
  const [[checklist]] = await db.query(`SELECT ${CHECKLIST_COLUMNS} FROM asset_setup_checklists c WHERE c.id = ?`, [id]);
  if (!checklist) return null;
  const [entries] = await db.query(`SELECT ${ENTRY_COLUMNS} FROM asset_setup_checklist_entries WHERE checklist_id = ? ORDER BY sort_order, id`, [id]);
  return { ...checklist, entries, progress: checklistProgress(entries) };
}

// ---- Plantilla -------------------------------------------------------------

// Orden para un paso que entra a una sección: justo después del último de
// esa sección (+1, sin invadir la siguiente); en una sección nueva, al final.
async function endOfSection(section) {
  const [[{ last }]] = await pool.query('SELECT MAX(sort_order) AS last FROM asset_setup_checklist_items WHERE section = ? AND is_active = 1', [section]);
  if (last !== null) return Number(last) + 1;
  const [[{ overall }]] = await pool.query('SELECT COALESCE(MAX(sort_order), 0) AS overall FROM asset_setup_checklist_items');
  return Number(overall) + 10;
}

setupChecklistRouter.get('/items', async (req, res, next) => {
  try {
    const all = req.query.all === '1';
    const [rows] = await pool.query(`SELECT ${ITEM_COLUMNS} FROM asset_setup_checklist_items ${all ? '' : 'WHERE is_active = 1'} ORDER BY is_active DESC, sort_order, id`);
    res.json({ data: rows.map((row) => ({ ...row, is_active: Boolean(row.is_active) })) });
  } catch (error) { next(error); }
});

setupChecklistRouter.post('/items', administratorOnly, async (req, res, next) => {
  try {
    const input = normalizeItemInput(req.body);
    const sortOrder = await endOfSection(input.section);
    const [result] = await pool.query(`INSERT INTO asset_setup_checklist_items (section, label, help_text, sort_order, created_by_name, updated_by_name)
      VALUES (?, ?, ?, ?, ?, ?)`, [input.section, input.label, input.help_text, sortOrder, req.portalUser.name, req.portalUser.name]);
    const [[row]] = await pool.query(`SELECT ${ITEM_COLUMNS} FROM asset_setup_checklist_items WHERE id = ?`, [result.insertId]);
    res.status(201).json({ data: { ...row, is_active: Boolean(row.is_active) } });
  } catch (error) { next(error); }
});

setupChecklistRouter.put('/items/order', administratorOnly, async (req, res, next) => {
  let connection;
  try {
    const plan = reorderPlan(req.body?.ids);
    connection = await pool.getConnection(); await connection.beginTransaction();
    for (const step of plan) await connection.query('UPDATE asset_setup_checklist_items SET sort_order = ?, updated_by_name = ? WHERE id = ?', [step.sort_order, req.portalUser.name, step.id]);
    await connection.commit();
    res.json({ data: plan });
  } catch (error) { await connection?.rollback().catch(() => {}); next(error); }
  finally { connection?.release(); }
});

setupChecklistRouter.patch('/items/:id', administratorOnly, async (req, res, next) => {
  try {
    const input = normalizeItemInput(req.body, { partial: true });
    if (input.section || input.is_active === 1) {
      const [[existing]] = await pool.query('SELECT section, is_active FROM asset_setup_checklist_items WHERE id = ?', [req.params.id]);
      if (!existing) return notFound(res, 'Paso no encontrado');
      const section = input.section || existing.section;
      // Cambiar de sección o restaurar un paso lo manda al final de su sección.
      if (section !== existing.section || (input.is_active === 1 && !existing.is_active)) input.sort_order = await endOfSection(section);
    }
    const fields = Object.keys(input);
    if (!fields.length) return res.status(400).json({ error: 'No hay cambios que guardar' });
    const [result] = await pool.query(`UPDATE asset_setup_checklist_items SET ${fields.map((field) => `${field} = ?`).join(', ')}, updated_by_name = ? WHERE id = ?`,
      [...fields.map((field) => input[field]), req.portalUser.name, req.params.id]);
    if (!result.affectedRows) return notFound(res, 'Paso no encontrado');
    const [[row]] = await pool.query(`SELECT ${ITEM_COLUMNS} FROM asset_setup_checklist_items WHERE id = ?`, [req.params.id]);
    res.json({ data: { ...row, is_active: Boolean(row.is_active) } });
  } catch (error) { next(error); }
});

// ---- Checklists por activo -------------------------------------------------

// Equipos con checklist abierto (y los cerrados recientemente) para la vista general.
setupChecklistRouter.get('/checklists', async (_req, res, next) => {
  try {
    const [rows] = await pool.query(`SELECT ${CHECKLIST_COLUMNS}, a.id AS asset_id, a.center_code, a.descripcion, a.usuario_asignado,
        SUM(e.status = 'done') AS done, SUM(e.status = 'na') AS na, COUNT(e.id) AS total
      FROM asset_setup_checklists c
      JOIN activos a ON a.asset_uid = c.asset_uid
      LEFT JOIN asset_setup_checklist_entries e ON e.checklist_id = c.id
      WHERE c.status = 'open' OR c.completed_at >= DATE_SUB(NOW(), INTERVAL 60 DAY)
      GROUP BY c.id ORDER BY c.status = 'open' DESC, c.updated_at DESC LIMIT 300`);
    res.json({ data: rows.map((row) => {
      const total = Number(row.total), resolved = Number(row.done) + Number(row.na);
      return { ...row, done: Number(row.done), na: Number(row.na), total, pending: total - resolved, percent: total ? Math.round((resolved / total) * 100) : 0 };
    }) });
  } catch (error) { next(error); }
});

setupChecklistRouter.get('/assets/:assetUid', async (req, res, next) => {
  try {
    const [rows] = await pool.query(`SELECT c.id FROM asset_setup_checklists c WHERE c.asset_uid = ? ORDER BY c.created_at DESC`, [req.params.assetUid]);
    const checklists = await Promise.all(rows.map((row) => loadChecklist(row.id)));
    res.json({ data: checklists });
  } catch (error) { next(error); }
});

setupChecklistRouter.post('/assets/:assetUid', async (req, res, next) => {
  let connection;
  try {
    connection = await pool.getConnection(); await connection.beginTransaction();
    const [[asset]] = await connection.query('SELECT asset_uid FROM activos WHERE asset_uid = ? AND deleted_at IS NULL FOR UPDATE', [req.params.assetUid]);
    if (!asset) { await connection.rollback(); return notFound(res, 'Activo no encontrado'); }
    const [[open]] = await connection.query("SELECT id FROM asset_setup_checklists WHERE asset_uid = ? AND status = 'open' LIMIT 1", [asset.asset_uid]);
    if (open) { await connection.rollback(); return res.status(409).json({ error: 'Este equipo ya tiene un checklist abierto' }); }
    const [items] = await connection.query('SELECT id, section, label, sort_order FROM asset_setup_checklist_items WHERE is_active = 1 ORDER BY sort_order, id');
    if (!items.length) { await connection.rollback(); return res.status(409).json({ error: 'La plantilla no tiene pasos activos' }); }
    const id = randomUUID();
    await connection.query('INSERT INTO asset_setup_checklists (id, asset_uid, started_by_user_id, started_by_name) VALUES (?, ?, ?, ?)', [id, asset.asset_uid, req.portalUser.id, req.portalUser.name]);
    await connection.query(`INSERT INTO asset_setup_checklist_entries (checklist_id, item_id, section, label, sort_order) VALUES ${items.map(() => '(?, ?, ?, ?, ?)').join(', ')}`,
      items.flatMap((item) => [id, item.id, item.section, item.label, item.sort_order]));
    await connection.commit();
    res.status(201).json({ data: await loadChecklist(id) });
  } catch (error) { await connection?.rollback().catch(() => {}); next(error); }
  finally { connection?.release(); }
});

async function openChecklistOr409(res, id) {
  const [[checklist]] = await pool.query('SELECT id, status FROM asset_setup_checklists WHERE id = ?', [id]);
  if (!checklist) { notFound(res); return null; }
  if (checklist.status !== 'open') { res.status(409).json({ error: 'Este checklist ya está cerrado; reábrelo para modificarlo' }); return null; }
  return checklist;
}

setupChecklistRouter.patch('/checklists/:id/entries/:entryId', async (req, res, next) => {
  try {
    const update = normalizeEntryUpdate(req.body);
    if (!await openChecklistOr409(res, req.params.id)) return;
    const sets = []; const params = [];
    if ('status' in update) {
      sets.push('status = ?'); params.push(update.status);
      // Quién y cuándo se registra al resolver el paso; al regresarlo a pendiente se limpia.
      if (update.status === 'pending') sets.push('done_at = NULL', 'done_by_user_id = NULL', 'done_by_name = NULL');
      else { sets.push('done_at = NOW()', 'done_by_user_id = ?', 'done_by_name = ?'); params.push(req.portalUser.id, req.portalUser.name); }
    }
    if ('note' in update) { sets.push('note = ?'); params.push(update.note); }
    const [result] = await pool.query(`UPDATE asset_setup_checklist_entries SET ${sets.join(', ')} WHERE id = ? AND checklist_id = ?`, [...params, req.params.entryId, req.params.id]);
    if (!result.affectedRows) return notFound(res, 'Paso no encontrado');
    await pool.query('UPDATE asset_setup_checklists SET updated_at = NOW() WHERE id = ?', [req.params.id]);
    res.json({ data: await loadChecklist(req.params.id) });
  } catch (error) { next(error); }
});

// Paso extra solo para este equipo (no toca la plantilla).
setupChecklistRouter.post('/checklists/:id/entries', async (req, res, next) => {
  try {
    const input = normalizeItemInput({ section: req.body?.section || 'Pasos adicionales', label: req.body?.label });
    if (!await openChecklistOr409(res, req.params.id)) return;
    const [[{ next_order: nextOrder }]] = await pool.query('SELECT COALESCE(MAX(sort_order), 0) + 10 AS next_order FROM asset_setup_checklist_entries WHERE checklist_id = ?', [req.params.id]);
    await pool.query('INSERT INTO asset_setup_checklist_entries (checklist_id, item_id, section, label, sort_order) VALUES (?, NULL, ?, ?, ?)', [req.params.id, input.section, input.label, nextOrder]);
    res.status(201).json({ data: await loadChecklist(req.params.id) });
  } catch (error) { next(error); }
});

setupChecklistRouter.patch('/checklists/:id', async (req, res, next) => {
  try {
    const current = await loadChecklist(req.params.id);
    if (!current) return notFound(res);
    const body = req.body || {};
    const sets = []; const params = [];
    if (Object.prototype.hasOwnProperty.call(body, 'notes')) {
      const notes = String(body.notes ?? '').trim();
      if (notes.length > 4000) return res.status(400).json({ error: 'Las notas no pueden exceder 4000 caracteres' });
      sets.push('notes = ?'); params.push(notes || null);
    }
    if (body.status === 'completed' && current.status === 'open') {
      assertCanComplete(current.entries);
      sets.push("status = 'completed'", 'completed_at = NOW()', 'completed_by_user_id = ?', 'completed_by_name = ?'); params.push(req.portalUser.id, req.portalUser.name);
    } else if (body.status === 'open' && current.status === 'completed') {
      sets.push("status = 'open'", 'completed_at = NULL', 'completed_by_user_id = NULL', 'completed_by_name = NULL');
    }
    if (!sets.length) return res.status(400).json({ error: 'No hay cambios que guardar' });
    await pool.query(`UPDATE asset_setup_checklists SET ${sets.join(', ')} WHERE id = ?`, [...params, req.params.id]);
    res.json({ data: await loadChecklist(req.params.id) });
  } catch (error) { next(error); }
});
