import { randomUUID } from 'node:crypto';
import { access } from 'node:fs/promises';
import { Router } from 'express';
import { pool } from '../db.js';
import { administratorOnly } from '../auth.js';
import { decryptSecret, encryptSecret } from '../integrations/credentialCrypto.js';
import { syncAllSap } from '../integrations/sapSync.js';
import { safeDocumentPath } from '../documentStorage.js';
import { normalizeAssetDates } from '../meta.js';
import { readUnitInventory } from '../unitInventory.js';
import { unitReviewRouter } from './unitReview.js';
import { reviewReason, unitUsage } from '../domain/unitReview.js';

export { safeDocumentPath } from '../documentStorage.js';

export const INCOMPLETE_ASSET_FIELDS = Object.freeze([
  'marca', 'modelo', 'service_tag', 'numero_serie', 'usuario_asignado', 'unidad', 'fecha_compra', 'empresa',
]);

export function findIncompleteAssetFields(asset) {
  return INCOMPLETE_ASSET_FIELDS.filter((field) => {
    const value = asset?.[field];
    return value === null || value === undefined || (typeof value === 'string' && value.trim() === '');
  });
}

export const RESOURCE_CONFIG = Object.freeze({
  credenciales: {
    table: 'activos', id: 'id', archivable: false, syncColumn: 'sap_synced_at',
    columns: ['id', 'center_code', 'usuario_asignado', 'win_cuenta', 'win_usuario', 'ms_cuenta', 'ms_usuario', 'ms_licencia', 'ms_suscripcion', 'db_cuenta', 'db_usuario', 'db_licencia', 'correo_mrt', 'correo_corporativo', 'av_licencia', 'av_caducidad'],
    search: ['center_code', 'usuario_asignado', 'win_usuario', 'ms_usuario', 'correo_mrt', 'correo_corporativo'],
  },
  componentes: { table: 'sap_componentes', columns: ['id', 'sap_id', 'center_code', 'code', 'nombre', 'tipo', 'marca', 'modelo', 'serial_service_tag', 'ip_address', 'hostname', 'unidad', 'departamento', 'usuario', 'comentario', 'record_origin', 'synced_at', 'archived_at'], search: ['center_code', 'code', 'nombre', 'tipo', 'marca', 'modelo', 'serial_service_tag', 'usuario'], create: { fields: ['center_code', 'code', 'nombre', 'tipo', 'marca', 'modelo', 'serial_service_tag', 'firmware', 'ip_address', 'mac_address', 'hostname', 'unidad', 'departamento', 'usuario', 'contabilidad', 'orden_compra', 'comentario'], required: ['nombre'] } },
  impresoras: { table: 'sap_impresoras', columns: ['id', 'sap_id', 'usuario', 'ubicacion', 'ip_address', 'mac_address', 'hostname', 'modelo', 'numero_serie', 'conteo_paginas', 'comentario', 'record_origin', 'synced_at', 'archived_at'], search: ['usuario', 'ubicacion', 'ip_address', 'hostname', 'modelo', 'numero_serie'], create: { fields: ['usuario', 'ubicacion', 'ip_address', 'mac_address', 'hostname', 'modelo', 'numero_serie', 'conteo_paginas', 'comentario'], required: ['modelo'], numbers: ['conteo_paginas'] } },
  nvr: { table: 'sap_nvr', columns: ['id', 'sap_id', 'alias', 'device_domain', 'device_serial', 'ip_port', 'status', 'usuario', 'acceso_local', 'localidad', 'ubicacion', 'record_origin', 'synced_at', 'archived_at'], search: ['alias', 'device_domain', 'device_serial', 'ip_port', 'status', 'usuario', 'localidad', 'ubicacion'], secretColumns: ['password_encrypted', 'clave_cifrado_encrypted', 'codigo_verificacion_encrypted'], create: { fields: ['alias', 'device_domain', 'device_serial', 'ip_port', 'status', 'usuario', 'acceso_local', 'localidad', 'ubicacion'], required: ['alias'], secrets: { password: 'password_encrypted', clave_cifrado: 'clave_cifrado_encrypted', codigo_verificacion: 'codigo_verificacion_encrypted' } } },
  passwords: { table: 'sap_passwords', columns: ['id', 'sap_id', 'categoria', 'subcategoria', 'ip', 'direccion', 'usuario', 'comentario', 'record_origin', 'synced_at', 'archived_at'], search: ['categoria', 'subcategoria', 'ip', 'direccion', 'usuario', 'comentario'], secretColumns: ['password_encrypted'], create: { fields: ['categoria', 'subcategoria', 'ip', 'direccion', 'usuario', 'comentario'], required: ['categoria', 'password'], secrets: { password: 'password_encrypted' } } },
  starlink: { table: 'sap_starlink', columns: ['id', 'sap_id', 'correo_cuenta', 'ubicacion', 'id_starlink', 'version_equipo', 'importe_mes', 'dia_corte', 'suscripcion', 'cliente', 'comentario', 'record_origin', 'synced_at', 'archived_at'], search: ['correo_cuenta', 'ubicacion', 'id_starlink', 'version_equipo', 'suscripcion', 'cliente'], create: { fields: ['correo_cuenta', 'ubicacion', 'id_starlink', 'version_equipo', 'importe_mes', 'dia_corte', 'suscripcion', 'cliente', 'comentario'], required: ['id_starlink'], numbers: ['importe_mes'] } },
  fortigate: {
    table: 'sap_fortigate', editable: true,
    columns: ['id', 'sap_id', 'asset_uid', 'software', 'numero_serie', 'proyecto', 'fecha_expira', 'ip_address', 'comentario', 'record_origin', 'synced_at', 'archived_at', 'locally_edited_at'],
    search: ['software', 'numero_serie', 'proyecto', 'comentario'],
    create: { fields: ['software', 'numero_serie', 'proyecto', 'fecha_expira', 'ip_address', 'comentario'], required: ['numero_serie'], dates: ['fecha_expira'] },
  },
  dominios: { table: 'sap_dominios', columns: ['id', 'sap_id', 'dominio', 'servicios', 'fecha_expira', 'status', 'comentario', 'record_origin', 'synced_at', 'archived_at'], search: ['dominio', 'servicios', 'status', 'comentario'], create: { fields: ['dominio', 'servicios', 'fecha_expira', 'status', 'comentario'], required: ['dominio'], dates: ['fecha_expira'] } },
  mantenimientos: { table: 'sap_mantenimientos', columns: ['id', 'sap_id', 'center_code', 'fecha_servicio', 'fecha_fin', 'tipo_servicio', 'descripcion', 'tecnico', 'proveedor', 'costo', 'numero_ticket', 'estado', 'garantia_hasta', 'observaciones', 'record_origin', 'synced_at', 'archived_at'], search: ['center_code', 'tipo_servicio', 'descripcion', 'tecnico', 'proveedor', 'numero_ticket', 'estado'], create: { fields: ['center_code', 'fecha_servicio', 'fecha_fin', 'tipo_servicio', 'descripcion', 'tecnico', 'proveedor', 'costo', 'numero_ticket', 'estado', 'garantia_hasta', 'observaciones'], required: ['center_code', 'fecha_servicio', 'tipo_servicio'], numbers: ['costo'], dates: ['fecha_servicio', 'fecha_fin', 'garantia_hasta'] } },
  unidades: { table: 'sap_unidades', columns: ['id', 'sap_id', 'nombre', 'activa', 'orden', 'record_origin', 'synced_at', 'archived_at', 'usage_kind', 'reference_id', 'review_note', 'reviewed_by', 'reviewed_at', 'review_revision'], search: ['nombre'], create: { fields: ['nombre', 'activa', 'orden'], required: ['nombre'], numbers: ['orden'], booleans: ['activa'] } },
  documentos: { table: 'sap_documentos', columns: ['id', 'sap_id', 'asset_uid', 'center_code', 'nombre', 'tipo', 'archivo', 'tamano', 'subido_por', 'sap_creado_en', 'synced_at', 'archived_at', 'local_storage_path', 'mime_type', 'sha256', 'document_origin'], search: ['center_code', 'nombre', 'tipo', 'archivo', 'subido_por'] },
  'config-alertas': { table: 'sap_config_alertas', id: 'clave', archivable: false, columns: ['clave', 'nombre', 'dias_aviso', 'activo', 'sap_actualizado_en', 'synced_at'], search: ['clave', 'nombre'] },
});

function resourceOrThrow(name) {
  const config = RESOURCE_CONFIG[name];
  if (!config) { const error = new Error('Catálogo no reconocido'); error.status = 404; throw error; }
  return { id: 'id', archivable: true, ...config };
}

export function resolveResourceSort(config, sort, order) {
  const idColumn = config.id || 'id';
  const column = config.columns.includes(sort) ? sort : idColumn;
  const direction = String(order).toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  return `\`${column}\` ${direction}`;
}

function searchableWhere(config, query) {
  const clauses = [];
  const values = [];
  if (config.archivable) clauses.push(query.includeArchived === '1' ? '1=1' : 'archived_at IS NULL');
  if (query.q && config.search.length) {
    clauses.push(`CONCAT_WS(' ', ${config.search.map((column) => `COALESCE(\`${column}\`, '')`).join(', ')}) LIKE ?`);
    values.push(`%${String(query.q).slice(0, 120)}%`);
  }
  return { sql: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', values };
}

export function normalizeResourceCreateInput(config, body = {}) {
  if (!config.create) { const error = new Error('Este catálogo no admite altas directas'); error.status = 405; throw error; }
  const create = config.create;
  const values = {};
  for (const field of create.fields) {
    if (!Object.prototype.hasOwnProperty.call(body, field)) continue;
    const raw = body[field];
    if (raw === '' || raw === null || raw === undefined) { values[field] = null; continue; }
    if (create.numbers?.includes(field)) {
      const number = Number(raw);
      if (!Number.isFinite(number)) { const error = new Error(`${field} debe ser numérico`); error.status = 400; throw error; }
      values[field] = number;
    } else if (create.booleans?.includes(field)) {
      values[field] = raw === true || raw === 1 || raw === '1' ? 1 : 0;
    } else if (create.dates?.includes(field)) {
      const value = String(raw).slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) { const error = new Error(`${field} debe tener formato AAAA-MM-DD`); error.status = 400; throw error; }
      values[field] = value;
    } else {
      values[field] = String(raw).trim() || null;
    }
  }
  const secretValues = {};
  for (const [input, column] of Object.entries(create.secrets || {})) {
    const value = body[input] === null || body[input] === undefined ? '' : String(body[input]);
    if (value) secretValues[column] = value;
  }
  const missing = (create.required || []).filter((field) => {
    if (Object.prototype.hasOwnProperty.call(create.secrets || {}, field)) return !secretValues[create.secrets[field]];
    return values[field] === null || values[field] === undefined || values[field] === '';
  });
  if (missing.length) { const error = new Error(`Faltan campos obligatorios: ${missing.join(', ')}`); error.status = 400; throw error; }
  return { values, secretValues };
}

async function auditSecretRead(req) {
  await pool.query(`INSERT INTO audit_events
    (event_uuid, module_code, actor_user_id, actor_name, actor_email, action, entity_type, entity_id, request_id, ip_address, user_agent, metadata_json, status_code)
    VALUES (?, 'activos', ?, ?, ?, 'credential.viewed', ?, ?, ?, ?, ?, ?, 200)`, [
    randomUUID(), req.portalUser.id, req.portalUser.name, req.portalUser.email,
    req.params.resource, String(req.params.id), randomUUID(), req.ip || null,
    String(req.headers['user-agent'] || '').slice(0, 512) || null,
    JSON.stringify({ resource: req.params.resource, id: String(req.params.id), secret_values: '[REDACTADO]' }),
  ]);
}

export const assetSuiteRouter = Router();

assetSuiteRouter.use('/unit-review', unitReviewRouter);

assetSuiteRouter.get('/summary', async (_req, res, next) => {
  try {
    const entries = await Promise.all(Object.entries(RESOURCE_CONFIG).map(async ([name, config]) => {
      const archiveFilter = config.archivable === false ? '' : ' WHERE archived_at IS NULL';
      const syncColumn = config.syncColumn || 'synced_at';
      const [[row]] = await pool.query(`SELECT COUNT(*) AS total, MAX(\`${syncColumn}\`) AS synced_at FROM \`${config.table}\`${archiveFilter}`);
      return [name, row];
    }));
    res.json({ data: Object.fromEntries(entries) });
  } catch (error) { next(error); }
});

assetSuiteRouter.get('/unit-inventory', async (_req, res, next) => {
  try { res.json({ data: await readUnitInventory(pool) }); }
  catch (error) { next(error); }
});

assetSuiteRouter.get('/dashboard', async (_req, res, next) => {
  try {
    const [inventoryResult, typeResult, unitResult, recentAssetsResult, recentDocumentsResult] = await Promise.all([
      pool.query(`SELECT COUNT(*) AS total,
        SUM(estado = 'Activo') AS activos,
        SUM(estado = 'En mantenimiento') AS mantenimiento,
        SUM(estado = 'Inactivo') AS inactivos,
        SUM(estado = 'Baja') AS bajas,
        SUM(estado = 'Activo' AND (portal_user_id IS NOT NULL OR rh_employee_id IS NOT NULL OR tercero_id IS NOT NULL)) AS asignados,
        SUM(estado = 'Activo' AND portal_user_id IS NULL AND rh_employee_id IS NULL AND tercero_id IS NULL) AS sin_asignar,
        SUM(estado = 'Activo' AND EXISTS (
          SELECT 1 FROM sap_documentos d WHERE d.archived_at IS NULL
            AND (d.asset_uid = activos.asset_uid OR (d.asset_uid IS NULL AND d.center_code = activos.center_code))
        )) AS con_documentos
        FROM activos`),
      pool.query(`SELECT COALESCE(NULLIF(tipo, ''), 'Sin tipo') AS label, COUNT(*) AS total
        FROM activos WHERE estado = 'Activo' GROUP BY label ORDER BY total DESC, label LIMIT 8`),
      pool.query(`SELECT COALESCE(NULLIF(unidad, ''), 'Sin unidad') AS label, COUNT(*) AS total
        FROM activos WHERE estado = 'Activo' GROUP BY label ORDER BY total DESC, label LIMIT 8`),
      pool.query(`SELECT id, center_code, tipo, marca, modelo, estado, usuario_asignado, actualizado_en
        FROM activos ORDER BY actualizado_en DESC, id DESC LIMIT 6`),
      pool.query(`SELECT d.id, d.asset_uid, d.center_code, d.nombre, d.tipo, d.archivo, d.subido_por,
          d.sap_creado_en, d.document_origin, a.id AS asset_id
        FROM sap_documentos d
        LEFT JOIN activos a ON a.asset_uid = d.asset_uid OR (d.asset_uid IS NULL AND a.center_code = d.center_code)
        WHERE d.archived_at IS NULL ORDER BY COALESCE(d.sap_creado_en, d.synced_at) DESC, d.id DESC LIMIT 6`),
    ]);
    const inventory = inventoryResult[0][0];
    res.json({ data: {
      inventory: Object.fromEntries(Object.entries(inventory).map(([key, value]) => [key, Number(value || 0)])),
      by_type: typeResult[0].map((row) => ({ ...row, total: Number(row.total) })),
      by_unit: unitResult[0].map((row) => ({ ...row, total: Number(row.total) })),
      recent_assets: recentAssetsResult[0],
      recent_documents: recentDocumentsResult[0],
    } });
  } catch (error) { next(error); }
});

assetSuiteRouter.get('/alerts', async (_req, res, next) => {
  try {
    const [missingResult, missingDetailResult, fortigateResult, antivirusResult, officeResult, perpetualResult, incompleteResult, duplicateResult] = await Promise.all([
      pool.query(`SELECT COUNT(*) AS total FROM activos a WHERE a.estado = 'Activo' AND NOT EXISTS (
        SELECT 1 FROM sap_documentos d WHERE d.archived_at IS NULL
          AND (d.asset_uid = a.asset_uid OR (d.asset_uid IS NULL AND d.center_code = a.center_code))
      )`),
      pool.query(`SELECT a.id, a.center_code, a.tipo, a.marca, a.modelo, a.usuario_asignado, a.unidad
        FROM activos a WHERE a.estado = 'Activo' AND NOT EXISTS (
          SELECT 1 FROM sap_documentos d WHERE d.archived_at IS NULL
            AND (d.asset_uid = a.asset_uid OR (d.asset_uid IS NULL AND d.center_code = a.center_code))
        ) ORDER BY a.center_code LIMIT 500`),
      pool.query(`SELECT id, software, numero_serie, proyecto, fecha_expira FROM sap_fortigate WHERE archived_at IS NULL AND fecha_expira IS NOT NULL AND fecha_expira <= DATE_ADD(CURDATE(), INTERVAL 90 DAY) ORDER BY fecha_expira`),
      pool.query(`SELECT id, center_code, usuario_asignado, av_licencia, av_caducidad, DATE_ADD(av_caducidad, INTERVAL 1 YEAR) AS fecha_vence FROM activos WHERE estado = 'Activo' AND av_caducidad IS NOT NULL AND DATE_ADD(av_caducidad, INTERVAL 1 YEAR) <= DATE_ADD(CURDATE(), INTERVAL 90 DAY) ORDER BY fecha_vence`),
      pool.query(`SELECT id, center_code, usuario_asignado, ms_cuenta, ms_usuario, ms_licencia, fecha_suscripcion, anos_suscripcion, DATE_ADD(fecha_suscripcion, INTERVAL COALESCE(anos_suscripcion, 1) YEAR) AS fecha_vence FROM activos WHERE estado = 'Activo' AND fecha_suscripcion IS NOT NULL AND COALESCE(anos_suscripcion, 1) > 0 AND DATE_ADD(fecha_suscripcion, INTERVAL COALESCE(anos_suscripcion, 1) YEAR) <= DATE_ADD(CURDATE(), INTERVAL 90 DAY) ORDER BY fecha_vence`),
      pool.query(`SELECT id, center_code, usuario_asignado, ms_cuenta, ms_usuario, ms_licencia FROM activos WHERE estado = 'Activo' AND anos_suscripcion = 0 ORDER BY center_code`),
      pool.query(`SELECT id, center_code, tipo, marca, modelo, service_tag, numero_serie, usuario_asignado, unidad, fecha_compra, empresa FROM activos WHERE estado = 'Activo' AND (marca IS NULL OR marca = '' OR modelo IS NULL OR modelo = '' OR service_tag IS NULL OR service_tag = '' OR numero_serie IS NULL OR numero_serie = '' OR usuario_asignado IS NULL OR usuario_asignado = '' OR unidad IS NULL OR unidad = '' OR fecha_compra IS NULL OR empresa IS NULL OR empresa = '') ORDER BY center_code LIMIT 300`),
      pool.query(`SELECT center_code, source_ids_json, detected_at, last_seen_at FROM sap_asset_duplicates WHERE resolved_at IS NULL ORDER BY center_code`),
    ]);
    const missingDocuments = missingResult[0][0];
    const duplicates = duplicateResult[0].map((row) => ({ ...row, source_ids: JSON.parse(row.source_ids_json || '[]').join(', ') }));
    const incompleteAssets = incompleteResult[0].map((row) => {
      const normalized = normalizeAssetDates(row);
      return { ...normalized, missing_fields: findIncompleteAssetFields(normalized) };
    });
    res.json({ data: { sin_documentos: Number(missingDocuments.total || 0), sin_documentos_detalle: missingDetailResult[0], fortigate: fortigateResult[0], antivirus: antivirusResult[0], office365: officeResult[0], perpetuas: perpetualResult[0], incompletos: incompleteAssets, duplicados: duplicates } });
  } catch (error) { next(error); }
});

assetSuiteRouter.get('/resources/:resource', async (req, res, next) => {
  try {
    const config = resourceOrThrow(req.params.resource);
    const { sql, values } = searchableWhere(config, req.query);
    const limit = Math.min(Math.max(Number(req.query.limit) || 300, 1), 1000);
    const idColumn = config.id;
    const orderSql = resolveResourceSort(config, req.query.sort, req.query.order);
    const [rows] = await pool.query(`SELECT ${config.columns.map((column) => `\`${column}\``).join(', ')} FROM \`${config.table}\` ${sql} ORDER BY ${orderSql}, \`${idColumn}\` DESC LIMIT ?`, [...values, limit]);
    res.json({ data: rows, meta: { resource: req.params.resource, limit, sort: orderSql } });
  } catch (error) { next(error); }
});

assetSuiteRouter.post('/resources/:resource', administratorOnly, async (req, res, next) => {
  try {
    const config = resourceOrThrow(req.params.resource);
    const { values, secretValues } = normalizeResourceCreateInput(config, req.body || {});
    const storedSecrets = Object.fromEntries(Object.entries(secretValues).map(([column, value]) => [column, encryptSecret(value)]));
    const record = { ...values, ...storedSecrets, record_origin: 'local', created_by_user_id: req.portalUser.id };
    if (config.table === 'sap_fortigate') record.asset_uid = randomUUID();
    const columns = Object.keys(record);
    const [result] = await pool.query(
      `INSERT INTO \`${config.table}\` (${columns.map((column) => `\`${column}\``).join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
      columns.map((column) => record[column])
    );
    const [rows] = await pool.query(`SELECT ${config.columns.map((column) => `\`${column}\``).join(', ')} FROM \`${config.table}\` WHERE \`${config.id}\` = ? LIMIT 1`, [result.insertId]);
    res.status(201).json({ data: rows[0] });
  } catch (error) { next(error); }
});

assetSuiteRouter.get('/resources/:resource/:id/secret', administratorOnly, async (req, res, next) => {
  try {
    const config = resourceOrThrow(req.params.resource);
    if (!config.secretColumns) return res.status(404).json({ error: 'Este catálogo no contiene credenciales revelables' });
    const [rows] = await pool.query(`SELECT ${config.secretColumns.map((column) => `\`${column}\``).join(', ')} FROM \`${config.table}\` WHERE \`${config.id}\` = ? LIMIT 1`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Registro no encontrado' });
    const data = {};
    for (const column of config.secretColumns) data[column.replace(/_encrypted$/, '')] = decryptSecret(rows[0][column]);
    await auditSecretRead(req);
    res.set('Cache-Control', 'no-store');
    res.json({ data });
  } catch (error) { next(error); }
});

assetSuiteRouter.patch('/resources/:resource/:id/archive', administratorOnly, async (req, res, next) => {
  try {
    const config = resourceOrThrow(req.params.resource);
    if (!config.archivable) return res.status(409).json({ error: 'Este catálogo no se archiva desde aquí' });
    if (req.params.resource === 'unidades') {
      // El archivo de una unidad exige evidencia de obsolescencia, no sólo
      // ausencia de equipos, y nunca procede si activos o sap_componentes
      // todavía la referencian (UNIT_REVIEW_PLAN.md, etapa 6).
      const [[row]] = await pool.query('SELECT nombre FROM sap_unidades WHERE id = ?', [req.params.id]);
      if (!row) return res.status(404).json({ error: 'Registro no encontrado' });
      const usage = await unitUsage(pool, row.nombre);
      if (usage.assets > 0 || usage.components > 0) {
        return res.status(409).json({ error: `No se puede archivar: ${usage.assets} activo(s) y ${usage.components} componente(s) todavía usan "${row.nombre}".` });
      }
      const note = reviewReason(req.body?.review_note);
      await pool.query('UPDATE sap_unidades SET review_note = ?, reviewed_by = ?, reviewed_at = NOW() WHERE id = ?', [note, req.portalUser.id, req.params.id]);
    }
    const [result] = await pool.query(`UPDATE \`${config.table}\` SET archived_at = NOW(), archived_by = ? WHERE \`${config.id}\` = ?`, [req.portalUser.id, req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ error: 'Registro no encontrado' });
    res.json({ data: { id: req.params.id, archived: true } });
  } catch (error) { next(error); }
});

assetSuiteRouter.patch('/resources/:resource/:id/restore', administratorOnly, async (req, res, next) => {
  try {
    const config = resourceOrThrow(req.params.resource);
    if (!config.archivable) return res.status(409).json({ error: 'Este catálogo no se archiva desde aquí' });
    const [result] = await pool.query(`UPDATE \`${config.table}\` SET archived_at = NULL, archived_by = NULL WHERE \`${config.id}\` = ?`, [req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ error: 'Registro no encontrado' });
    res.json({ data: { id: req.params.id, archived: false } });
  } catch (error) { next(error); }
});

// Edición manual, incluidos los campos que vienen de SAP. Sólo catálogos con
// `config.editable` la admiten (hoy: sólo fortigate). Marca
// locally_edited_at/_by para que mirrorRows() (sapSync.js) deje de pisar
// este renglón en la siguiente sincronización, y asegura que tenga
// asset_uid (siempre lo tiene desde la migración 014, esto es defensivo).
assetSuiteRouter.patch('/resources/:resource/:id', administratorOnly, async (req, res, next) => {
  try {
    const config = resourceOrThrow(req.params.resource);
    if (!config.editable) return res.status(405).json({ error: 'Este catálogo no admite edición manual' });
    const { values } = normalizeResourceCreateInput(config, req.body || {});
    if (!Object.keys(values).length) return res.status(400).json({ error: 'No se recibió ningún campo para actualizar' });
    const [[existing]] = await pool.query(`SELECT \`${config.id}\` AS id, asset_uid FROM \`${config.table}\` WHERE \`${config.id}\` = ?`, [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Registro no encontrado' });
    const assetUid = existing.asset_uid || randomUUID();
    const columns = Object.keys(values);
    const setClauses = [...columns.map((column) => `\`${column}\` = ?`), 'locally_edited_at = NOW()', 'locally_edited_by = ?', 'asset_uid = ?'];
    await pool.query(
      `UPDATE \`${config.table}\` SET ${setClauses.join(', ')} WHERE \`${config.id}\` = ?`,
      [...columns.map((column) => values[column]), req.portalUser.id, assetUid, req.params.id]
    );
    const [rows] = await pool.query(`SELECT ${config.columns.map((column) => `\`${column}\``).join(', ')} FROM \`${config.table}\` WHERE \`${config.id}\` = ? LIMIT 1`, [req.params.id]);
    res.json({ data: rows[0] });
  } catch (error) { next(error); }
});

assetSuiteRouter.post('/sync', administratorOnly, async (_req, res, next) => {
  try { res.json({ data: await syncAllSap() }); } catch (error) { next(error); }
});

assetSuiteRouter.get('/documents/:id/download', async (req, res, next) => {
  try {
    const [[document]] = await pool.query('SELECT nombre, archivo, local_storage_path FROM sap_documentos WHERE id = ? AND archived_at IS NULL', [req.params.id]);
    if (!document) return res.status(404).json({ error: 'Documento no encontrado' });
    const filePath = safeDocumentPath(document.local_storage_path);
    if (!filePath) return res.status(404).json({ error: 'El archivo todavía no está almacenado localmente' });
    await access(filePath);
    res.download(filePath, document.archivo || `${document.nombre || 'documento'}.pdf`);
  } catch (error) { if (error.code === 'ENOENT') error.status = 404; next(error); }
});
