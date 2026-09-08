import { randomUUID } from 'node:crypto';
import { getPhysicalArea } from '../integrations/obsClient.js';
import { getOrgUnit } from '../integrations/rhClient.js';

export const UNIT_KINDS = Object.freeze(['pending', 'inventory', 'physical', 'organizational', 'legacy', 'obsolete']);
export function unitError(message, status = 400) { return Object.assign(new Error(message), { status }); }
export function reviewReason(value) {
  if (typeof value !== 'string' || value.trim().length < 8 || value.trim().length > 1000) throw unitError('Describe el motivo y la evidencia (8 a 1000 caracteres).');
  return value.trim();
}
export function revisionNumber(value) {
  if (!Number.isSafeInteger(value) || value < 0) throw unitError('La revisión del registro es obligatoria. Vuelve a cargar la vista.');
  return value;
}
export function normalizeUnitReview(body = {}) {
  if (!UNIT_KINDS.includes(body.usage_kind)) throw unitError('Clasificación de unidad inválida.');
  const linked = ['physical', 'organizational'].includes(body.usage_kind);
  const reference = linked && typeof body.reference_id === 'string' ? body.reference_id.trim() : null;
  if (linked && (!reference || reference.length > 64)) throw unitError('Selecciona una referencia vigente del módulo propietario.');
  return { usage_kind: body.usage_kind, reference_id: reference, review_note: reviewReason(body.review_note), revision: revisionNumber(body.revision) };
}
export function normalizeUnitName(raw) {
  if (raw === null || raw === '') return null;
  if (typeof raw !== 'string' || raw.trim().length > 60) throw unitError('La unidad debe ser un nombre de hasta 60 caracteres.');
  return raw.trim() || null;
}
export async function captureUnit(db, raw, current = undefined) {
  const name = normalizeUnitName(raw);
  if (name === current || name === null) return name;
  const [rows] = await db.query(`SELECT nombre FROM sap_unidades
    WHERE TRIM(nombre) = ? AND activa = 1 AND archived_at IS NULL
      AND usage_kind NOT IN ('legacy', 'obsolete') FOR UPDATE`, [name]);
  if (rows.length !== 1) throw unitError('Selecciona una unidad vigente y única del catálogo. Las etiquetas históricas se conservan sólo en equipos que ya las tienen.', 409);
  return rows[0].nombre.trim();
}
export function unitSnapshot(asset) {
  return { unidad: asset.unidad ?? null, unit_is_manual: Number(asset.unit_is_manual || 0), physical_area_id: asset.physical_area_id ?? null };
}
const parsed = (value) => typeof value === 'string' ? JSON.parse(value) : value;
export async function recordUnitChange(connection, asset, after, actor, reason, reversesId = null) {
  if (!actor?.id) throw unitError('No se pudo identificar al autor del cambio.', 401);
  const id = randomUUID(); const revision = Number(asset.unit_revision || 0) + 1;
  const before = unitSnapshot(asset);
  await connection.query(`INSERT INTO asset_unit_changes
    (id,asset_uid,asset_revision,before_json,after_json,reason,actor_user_id,actor_name,reverses_id)
    VALUES (?,?,?,?,?,?,?,?,?)`, [id, asset.asset_uid, revision, JSON.stringify(before), JSON.stringify(after), reason, actor.id, actor.name || null, reversesId]);
  // Transactional audit: before/after never contain employee or credential fields.
  await connection.query(`INSERT INTO audit_events
    (event_uuid,module_code,actor_user_id,actor_name,action,entity_type,entity_id,request_id,before_json,after_json,metadata_json,status_code)
    VALUES (?,'activos',?,?,?,'asset-unit',?,?,?,?,?,200)`,
  [randomUUID(), actor.id, actor.name || null, reversesId ? 'asset-unit.reverted' : 'asset-unit.corrected', asset.asset_uid, randomUUID(), JSON.stringify(before), JSON.stringify(after), JSON.stringify({ reason, change_id: id, reverses_id: reversesId })]);
  return { id, revision };
}

// Also used by the compatible general PATCH, so an old form cannot bypass validation.
export async function saveAssetFields(db, assetId, fields, actor, options = {}) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [[asset]] = await connection.query('SELECT * FROM activos WHERE id = ? FOR UPDATE', [assetId]);
    if (!asset) throw unitError('Activo no encontrado.', 404);
    const next = { ...fields };
    if (Object.hasOwn(next, 'unidad')) next.unidad = await captureUnit(connection, next.unidad, asset.unidad);
    const changed = (Object.hasOwn(next, 'unidad') && next.unidad !== asset.unidad)
      || (Object.hasOwn(next, 'physical_area_id') && next.physical_area_id !== asset.physical_area_id);
    let change = null;
    if (changed) {
      if (options.expectedRevision !== undefined && revisionNumber(options.expectedRevision) !== Number(asset.unit_revision)) throw unitError('La unidad cambió mientras la revisabas. Recarga antes de guardar.', 409);
      const after = unitSnapshot({ ...asset, ...next, unit_is_manual: Object.hasOwn(next, 'unidad') && next.unidad !== asset.unidad ? 1 : asset.unit_is_manual });
      change = await recordUnitChange(connection, asset, after, actor, reviewReason(options.reason || 'Edición de unidad desde la ficha del activo.'));
      next.unit_is_manual = after.unit_is_manual; next.unit_revision = change.revision;
    }
    if (Object.keys(next).length) {
      // fields comes exclusively from server allowlists, never raw request keys.
      const keys = Object.keys(next);
      await connection.query(`UPDATE activos SET ${keys.map((key) => `\`${key}\` = ?`).join(', ')} WHERE id = ?`, [...keys.map((key) => next[key]), assetId]);
    }
    await connection.commit();
    return { changed, change, data: { ...asset, ...next } };
  } catch (error) { await connection.rollback(); throw error; }
  finally { connection.release(); }
}

// Compara campos explícitamente en vez de JSON.stringify: MySQL puede
// devolver las claves de un JSON en un orden distinto al que se insertó, lo
// que rompería una comparación de cadenas aunque el contenido sea idéntico.
export function unitSnapshotsEqual(a, b) {
  return (a?.unidad ?? null) === (b?.unidad ?? null)
    && Number(a?.unit_is_manual || 0) === Number(b?.unit_is_manual || 0)
    && (a?.physical_area_id ?? null) === (b?.physical_area_id ?? null);
}
export async function revertUnitChange(db, changeId, actor, reason) {
  reason = reviewReason(reason);
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [[event]] = await connection.query('SELECT * FROM asset_unit_changes WHERE id = ?', [changeId]);
    if (!event) throw unitError('Cambio no encontrado.', 404);
    const [[asset]] = await connection.query('SELECT * FROM activos WHERE asset_uid = ? FOR UPDATE', [event.asset_uid]);
    if (!asset || Number(asset.unit_revision) !== Number(event.asset_revision)
      || !unitSnapshotsEqual(unitSnapshot(asset), parsed(event.after_json))) throw unitError('Hay cambios posteriores; revisa el historial antes de revertir.', 409);
    const before = parsed(event.before_json);
    const change = await recordUnitChange(connection, asset, before, actor, reason, event.id);
    await connection.query('UPDATE activos SET unidad=?,unit_is_manual=?,physical_area_id=?,unit_revision=? WHERE id=?', [before.unidad, before.unit_is_manual, before.physical_area_id, change.revision, asset.id]);
    await connection.commit();
    return { id: asset.id, change };
  } catch (error) { await connection.rollback(); throw error; }
  finally { connection.release(); }
}

// Clasifica un renglón del catálogo (sap_unidades.id, no el nombre: dos
// renglones pueden compartir nombre mientras la duplicidad no se resuelva, y
// esta función nunca decide por cuenta propia cuál es el "bueno"). Una
// referencia física u organizacional se valida en vivo contra el módulo
// dueño -- nunca se asume vigente sólo porque el formulario la mandó.
export async function classifyUnit(db, id, review, actor) {
  if (!actor?.id) throw unitError('No se pudo identificar al autor de la clasificación.', 401);
  const normalized = normalizeUnitReview(review);
  if (normalized.usage_kind === 'physical') {
    const area = await getPhysicalArea(normalized.reference_id, actor.authorization);
    if (!area) throw unitError('La referencia de ubicación física no existe o MRTI-Obs no la confirma vigente.', 409);
  } else if (normalized.usage_kind === 'organizational') {
    const unit = await getOrgUnit(normalized.reference_id, actor.authorization);
    if (!unit) throw unitError('La referencia de organización no existe o RH no la confirma activa.', 409);
  }
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [[row]] = await connection.query(
      'SELECT id, nombre, usage_kind, reference_id, review_revision FROM sap_unidades WHERE id = ? FOR UPDATE',
      [id]
    );
    if (!row) throw unitError('La unidad no existe en el catálogo.', 404);
    if (Number(row.review_revision) !== normalized.revision) throw unitError('La clasificación cambió mientras la revisabas. Recarga antes de guardar.', 409);
    await connection.query(
      `UPDATE sap_unidades SET usage_kind = ?, reference_id = ?, review_note = ?, reviewed_by = ?, reviewed_at = NOW(), review_revision = review_revision + 1 WHERE id = ?`,
      [normalized.usage_kind, normalized.reference_id, normalized.review_note, actor.id, id]
    );
    await connection.query(`INSERT INTO audit_events
      (event_uuid, module_code, actor_user_id, actor_name, action, entity_type, entity_id, request_id, before_json, after_json, metadata_json, status_code)
      VALUES (?, 'activos', ?, ?, 'unit-catalog.classified', 'unit-catalog', ?, ?, ?, ?, ?, 200)`,
      [randomUUID(), actor.id, actor.name || null, String(id), randomUUID(),
        JSON.stringify({ usage_kind: row.usage_kind, reference_id: row.reference_id }),
        JSON.stringify({ usage_kind: normalized.usage_kind, reference_id: normalized.reference_id }),
        JSON.stringify({ nombre: row.nombre, review_note: normalized.review_note })]);
    await connection.commit();
    return { id: Number(id), nombre: row.nombre, usage_kind: normalized.usage_kind, reference_id: normalized.reference_id, revision: normalized.revision + 1 };
  } catch (error) { await connection.rollback(); throw error; }
  finally { connection.release(); }
}

export async function unitUsage(db, name) {
  const [[assets]] = await db.query("SELECT COUNT(*) AS total FROM activos WHERE NULLIF(TRIM(unidad),'') <=> NULLIF(TRIM(?),'')", [name]);
  const [[components]] = await db.query("SELECT COUNT(*) AS total FROM sap_componentes WHERE NULLIF(TRIM(unidad),'') <=> NULLIF(TRIM(?),'')", [name]);
  return { assets: Number(assets.total), components: Number(components.total) };
}
