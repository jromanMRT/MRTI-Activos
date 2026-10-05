import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { pool } from '../db.js';
import { administratorOnly } from '../auth.js';
import { decryptSecret, encryptSecret } from '../integrations/credentialCrypto.js';

// Accesos TeamViewer por equipo. La contraseña nunca sale en el listado:
// solo por GET /:id/secret (administradores, auditado como credential.viewed).
export const teamviewerRouter = Router();

function badRequest(message) { const error = new Error(message); error.status = 400; return error; }

// TeamViewer muestra el ID con espacios ("1 234 567 890"); se guarda solo
// con dígitos para que el mismo equipo no se registre dos veces.
export function normalizeTeamviewerId(value) {
  const digits = String(value ?? '').replace(/[\s-]/g, '');
  if (!/^\d{6,12}$/.test(digits)) throw badRequest('El ID de TeamViewer debe tener entre 6 y 12 dígitos');
  return digits;
}

const optionalText = (value, max) => { const text = String(value ?? '').trim(); return text ? text.slice(0, max) : null; };

export function normalizeTeamviewerInput(body = {}, { partial = false } = {}) {
  const has = (key) => Object.prototype.hasOwnProperty.call(body, key);
  const result = {};
  if (!partial || has('teamviewer_id')) result.teamviewer_id = normalizeTeamviewerId(body.teamviewer_id);
  if (!partial || has('alias')) result.alias = optionalText(body.alias, 180);
  if (!partial || has('notes')) result.notes = optionalText(body.notes, 5000);
  if (!partial || has('asset_uid')) result.asset_uid = optionalText(body.asset_uid, 36);
  // En una edición, contraseña vacía significa "no cambiarla".
  if (has('password') && String(body.password ?? '') !== '') result.password = String(body.password).slice(0, 255);
  return result;
}

const LIST_SELECT = `SELECT t.id, t.teamviewer_id, t.alias, t.notes, t.asset_uid, t.password_encrypted IS NOT NULL AS has_password,
    t.password_updated_at, t.created_at, t.updated_at,
    a.id AS asset_id, a.center_code, a.descripcion, a.usuario_asignado, a.estado
  FROM teamviewer_devices t
  LEFT JOIN activos a ON a.asset_uid = t.asset_uid AND a.deleted_at IS NULL`;

async function loadOne(id) {
  const [rows] = await pool.query(`${LIST_SELECT} WHERE t.id = ? LIMIT 1`, [id]);
  return rows[0] || null;
}

async function assertAssetExists(assetUid) {
  if (!assetUid) return;
  const [[asset]] = await pool.query('SELECT asset_uid FROM activos WHERE asset_uid = ? AND deleted_at IS NULL LIMIT 1', [assetUid]);
  if (!asset) throw badRequest('El equipo seleccionado no existe');
}

function duplicateMessage(error) {
  if (error?.code !== 'ER_DUP_ENTRY') return null;
  return String(error.message).includes('uq_teamviewer_devices_asset')
    ? 'Ese equipo ya tiene un TeamViewer vinculado'
    : 'Ese ID de TeamViewer ya está registrado';
}

teamviewerRouter.get('/', async (req, res, next) => {
  try {
    const byAsset = req.query.asset_uid ? String(req.query.asset_uid) : null;
    const [rows] = await pool.query(`${LIST_SELECT} ${byAsset ? 'WHERE t.asset_uid = ?' : ''} ORDER BY a.center_code IS NULL, a.center_code, t.alias, t.teamviewer_id`, byAsset ? [byAsset] : []);
    res.json({ data: rows.map((row) => ({ ...row, has_password: Boolean(row.has_password) })) });
  } catch (error) { next(error); }
});

// Equipos para el selector: todos los estados (un equipo en mantenimiento
// también puede necesitar acceso remoto), marcando cuáles ya tienen uno.
teamviewerRouter.get('/assets', async (_req, res, next) => {
  try {
    const [rows] = await pool.query(`SELECT a.asset_uid, a.center_code, a.descripcion, a.usuario_asignado, a.numero_serie, a.estado, t.id AS teamviewer_device_id
      FROM activos a LEFT JOIN teamviewer_devices t ON t.asset_uid = a.asset_uid
      WHERE a.deleted_at IS NULL
      ORDER BY a.center_code`);
    res.json({ data: rows });
  } catch (error) { next(error); }
});

teamviewerRouter.post('/', administratorOnly, async (req, res, next) => {
  try {
    const input = normalizeTeamviewerInput(req.body);
    await assertAssetExists(input.asset_uid);
    const id = randomUUID();
    const password = input.password ? encryptSecret(input.password) : null;
    await pool.query(`INSERT INTO teamviewer_devices (id, teamviewer_id, alias, password_encrypted, asset_uid, notes, created_by, updated_by, password_updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [id, input.teamviewer_id, input.alias, password, input.asset_uid, input.notes, req.portalUser.id, req.portalUser.id, password ? new Date() : null]);
    res.status(201).json({ data: await loadOne(id) });
  } catch (error) {
    const message = duplicateMessage(error);
    if (message) return res.status(409).json({ error: message });
    next(error);
  }
});

teamviewerRouter.patch('/:id', administratorOnly, async (req, res, next) => {
  try {
    const input = normalizeTeamviewerInput(req.body, { partial: true });
    if ('asset_uid' in input) await assertAssetExists(input.asset_uid);
    const sets = []; const params = [];
    for (const field of ['teamviewer_id', 'alias', 'notes', 'asset_uid']) {
      if (field in input) { sets.push(`${field} = ?`); params.push(input[field]); }
    }
    if (input.password) { sets.push('password_encrypted = ?', 'password_updated_at = NOW()'); params.push(encryptSecret(input.password)); }
    if (!sets.length) throw badRequest('No hay cambios que guardar');
    sets.push('updated_by = ?'); params.push(req.portalUser.id, req.params.id);
    const [result] = await pool.query(`UPDATE teamviewer_devices SET ${sets.join(', ')} WHERE id = ?`, params);
    if (!result.affectedRows) return res.status(404).json({ error: 'Registro no encontrado' });
    res.json({ data: await loadOne(req.params.id) });
  } catch (error) {
    const message = duplicateMessage(error);
    if (message) return res.status(409).json({ error: message });
    next(error);
  }
});

teamviewerRouter.delete('/:id', administratorOnly, async (req, res, next) => {
  try {
    const [result] = await pool.query('DELETE FROM teamviewer_devices WHERE id = ?', [req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ error: 'Registro no encontrado' });
    res.json({ data: { id: req.params.id } });
  } catch (error) { next(error); }
});

teamviewerRouter.get('/:id/secret', administratorOnly, async (req, res, next) => {
  try {
    const [[row]] = await pool.query('SELECT password_encrypted FROM teamviewer_devices WHERE id = ? LIMIT 1', [req.params.id]);
    if (!row) return res.status(404).json({ error: 'Registro no encontrado' });
    const password = decryptSecret(row.password_encrypted);
    await pool.query(`INSERT INTO audit_events
      (event_uuid, module_code, actor_user_id, actor_name, actor_email, action, entity_type, entity_id, request_id, ip_address, user_agent, metadata_json, status_code)
      VALUES (?, 'activos', ?, ?, ?, 'credential.viewed', 'teamviewer', ?, ?, ?, ?, ?, 200)`, [
      randomUUID(), req.portalUser.id, req.portalUser.name, req.portalUser.email, req.params.id, randomUUID(), req.ip || null,
      String(req.headers['user-agent'] || '').slice(0, 512) || null, JSON.stringify({ resource: 'teamviewer', id: req.params.id, secret_values: '[REDACTADO]' }),
    ]);
    res.set('Cache-Control', 'no-store');
    res.json({ data: { password } });
  } catch (error) { next(error); }
});
