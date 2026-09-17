import { Router } from 'express';
import { unitInventoryFilter } from '../unitInventory.js';
import { randomUUID } from 'node:crypto';
import { pool } from '../db.js';
import { ALL_FIELDS, DATE_FIELDS, FIELD_GROUPS, LIST_COLUMNS, normalizeAssetDates } from '../meta.js';
import { fetchSapAssetCredentials, pushAssetToSap, updateSapAssetCredentials } from '../integrations/sapClient.js';
import { administratorOnly, fetchCurrentUser } from '../auth.js';
import { assetDocumentUpload, cleanOriginalFilename, detectAssetDocument, removeStoredAssetDocument, storeAssetDocument } from '../documentStorage.js';
import { canDeleteAssetDocument } from '../domain/documentPermissions.js';
import { captureUnit, saveAssetFields } from '../domain/unitReview.js';
import { getAssetAssignmentProfile } from '../integrations/rhClient.js';
import { assetPersonSearch } from '../assetPersonSearch.js';

// Empuja el renglón recién creado/editado hacia SAP (ver plan de la
// integración SAP: copia local + escritura en ambos lados). Si SAP no está
// configurado o no responde, la petición ya respondió con éxito -- solo se
// deja constancia en sap_sync_error para que el job periódico reintente
// (ver server/src/integrations/sapSync.js). Nunca bloquea al usuario.
export async function syncToSapBestEffort(id) {
  try {
    const [[row]] = await pool.query('SELECT * FROM activos WHERE id = ?', [id]);
    await pushAssetToSap(row);
    await pool.query('UPDATE activos SET sap_synced_at = NOW(), sap_sync_error = NULL WHERE id = ?', [id]);
  } catch (error) {
    await pool.query('UPDATE activos SET sap_sync_error = ? WHERE id = ?', [String(error.message).slice(0, 255), id]);
  }
}

export const activosRouter = Router();

const ASSET_SORTS = Object.freeze({
  center_code: ["CAST(SUBSTRING_INDEX(center_code, '-', -1) AS UNSIGNED)", 'center_code'],
  tipo: ["NULLIF(tipo, '')"],
  brand: ["NULLIF(marca, '')", "NULLIF(modelo, '')", "NULLIF(descripcion, '')"],
  service: ["NULLIF(service_tag, '')", "NULLIF(numero_serie, '')"],
  user: ["NULLIF(usuario_asignado, '')"],
  location: ["NULLIF(unidad, '')", "NULLIF(area, '')"],
  company: ["NULLIF(empresa, '')"],
  status: ["NULLIF(estado, '')"],
  age: ['fecha_compra'],
  documents: ['documents_count'],
});

export function resolveAssetSort(sort, order) {
  const key = Object.prototype.hasOwnProperty.call(ASSET_SORTS, sort) ? sort : 'center_code';
  const direction = String(order).toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  const primary = ASSET_SORTS[key].map((expression) => `(${expression}) IS NULL ASC, ${expression} ${direction}`).join(', ');
  const stableNewest = key === 'center_code' ? '' : ", CAST(SUBSTRING_INDEX(center_code, '-', -1) AS UNSIGNED) DESC";
  return `${primary}${stableNewest}`;
}

// Un GET anterior ya pudo haber devuelto una fecha como marca de tiempo ISO
// completa (mysql2 entrega DATETIME como objeto Date; JSON.stringify lo
// serializa como '2026-06-15T00:00:00.000Z') -- si ese valor no se toca en
// el formulario y se reenvía tal cual, MySQL lo rechaza porque no acepta
// 'T'/'Z'/milisegundos en un literal DATETIME. Aquí se toma solo la parte
// de fecha, sin importar el formato de entrada.
function normalizeDateValue(value) {
  if (!value) return null;
  const match = String(value).match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

function pickAllowedFields(body) {
  const fields = {};
  for (const key of ALL_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(body, key)) {
      const raw = body[key] === '' ? null : body[key];
      fields[key] = DATE_FIELDS.has(key) ? normalizeDateValue(raw) : raw;
    }
  }
  return fields;
}

activosRouter.get('/meta', (_req, res) => {
  res.json({ groups: FIELD_GROUPS });
});

activosRouter.get('/', async (req, res, next) => {
  try {
    const { q, tipo, estado, unidad, empresa, area, limit, sort, order } = req.query;
    const where = [];
    const params = [];

    const unitFilter = unitInventoryFilter(req.query);
    if (unitFilter) { where.push(unitFilter.sql); params.push(...unitFilter.values); }

    if (q) {
      const people = await assetPersonSearch(pool, req.headers.authorization, q);
      where.push(`(descripcion LIKE ? OR usuario_asignado LIKE ? OR numero_serie LIKE ? OR service_tag LIKE ? OR modelo LIKE ? OR marca LIKE ? OR center_code LIKE ?${people.sql ? ` OR ${people.sql}` : ''})`);
      const term = `%${q}%`;
      params.push(term, term, term, term, term, term, term, ...people.params);
    }
    if (tipo) { where.push('tipo = ?'); params.push(tipo); }
    if (estado) { where.push('estado = ?'); params.push(estado); }
    if (unidad) { where.push('unidad = ?'); params.push(unidad); }
    if (empresa) { where.push('empresa = ?'); params.push(empresa); }
    if (area) {
      where.push('(area LIKE ? OR unidad LIKE ?)');
      const areaTerm = `%${area}%`;
      params.push(areaTerm, areaTerm);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const cap = Math.min(Math.max(Number(limit) || 500, 1), 1000);
    const orderSql = resolveAssetSort(sort, order);

    const [rows] = await pool.query(
      `SELECT ${LIST_COLUMNS.join(',')},
              (SELECT COUNT(*) FROM sap_documentos d
                WHERE d.center_code = activos.center_code AND d.archived_at IS NULL) AS documents_count
         FROM activos ${whereSql}
        ORDER BY ${orderSql} LIMIT ${cap}`,
      params
    );
    res.json({ data: rows.map(normalizeAssetDates) });
  } catch (error) {
    next(error);
  }
});

activosRouter.get('/stats', async (_req, res, next) => {
  try {
    const [[row]] = await pool.query(`SELECT
      COUNT(*) AS total,
      SUM(estado = 'Activo') AS activos,
      SUM(estado = 'En mantenimiento') AS mantenimiento,
      SUM(estado = 'Inactivo') AS inactivos,
      SUM(estado = 'Baja') AS baja
      FROM activos`);
    res.json({ data: Object.fromEntries(Object.entries(row).map(([key, value]) => [key, Number(value || 0)])) });
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
        'UPDATE activos SET portal_user_id = ?, tercero_id = NULL, usuario_asignado = ? WHERE id = ?',
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
    if (row) return res.json({ data: normalizeAssetDates(row) });
    // El mismo tipo de UUID también puede pertenecer a un renglón de
    // sap_fortigate vinculado a MRTI Monitor (ver migración 014).
    const [[fortigateRow]] = await pool.query(
      'SELECT id, asset_uid, software, numero_serie, proyecto FROM sap_fortigate WHERE asset_uid = ? AND archived_at IS NULL',
      [req.params.assetUid]
    );
    if (fortigateRow) return res.json({ data: { ...fortigateRow, source: 'sap_fortigate' } });
    return res.status(404).json({ error: 'Activo no encontrado' });
  } catch (error) {
    next(error);
  }
});

activosRouter.get('/:id/asignaciones', async (req, res, next) => {
  try {
    const [[asset]] = await pool.query('SELECT asset_uid FROM activos WHERE id = ?', [req.params.id]);
    if (!asset) return res.status(404).json({ error: 'Activo no encontrado' });
    const [rows] = await pool.query(
      `SELECT a.*, t.nombre AS tercero_nombre, t.organizacion AS tercero_organizacion
         FROM activo_asignaciones a
         LEFT JOIN terceros t ON t.id = a.tercero_id
        WHERE a.asset_uid = ? AND a.archived_at IS NULL
        ORDER BY a.assigned_at DESC`,
      [asset.asset_uid]
    );
    res.json({ data: rows });
  } catch (error) {
    next(error);
  }
});

// Acepta exactamente uno de portal_user_id (empleado con cuenta en Core),
// tercero_id (persona registrada en /terceros, sin cuenta en Core) o
// rh_employee_id (empleado real con ficha en RH que todavía no tiene cuenta
// de Core -- ver migración 008). No hay una via "por defecto": quien llama
// tiene que decir cual es.
activosRouter.post('/:id/asignaciones', async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const portalUserId = req.body?.portal_user_id ? String(req.body.portal_user_id).trim() : null;
    const terceroId = req.body?.tercero_id ? String(req.body.tercero_id).trim() : null;
    const rhEmployeeId = req.body?.rh_employee_id ? Number(req.body.rh_employee_id) : null;
    const holderCount = [portalUserId, terceroId, rhEmployeeId].filter(Boolean).length;
    if (holderCount !== 1) {
      return res.status(400).json({ error: 'Envía exactamente uno: portal_user_id, tercero_id o rh_employee_id' });
    }
    if (portalUserId && !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(portalUserId)) {
      return res.status(400).json({ error: 'portal_user_id debe ser un UUID de MRTI Core' });
    }
    if (rhEmployeeId && (!Number.isInteger(rhEmployeeId) || rhEmployeeId <= 0)) {
      return res.status(400).json({ error: 'rh_employee_id debe ser un entero positivo' });
    }

    let usuarioAsignado = req.body?.user_name || null;
    let empresaAsignada = null;
    if (terceroId) {
      const [[tercero]] = await connection.query('SELECT nombre, organizacion FROM terceros WHERE id = ? AND estado <> \'Inactivo\'', [terceroId]);
      if (!tercero) return res.status(400).json({ error: 'El tercero indicado no existe o está inactivo' });
      usuarioAsignado = tercero.organizacion ? `${tercero.nombre} (${tercero.organizacion})` : tercero.nombre;
    }
    if (portalUserId || rhEmployeeId) {
      const profile = await getAssetAssignmentProfile(req.headers.authorization, {
        employeeId: rhEmployeeId,
        portalUserId,
      });
      usuarioAsignado = profile.full_name;
      empresaAsignada = profile.company_name || null;
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
      `INSERT INTO activo_asignaciones (id, asset_uid, portal_user_id, tercero_id, rh_employee_id, notes)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [assignmentId, asset.asset_uid, portalUserId, terceroId, rhEmployeeId, req.body?.notes || null]
    );
    await connection.query(
      'UPDATE activos SET portal_user_id = ?, tercero_id = ?, rh_employee_id = ?, usuario_asignado = ?, empresa = ? WHERE id = ?',
      [portalUserId, terceroId, rhEmployeeId, usuarioAsignado, empresaAsignada, req.params.id]
    );
    await connection.commit();
    res.status(201).json({ data: { id: assignmentId, asset_uid: asset.asset_uid, portal_user_id: portalUserId, tercero_id: terceroId, rh_employee_id: rhEmployeeId } });
  } catch (error) {
    await connection.rollback().catch(() => {});
    next(error);
  } finally {
    connection.release();
  }
});

// Corrección administrativa recuperable: sólo oculta movimientos finalizados.
// La asignación vigente debe cerrarse primero mediante la operación canónica.
activosRouter.delete('/:id/asignaciones/:assignmentId', administratorOnly, async (req, res, next) => {
  const reason = String(req.body?.reason || '').trim();
  if (reason.length < 8 || reason.length > 1000) {
    return res.status(400).json({ error: 'Indica un motivo de 8 a 1000 caracteres' });
  }
  try {
    const [result] = await pool.query(
      `UPDATE activo_asignaciones aa
       JOIN activos a ON a.asset_uid = aa.asset_uid
          SET aa.archived_at = CURRENT_TIMESTAMP,
              aa.archived_by = ?, aa.archive_reason = ?
        WHERE a.id = ? AND aa.id = ?
          AND aa.unassigned_at IS NOT NULL AND aa.archived_at IS NULL`,
      [req.portalUser.id, reason, req.params.id, req.params.assignmentId]
    );
    if (!result.affectedRows) {
      const [[assignment]] = await pool.query(
        `SELECT aa.unassigned_at, aa.archived_at
           FROM activo_asignaciones aa JOIN activos a ON a.asset_uid = aa.asset_uid
          WHERE a.id = ? AND aa.id = ?`,
        [req.params.id, req.params.assignmentId]
      );
      if (!assignment) return res.status(404).json({ error: 'Movimiento de asignación no encontrado' });
      if (!assignment.unassigned_at) return res.status(409).json({ error: 'La asignación vigente debe cerrarse antes de retirarla del historial' });
      return res.status(409).json({ error: 'El movimiento ya fue retirado del historial' });
    }
    return res.json({ data: { id: req.params.assignmentId, archived: true } });
  } catch (error) {
    return next(error);
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
    await connection.query('UPDATE activos SET portal_user_id = NULL, tercero_id = NULL, rh_employee_id = NULL, usuario_asignado = NULL WHERE id = ?', [req.params.id]);
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

// Facturas, remisiones y demás PDF migrados desde ti-assets. La relación
// original era Documento.activo_id -> Activo.id en SQL Server; el espejo la
// conserva mediante center_code, la llave natural compartida con este módulo.
activosRouter.get('/:id/documentos', async (req, res, next) => {
  try {
    const actor = await fetchCurrentUser(req.headers.authorization);
    const [rows] = await pool.query(
      `SELECT d.id, d.sap_id, d.asset_uid, d.center_code, d.nombre, d.tipo, d.archivo,
              d.tamano, d.subido_por, d.sap_creado_en, d.mime_type, d.sha256, d.document_origin,
              d.uploaded_by_user_id, d.local_storage_path,
              CASE WHEN d.local_storage_path IS NULL THEN 0 ELSE 1 END AS archivo_disponible
         FROM activos a
         JOIN sap_documentos d ON d.asset_uid = a.asset_uid OR (d.asset_uid IS NULL AND d.center_code = a.center_code)
        WHERE a.id = ? AND d.archived_at IS NULL
        ORDER BY d.sap_creado_en DESC, d.id DESC`,
      [req.params.id]
    );
    res.json({ data: rows.map(({ uploaded_by_user_id: uploadedByUserId, local_storage_path: localStoragePath, ...row }) => ({
      ...row,
      archivo_disponible: Boolean(row.archivo_disponible),
      can_delete: canDeleteAssetDocument({ ...row, uploaded_by_user_id: uploadedByUserId, local_storage_path: localStoragePath }, actor),
    })) });
  } catch (error) {
    next(error);
  }
});

activosRouter.post('/:id/documentos', assetDocumentUpload.single('file'), async (req, res, next) => {
  let stored = null;
  try {
    if (!req.file) return res.status(400).json({ error: 'Selecciona un archivo' });
    const detected = detectAssetDocument(req.file.buffer);
    if (!detected) return res.status(400).json({ error: 'Formato no permitido. Usa PDF, JPG o PNG' });
    const [[asset]] = await pool.query('SELECT id, asset_uid, center_code FROM activos WHERE id = ?', [req.params.id]);
    if (!asset) return res.status(404).json({ error: 'Activo no encontrado' });

    const originalFilename = cleanOriginalFilename(req.file.originalname);
    const requestedName = String(req.body?.nombre || '').trim();
    const documentName = (requestedName || originalFilename.replace(/\.[^.]+$/, '') || 'Documento').slice(0, 255);
    const allowedTypes = new Set(['Remision', 'Factura', 'Garantia', 'Otro']);
    const documentType = allowedTypes.has(req.body?.tipo) ? req.body.tipo : 'Otro';
    const actor = await fetchCurrentUser(req.headers.authorization);
    stored = await storeAssetDocument(req.file.buffer, detected.extension);
    const [result] = await pool.query(
      `INSERT INTO sap_documentos
        (sap_id, asset_uid, center_code, nombre, tipo, archivo, tamano, subido_por,
         sap_creado_en, local_storage_path, mime_type, sha256, document_origin, uploaded_by_user_id)
       VALUES (NULL, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?, 'local', ?)`,
      [asset.asset_uid, asset.center_code, documentName, documentType, originalFilename,
        req.file.size, actor?.name || 'Usuario MRTI', stored.relativePath, detected.mimeType,
        stored.sha256, actor?.id || null]
    );
    const [[document]] = await pool.query(
      `SELECT id, sap_id, asset_uid, center_code, nombre, tipo, archivo, tamano, subido_por,
              sap_creado_en, mime_type, sha256, document_origin, 1 AS archivo_disponible
         FROM sap_documentos WHERE id = ?`,
      [result.insertId]
    );
    return res.status(201).json({ data: { ...document, archivo_disponible: true, can_delete: true } });
  } catch (error) {
    if (stored?.relativePath) await removeStoredAssetDocument(stored.relativePath).catch(() => {});
    return next(error);
  }
});

activosRouter.delete('/:id/documentos/:documentId', async (req, res, next) => {
  try {
    const actor = await fetchCurrentUser(req.headers.authorization);
    if (!actor) return res.status(401).json({ error: 'No autenticado' });
    const [[document]] = await pool.query(
      `SELECT d.id, d.document_origin, d.uploaded_by_user_id, d.local_storage_path
         FROM activos a
         JOIN sap_documentos d ON d.asset_uid = a.asset_uid OR (d.asset_uid IS NULL AND d.center_code = a.center_code)
        WHERE a.id = ? AND d.id = ? AND d.archived_at IS NULL
        LIMIT 1`,
      [req.params.id, req.params.documentId]
    );
    if (!document) return res.status(404).json({ error: 'Documento no encontrado' });
    if (!canDeleteAssetDocument(document, actor)) {
      if (document.document_origin !== 'local') {
        return res.status(403).json({ error: 'Sólo un administrador puede retirar documentos anteriores a la migración' });
      }
      return res.status(403).json({ error: 'Sólo puedes eliminar archivos que hayas subido' });
    }
    const [result] = await pool.query(
      'UPDATE sap_documentos SET archived_at = NOW(), archived_by = ? WHERE id = ? AND archived_at IS NULL',
      [actor.id, document.id]
    );
    if (!result.affectedRows) return res.status(409).json({ error: 'El documento ya fue eliminado' });
    return res.json({ data: { id: document.id, archived: true } });
  } catch (error) {
    return next(error);
  }
});

activosRouter.get('/:id/remission-credentials', administratorOnly, async (req, res, next) => {
  try {
    const [[asset]] = await pool.query('SELECT id, center_code FROM activos WHERE id = ?', [req.params.id]);
    if (!asset) return res.status(404).json({ error: 'Activo no encontrado' });
    const credentials = await fetchSapAssetCredentials(asset.center_code);
    await pool.query(`INSERT INTO audit_events
      (event_uuid, module_code, actor_user_id, actor_name, actor_email, action, entity_type, entity_id,
       request_id, ip_address, user_agent, metadata_json, status_code)
      VALUES (?, 'activos', ?, ?, ?, 'credential.remission_printed', 'activo', ?, ?, ?, ?, ?, 200)`, [
      randomUUID(), req.portalUser.id, req.portalUser.name, req.portalUser.email, String(asset.id),
      randomUUID(), req.ip || null, String(req.headers['user-agent'] || '').slice(0, 512) || null,
      JSON.stringify({ center_code: asset.center_code, secret_values: '[REDACTADO]' }),
    ]);
    res.set({ 'Cache-Control': 'no-store, private', Pragma: 'no-cache', Vary: 'Authorization' });
    return res.json({ data: credentials });
  } catch (error) {
    return next(error);
  }
});

activosRouter.get('/:id/remission-credential-status', administratorOnly, async (req, res, next) => {
  try {
    const [[asset]] = await pool.query('SELECT id, center_code FROM activos WHERE id = ?', [req.params.id]);
    if (!asset) return res.status(404).json({ error: 'Activo no encontrado' });
    const credentials = await fetchSapAssetCredentials(asset.center_code);
    const configured = Object.fromEntries(Object.entries(credentials).map(([key, value]) => [key, value !== null && value !== '']));
    res.set({ 'Cache-Control': 'no-store, private', Pragma: 'no-cache', Vary: 'Authorization' });
    return res.json({ data: configured });
  } catch (error) {
    return next(error);
  }
});

activosRouter.patch('/:id/remission-credentials', administratorOnly, async (req, res, next) => {
  try {
    const [[asset]] = await pool.query('SELECT id, center_code FROM activos WHERE id = ?', [req.params.id]);
    if (!asset) return res.status(404).json({ error: 'Activo no encontrado' });
    const result = await updateSapAssetCredentials(asset.center_code, req.body);
    await pool.query(`INSERT INTO audit_events
      (event_uuid, module_code, actor_user_id, actor_name, actor_email, action, entity_type, entity_id,
       request_id, ip_address, user_agent, metadata_json, status_code)
      VALUES (?, 'activos', ?, ?, ?, 'credential.remission_updated', 'activo', ?, ?, ?, ?, ?, 200)`, [
      randomUUID(), req.portalUser.id, req.portalUser.name, req.portalUser.email, String(asset.id),
      randomUUID(), req.ip || null, String(req.headers['user-agent'] || '').slice(0, 512) || null,
      JSON.stringify({ center_code: asset.center_code, changed_fields: result.changed_fields, secret_values: '[REDACTADO]' }),
    ]);
    res.set({ 'Cache-Control': 'no-store, private', Pragma: 'no-cache', Vary: 'Authorization' });
    return res.json({ data: result });
  } catch (error) {
    return next(error);
  }
});

activosRouter.get('/:id', async (req, res, next) => {
  try {
    const [[row]] = await pool.query('SELECT * FROM activos WHERE id = ?', [req.params.id]);
    if (!row) return res.status(404).json({ error: 'Activo no encontrado' });
    res.json({ data: normalizeAssetDates(row) });
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
    // Una alta local no puede escribir una unidad fuera del catálogo vigente
    // (mismo criterio que la corrección de un activo existente, ver
    // domain/unitReview.js: captureUnit). Queda protegida de inmediato para
    // que el primer ciclo de sincronización con SAP no la sobreescriba.
    if (Object.hasOwn(fields, 'unidad') && fields.unidad !== null) {
      fields.unidad = await captureUnit(pool, fields.unidad);
      fields.unit_is_manual = 1;
    }
    const columns = Object.keys(fields);
    const [result] = await pool.query(
      `INSERT INTO activos (asset_uid, ${columns.join(',')}) VALUES (?, ${columns.map(() => '?').join(',')})`,
      [randomUUID(), ...columns.map((c) => fields[c])]
    );
    const [[row]] = await pool.query('SELECT * FROM activos WHERE id = ?', [result.insertId]);
    syncToSapBestEffort(row.id);
    res.status(201).json({ data: normalizeAssetDates(row) });
  } catch (error) {
    next(error);
  }
});

activosRouter.patch('/:id', async (req, res, next) => {
  try {
    const fields = pickAllowedFields(req.body || {});
    const columns = Object.keys(fields);
    if (!columns.length) return res.status(400).json({ error: 'Nada que actualizar' });
    // Un cambio de unidad -- venga de la ficha general o de un formulario
    // anterior que todavía mande texto libre -- siempre pasa por
    // saveAssetFields: valida contra el catálogo, registra antes/después y
    // protege el valor de la próxima sincronización con SAP. Así el PATCH
    // general no puede eludir la validación de la ruta dedicada
    // (unit-review) ni escribir un nombre fuera del catálogo.
    if (Object.hasOwn(fields, 'unidad')) {
      const actor = await fetchCurrentUser(req.headers.authorization);
      if (!actor) return res.status(401).json({ error: 'No autenticado' });
      const result = await saveAssetFields(pool, req.params.id, fields, actor, {
        reason: req.body?.unit_review_reason,
        expectedRevision: req.body?.unit_revision !== undefined ? Number(req.body.unit_revision) : undefined,
      });
      syncToSapBestEffort(result.data.id);
      return res.json({ data: normalizeAssetDates(result.data) });
    }
    const [result] = await pool.query(
      `UPDATE activos SET ${columns.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`,
      [...columns.map((c) => fields[c]), req.params.id]
    );
    if (!result.affectedRows) return res.status(404).json({ error: 'Activo no encontrado' });
    const [[row]] = await pool.query('SELECT * FROM activos WHERE id = ?', [req.params.id]);
    syncToSapBestEffort(row.id);
    res.json({ data: normalizeAssetDates(row) });
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
