import { randomUUID } from 'node:crypto';
import { pool } from '../db.js';
import {
  isSapConfigured, fetchSapAssets, pushAssetToSap,
  pushFortiGateToSap, pushDominiosToSap, pushUnidadesToSap, pushImpresorasToSap, pushStarlinkToSap,
  fetchSapComponentes, fetchSapImpresoras, fetchSapNvr, fetchSapPasswords,
  fetchSapStarlink, fetchSapFortiGate, fetchSapDominios, fetchSapMantenimientos,
  fetchSapMantenimientoComponentes, fetchSapUnidades, fetchSapConfigAlertas, fetchSapDocumentos,
} from './sapClient.js';

// Reintenta empujar hacia SAP cualquier activo cuyo último push haya
// fallado (ver activos.js: se guarda en sap_sync_error en vez de tumbar la
// petición). Mientras un renglón tenga error pendiente, pullSapAssets() no
// lo sobreescribe -- así no se pierde el cambio local que aún no llegó.
export async function retrySapPushes() {
  const [rows] = await pool.query('SELECT * FROM activos WHERE sap_sync_error IS NOT NULL');
  let fixed = 0;
  let stillFailing = 0;
  for (const row of rows) {
    try {
      await pushAssetToSap(row);
      await pool.query('UPDATE activos SET sap_synced_at = NOW(), sap_sync_error = NULL WHERE id = ?', [row.id]);
      fixed += 1;
    } catch (error) {
      await pool.query('UPDATE activos SET sap_sync_error = ? WHERE id = ?', [String(error.message).slice(0, 255), row.id]);
      stillFailing += 1;
    }
  }
  return { fixed, stillFailing, attempted: rows.length };
}

// Mismo patrón que retrySapPushes(), generalizado para los catálogos sap_*
// de una sola tabla con escritura de vuelta (ver pushCatalogRowToSap en
// sapClient.js). Guarda el sap_id que devuelva SAP la primera vez que una
// alta local logra empujarse.
async function retryCatalogPushes(table, pushFn) {
  const [rows] = await pool.query(`SELECT * FROM \`${table}\` WHERE sap_sync_error IS NOT NULL`);
  let fixed = 0;
  let stillFailing = 0;
  for (const row of rows) {
    try {
      const { sapId } = await pushFn(row);
      await pool.query(`UPDATE \`${table}\` SET sap_id = COALESCE(sap_id, ?), sap_synced_at = NOW(), sap_sync_error = NULL WHERE id = ?`, [sapId, row.id]);
      fixed += 1;
    } catch (error) {
      await pool.query(`UPDATE \`${table}\` SET sap_sync_error = ? WHERE id = ?`, [String(error.message).slice(0, 255), row.id]);
      stillFailing += 1;
    }
  }
  return { fixed, stillFailing, attempted: rows.length };
}

const CATALOG_PUSH_JOBS = [
  ['sap_fortigate', pushFortiGateToSap],
  ['sap_dominios', pushDominiosToSap],
  ['sap_unidades', pushUnidadesToSap],
  ['sap_impresoras', pushImpresorasToSap],
  ['sap_starlink', pushStarlinkToSap],
];

export async function retryCatalogSapPushes() {
  const results = {};
  for (const [table, pushFn] of CATALOG_PUSH_JOBS) {
    results[table] = await retryCatalogPushes(table, pushFn);
  }
  return results;
}

// Un activo con unit_is_manual=1 tiene una corrección de unidad hecha a mano
// (ver domain/unitReview.js: saveAssetFields la marca así en cuanto cambia
// `unidad`). Mientras esté protegido, SAP no puede pisarla -- se omite esa
// sola columna del UPDATE. Si SAP cambia la unidad de un activo *no*
// protegido, se incrementa unit_revision para invalidar cualquier
// expectedRevision que un administrador tuviera abierto en pantalla (evita
// una corrección perdida por una condición de carrera con el sync).
export function planUnitSync(existing, incomingRow) {
  if (!Object.hasOwn(incomingRow, 'unidad')) return { skipUnit: false, bumpRevision: false };
  if (existing.unit_is_manual) return { skipUnit: true, bumpRevision: false };
  const changed = String(incomingRow.unidad ?? '') !== String(existing.unidad ?? '');
  return { skipUnit: false, bumpRevision: changed };
}

// Trae Vista_Activos_Completa y hace upsert por center_code (llave natural
// compartida). Preserva asset_uid y todo lo que ya tenga enlazado
// (asignaciones, mantenimientos, physical_area_id) -- esas columnas nunca
// se tocan aquí, solo las que vienen de SAP.
export async function pullSapAssets() {
  const rows = await fetchSapAssets();
  await preserveSapAssetDuplicates(rows);
  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  let unitProtected = 0;
  for (const row of rows) {
    const [[existing]] = await pool.query(
      'SELECT id, sap_sync_error, unit_is_manual, unidad FROM activos WHERE center_code = ?',
      [row.center_code]
    );
    if (existing) {
      if (existing.sap_sync_error) { skipped += 1; continue; }
      const plan = planUnitSync(existing, row);
      const columns = Object.keys(row)
        .filter((key) => key !== 'center_code' && key !== 'sap_source_id')
        .filter((key) => !(plan.skipUnit && key === 'unidad'));
      const setClauses = columns.map((column) => `${column} = ?`);
      if (plan.bumpRevision) setClauses.push('unit_revision = unit_revision + 1');
      await pool.query(
        `UPDATE activos SET ${setClauses.join(', ')}, sap_synced_at = NOW() WHERE id = ?`,
        [...columns.map((column) => row[column]), existing.id]
      );
      if (plan.skipUnit) unitProtected += 1;
      if (plan.bumpRevision) {
        await pool.query(`INSERT INTO audit_events
          (event_uuid, module_code, actor_name, action, entity_type, entity_id, request_id, before_json, after_json, metadata_json, status_code)
          VALUES (?, 'activos', 'sap-sync', 'asset-unit.sap-updated', 'asset-unit', ?, ?, ?, ?, ?, 200)`,
          [randomUUID(), String(existing.id), randomUUID(),
            JSON.stringify({ unidad: existing.unidad }), JSON.stringify({ unidad: row.unidad }),
            JSON.stringify({ center_code: row.center_code })]);
      }
      updated += 1;
    } else {
      const columns = Object.keys(row).filter((key) => key !== 'center_code' && key !== 'sap_source_id');
      const insertColumns = ['asset_uid', 'center_code', ...columns];
      await pool.query(
        `INSERT INTO activos (${insertColumns.join(',')}, sap_synced_at) VALUES (${insertColumns.map(() => '?').join(',')}, NOW())`,
        [randomUUID(), row.center_code, ...columns.map((column) => row[column])]
      );
      inserted += 1;
    }
  }
  return { inserted, updated, skipped, unitProtected, total: rows.length };
}

export async function preserveSapAssetDuplicates(rows) {
  const grouped = new Map();
  for (const row of rows) {
    const key = row.center_code;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(row);
  }
  const duplicates = [...grouped.entries()].filter(([, matches]) => matches.length > 1);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query('UPDATE sap_asset_duplicates SET resolved_at = COALESCE(resolved_at, NOW()) WHERE resolved_at IS NULL');
    for (const [centerCode, matches] of duplicates) {
      const sourceIds = matches.map((row) => row.sap_source_id);
      const snapshots = matches.map(({ sap_source_id, ...fields }) => ({ source_id: sap_source_id, ...fields }));
      await connection.query(`INSERT INTO sap_asset_duplicates
        (center_code, source_ids_json, snapshot_json, detected_at, last_seen_at, resolved_at)
        VALUES (?, ?, ?, NOW(), NOW(), NULL)
        ON DUPLICATE KEY UPDATE source_ids_json=VALUES(source_ids_json), snapshot_json=VALUES(snapshot_json),
          last_seen_at=NOW(), resolved_at=NULL`, [centerCode, JSON.stringify(sourceIds), JSON.stringify(snapshots)]);
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally { connection.release(); }
  return { total: duplicates.length };
}

// Espejo genérico de SAP: upsert únicamente por `sap_id` (o la llave que se
// indique) en una tabla `sap_*`. Las altas propias de MRTI usan sap_id NULL,
// por lo que nunca coinciden ni son reemplazadas por este proceso.
// `renameMap` cubre las pocas columnas que no se llaman igual en MySQL.
async function mirrorRows(table, rows, columns, { idColumn = 'sap_id', idSource = 'id', renameMap = {}, generateUid = null, protectColumn = null } = {}) {
  for (const row of rows) {
    const values = { [idColumn]: row[idSource] };
    for (const column of columns) {
      const sourceKey = renameMap[column] || column;
      values[column] = row[sourceKey] === undefined ? null : row[sourceKey];
    }
    // Sólo se usa en la alta -- en un UPDATE nunca entra a `updates`, así se
    // conserva el UUID ya asignado la primera vez.
    if (generateUid) values[generateUid] = randomUUID();
    const allColumns = Object.keys(values);
    const updates = allColumns
      .filter((c) => c !== idColumn && c !== generateUid)
      .map((c) => (protectColumn ? `${c} = IF(${protectColumn} IS NULL, VALUES(${c}), ${c})` : `${c} = VALUES(${c})`))
      .join(', ');
    await pool.query(
      `INSERT INTO ${table} (${allColumns.join(',')}) VALUES (${allColumns.map(() => '?').join(',')})
       ON DUPLICATE KEY UPDATE ${updates}`,
      allColumns.map((c) => values[c])
    );
  }
}

const TIMESTAMP_RENAME = { sap_creado_en: 'creado_en', sap_actualizado_en: 'actualizado_en' };

// Cada catálogo se actualiza de manera independiente; si uno falla (por
// ejemplo, SAP quitó una columna) no debe tumbar a los demás ni afectar las
// filas locales identificadas por sap_id NULL.
export async function syncSapMirrors() {
  const jobs = [
    ['sap_componentes', fetchSapComponentes, [
      'center_code', 'code', 'nombre', 'tipo', 'marca', 'modelo', 'serial_service_tag', 'firmware',
      'ip_address', 'mac_address', 'hostname', 'unidad', 'departamento', 'usuario', 'contabilidad',
      'orden_compra', 'comentario', 'sap_creado_en', 'sap_actualizado_en',
    ], { renameMap: TIMESTAMP_RENAME }],
    ['sap_impresoras', fetchSapImpresoras, [
      'usuario', 'ubicacion', 'ip_address', 'mac_address', 'hostname', 'modelo', 'numero_serie',
      'conteo_paginas', 'comentario', 'sap_creado_en', 'sap_actualizado_en',
    ], { renameMap: TIMESTAMP_RENAME, protectColumn: 'locally_edited_at' }],
    ['sap_nvr', fetchSapNvr, [
      'alias', 'device_domain', 'device_serial', 'ip_port', 'status', 'clave_cifrado_encrypted', 'codigo_verificacion_encrypted',
      'usuario', 'password_encrypted', 'acceso_local', 'localidad', 'ubicacion', 'sap_creado_en', 'sap_actualizado_en',
    ], { renameMap: TIMESTAMP_RENAME }],
    ['sap_passwords', fetchSapPasswords, [
      'categoria', 'subcategoria', 'ip', 'direccion', 'usuario', 'password_encrypted', 'comentario',
      'sap_creado_en', 'sap_actualizado_en',
    ], { renameMap: TIMESTAMP_RENAME }],
    ['sap_starlink', fetchSapStarlink, [
      'correo_cuenta', 'ubicacion', 'id_starlink', 'version_equipo', 'importe_mes', 'dia_corte',
      'suscripcion', 'cliente', 'comentario', 'sap_creado_en', 'sap_actualizado_en',
    ], { renameMap: TIMESTAMP_RENAME, protectColumn: 'locally_edited_at' }],
    ['sap_fortigate', fetchSapFortiGate, [
      'software', 'numero_serie', 'proyecto', 'fecha_expira', 'comentario', 'sap_creado_en', 'sap_actualizado_en',
    ], { renameMap: TIMESTAMP_RENAME, generateUid: 'asset_uid', protectColumn: 'locally_edited_at' }],
    ['sap_dominios', fetchSapDominios, [
      'dominio', 'servicios', 'fecha_expira', 'status', 'comentario', 'sap_creado_en', 'sap_actualizado_en',
    ], { renameMap: TIMESTAMP_RENAME, protectColumn: 'locally_edited_at' }],
    ['sap_mantenimientos', fetchSapMantenimientos, [
      'center_code', 'fecha_servicio', 'fecha_fin', 'tipo_servicio', 'descripcion', 'tecnico', 'proveedor',
      'costo', 'numero_ticket', 'estado', 'garantia_hasta', 'observaciones', 'creado_por',
    ], {}],
    ['sap_mantenimiento_componentes', fetchSapMantenimientoComponentes, [
      'sap_mantenimiento_id', 'tipo_componente', 'descripcion', 'marca', 'modelo', 'numero_serie', 'accion', 'costo',
    ], { renameMap: { sap_mantenimiento_id: 'mantenimiento_id' } }],
    ['sap_unidades', fetchSapUnidades, ['nombre', 'activa', 'orden'], { protectColumn: 'locally_edited_at' }],
    ['sap_documentos', fetchSapDocumentos, [
      'center_code', 'nombre', 'tipo', 'archivo', 'tamano', 'subido_por', 'sap_creado_en',
    ], { renameMap: { sap_creado_en: 'creado_en' } }],
  ];

  const results = {};
  for (const [table, fetchFn, columns, options] of jobs) {
    try {
      const rows = await fetchFn();
      await mirrorRows(table, rows, columns, options);
      results[table] = { ok: true, count: rows.length };
    } catch (error) {
      results[table] = { ok: false, error: error.message };
    }
  }

  // Instalaciones que recibieron la primera versión del espejo pudieron
  // crear estas dos columnas en texto plano. Una vez cifrado el valor nuevo,
  // se eliminan los datos legados para que una copia de MySQL no los revele.
  try {
    const [legacyColumns] = await pool.query(`SELECT column_name AS columnName FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = 'sap_nvr'
        AND column_name IN ('clave_cifrado', 'codigo_verificacion')`);
    for (const { columnName: column } of legacyColumns) {
      await pool.query(`UPDATE sap_nvr SET \`${column}\` = NULL WHERE \`${column}\` IS NOT NULL`);
    }
  } catch (error) {
    results.sap_nvr_legacy_cleanup = { ok: false, error: error.message };
  }

  // ConfigAlertas no tiene id propio en SAP -- su llave natural es `clave`.
  try {
    const rows = await fetchSapConfigAlertas();
    for (const row of rows) {
      await pool.query(
        `INSERT INTO sap_config_alertas (clave, nombre, dias_aviso, activo, sap_actualizado_en)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE nombre = VALUES(nombre), dias_aviso = VALUES(dias_aviso),
           activo = VALUES(activo), sap_actualizado_en = VALUES(sap_actualizado_en)`,
        [row.clave, row.nombre, row.dias_aviso, row.activo ? 1 : 0, row.actualizado_en]
      );
    }
    results.sap_config_alertas = { ok: true, count: rows.length };
  } catch (error) {
    results.sap_config_alertas = { ok: false, error: error.message };
  }

  return results;
}

let runningSync = null;

export function syncAllSap() {
  if (runningSync) return runningSync;
  if (!isSapConfigured()) return Promise.resolve({ skipped: true, reason: 'SAP_DB_* no configurado' });
  runningSync = (async () => {
    const retry = await retrySapPushes();
    const retryCatalogs = await retryCatalogSapPushes();
    const assets = await pullSapAssets();
    const mirrors = await syncSapMirrors();
    return { retry, retryCatalogs, assets, mirrors };
  })().finally(() => { runningSync = null; });
  return runningSync;
}
