import { randomUUID } from 'node:crypto';
import { access } from 'node:fs/promises';
import { Router } from 'express';
import { pool } from '../db.js';
import { administratorOnly } from '../auth.js';
import { decryptSecret } from '../integrations/credentialCrypto.js';
import { syncAllSap } from '../integrations/sapSync.js';
import { safeDocumentPath } from '../documentStorage.js';
import { normalizeAssetDates } from '../meta.js';

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
  componentes: { table: 'sap_componentes', columns: ['id', 'sap_id', 'center_code', 'code', 'nombre', 'tipo', 'marca', 'modelo', 'serial_service_tag', 'ip_address', 'hostname', 'unidad', 'departamento', 'usuario', 'comentario', 'synced_at', 'archived_at'], search: ['center_code', 'code', 'nombre', 'tipo', 'marca', 'modelo', 'serial_service_tag', 'usuario'] },
  impresoras: { table: 'sap_impresoras', columns: ['id', 'sap_id', 'usuario', 'ubicacion', 'ip_address', 'mac_address', 'hostname', 'modelo', 'numero_serie', 'conteo_paginas', 'comentario', 'synced_at', 'archived_at'], search: ['usuario', 'ubicacion', 'ip_address', 'hostname', 'modelo', 'numero_serie'] },
  nvr: { table: 'sap_nvr', columns: ['id', 'sap_id', 'alias', 'device_domain', 'device_serial', 'ip_port', 'status', 'usuario', 'acceso_local', 'localidad', 'ubicacion', 'synced_at', 'archived_at'], search: ['alias', 'device_domain', 'device_serial', 'ip_port', 'status', 'usuario', 'localidad', 'ubicacion'], secretColumns: ['password_encrypted', 'clave_cifrado_encrypted', 'codigo_verificacion_encrypted'] },
  passwords: { table: 'sap_passwords', columns: ['id', 'sap_id', 'categoria', 'subcategoria', 'ip', 'direccion', 'usuario', 'comentario', 'synced_at', 'archived_at'], search: ['categoria', 'subcategoria', 'ip', 'direccion', 'usuario', 'comentario'], secretColumns: ['password_encrypted'] },
  starlink: { table: 'sap_starlink', columns: ['id', 'sap_id', 'correo_cuenta', 'ubicacion', 'id_starlink', 'version_equipo', 'importe_mes', 'dia_corte', 'suscripcion', 'cliente', 'comentario', 'synced_at', 'archived_at'], search: ['correo_cuenta', 'ubicacion', 'id_starlink', 'version_equipo', 'suscripcion', 'cliente'] },
  fortigate: { table: 'sap_fortigate', columns: ['id', 'sap_id', 'software', 'numero_serie', 'proyecto', 'fecha_expira', 'comentario', 'synced_at', 'archived_at'], search: ['software', 'numero_serie', 'proyecto', 'comentario'] },
  dominios: { table: 'sap_dominios', columns: ['id', 'sap_id', 'dominio', 'servicios', 'fecha_expira', 'status', 'comentario', 'synced_at', 'archived_at'], search: ['dominio', 'servicios', 'status', 'comentario'] },
  mantenimientos: { table: 'sap_mantenimientos', columns: ['id', 'sap_id', 'center_code', 'fecha_servicio', 'fecha_fin', 'tipo_servicio', 'descripcion', 'tecnico', 'proveedor', 'costo', 'numero_ticket', 'estado', 'garantia_hasta', 'observaciones', 'synced_at', 'archived_at'], search: ['center_code', 'tipo_servicio', 'descripcion', 'tecnico', 'proveedor', 'numero_ticket', 'estado'] },
  unidades: { table: 'sap_unidades', columns: ['id', 'sap_id', 'nombre', 'activa', 'orden', 'synced_at', 'archived_at'], search: ['nombre'] },
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
