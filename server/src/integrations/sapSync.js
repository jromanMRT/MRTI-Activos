import { randomUUID } from 'node:crypto';
import { pool } from '../db.js';
import {
  isSapConfigured, fetchSapAssets, pushAssetToSap,
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
  for (const row of rows) {
    const [[existing]] = await pool.query('SELECT id, sap_sync_error FROM activos WHERE center_code = ?', [row.center_code]);
    const columns = Object.keys(row).filter((key) => key !== 'center_code' && key !== 'sap_source_id');
    if (existing) {
      if (existing.sap_sync_error) { skipped += 1; continue; }
      const setClause = columns.map((column) => `${column} = ?`).join(', ');
      await pool.query(
        `UPDATE activos SET ${setClause}, sap_synced_at = NOW() WHERE id = ?`,
        [...columns.map((column) => row[column]), existing.id]
      );
      updated += 1;
    } else {
      const insertColumns = ['asset_uid', 'center_code', ...columns];
      await pool.query(
        `INSERT INTO activos (${insertColumns.join(',')}, sap_synced_at) VALUES (${insertColumns.map(() => '?').join(',')}, NOW())`,
        [randomUUID(), row.center_code, ...columns.map((column) => row[column])]
      );
      inserted += 1;
    }
  }
  return { inserted, updated, skipped, total: rows.length };
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

// Espejo genérico de solo lectura: upsert por `sap_id` (o la llave que se
// indique) en una tabla `sap_*`. `renameMap` cubre las pocas columnas que
// no se llaman igual en MySQL (creado_en -> sap_creado_en, etc.); el resto
// de `columns` se lee del renglón de SAP con el mismo nombre.
async function mirrorRows(table, rows, columns, { idColumn = 'sap_id', idSource = 'id', renameMap = {} } = {}) {
  for (const row of rows) {
    const values = { [idColumn]: row[idSource] };
    for (const column of columns) {
      const sourceKey = renameMap[column] || column;
      values[column] = row[sourceKey] === undefined ? null : row[sourceKey];
    }
    const allColumns = Object.keys(values);
    const updates = allColumns.filter((c) => c !== idColumn).map((c) => `${c} = VALUES(${c})`).join(', ');
    await pool.query(
      `INSERT INTO ${table} (${allColumns.join(',')}) VALUES (${allColumns.map(() => '?').join(',')})
       ON DUPLICATE KEY UPDATE ${updates}`,
      allColumns.map((c) => values[c])
    );
  }
}

const TIMESTAMP_RENAME = { sap_creado_en: 'creado_en', sap_actualizado_en: 'actualizado_en' };

// Los otros 11 dominios: sin escritura, sin UI todavía -- solo que el dato
// exista en MySQL. Cada uno es independiente; si uno falla (ej. SAP quitó
// una columna) no debe tumbar a los demás.
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
    ], { renameMap: TIMESTAMP_RENAME }],
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
    ], { renameMap: TIMESTAMP_RENAME }],
    ['sap_fortigate', fetchSapFortiGate, [
      'software', 'numero_serie', 'proyecto', 'fecha_expira', 'comentario', 'sap_creado_en', 'sap_actualizado_en',
    ], { renameMap: TIMESTAMP_RENAME }],
    ['sap_dominios', fetchSapDominios, [
      'dominio', 'servicios', 'fecha_expira', 'status', 'comentario', 'sap_creado_en', 'sap_actualizado_en',
    ], { renameMap: TIMESTAMP_RENAME }],
    ['sap_mantenimientos', fetchSapMantenimientos, [
      'center_code', 'fecha_servicio', 'fecha_fin', 'tipo_servicio', 'descripcion', 'tecnico', 'proveedor',
      'costo', 'numero_ticket', 'estado', 'garantia_hasta', 'observaciones', 'creado_por',
    ], {}],
    ['sap_mantenimiento_componentes', fetchSapMantenimientoComponentes, [
      'sap_mantenimiento_id', 'tipo_componente', 'descripcion', 'marca', 'modelo', 'numero_serie', 'accion', 'costo',
    ], { renameMap: { sap_mantenimiento_id: 'mantenimiento_id' } }],
    ['sap_unidades', fetchSapUnidades, ['nombre', 'activa', 'orden'], {}],
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
    const assets = await pullSapAssets();
    const mirrors = await syncSapMirrors();
    return { retry, assets, mirrors };
  })().finally(() => { runningSync = null; });
  return runningSync;
}
