import sql from 'mssql';
import { encryptSecret } from './credentialCrypto.js';

// Conexión al SQL Server de SAP (ActivosTI) -- a diferencia de
// MRTI-RH/server/src/contpaq/db.js (solo lectura, CONTPAQi sigue siendo
// dueño de sus datos), aquí SÍ se escribe: MRTI-Activos y SAP comparten la
// propiedad de `Activos` en vivo (ver plan de esta integración). Mismo
// patrón de pool perezoso + degradar con 503 si no está configurado.
//
// Variables esperadas en server/.env: SAP_DB_HOST, SAP_DB_PORT, SAP_DB_NAME,
// SAP_DB_USER, SAP_DB_PASSWORD.

function isConfigured() {
  return Boolean(process.env.SAP_DB_HOST && process.env.SAP_DB_NAME && process.env.SAP_DB_USER && process.env.SAP_DB_PASSWORD);
}

let poolPromise = null;

async function getPool() {
  if (!isConfigured()) {
    const error = new Error('La conexión a SAP no está configurada (faltan variables SAP_DB_* en el .env)');
    error.status = 503;
    throw error;
  }
  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool({
      server: process.env.SAP_DB_HOST,
      port: Number(process.env.SAP_DB_PORT || 1433),
      database: process.env.SAP_DB_NAME,
      user: process.env.SAP_DB_USER,
      password: process.env.SAP_DB_PASSWORD,
      options: { encrypt: true, trustServerCertificate: true },
      connectionTimeout: 8000,
      requestTimeout: 20000,
    }).connect();
    poolPromise.catch(() => { poolPromise = null; });
  }
  return poolPromise;
}

export { isConfigured as isSapConfigured };

// ── Activos: en vivo, lectura y escritura ──────────────────────────────

// Vista_Activos_Completa ya devuelve exactamente los mismos nombres de
// columna que usa `activos` en MySQL (confirmado en vivo) -- no hace falta
// traducir nombres, solo excluir lo que nunca debe cruzar: las 4 columnas
// de password que expone la vista, y las que administra MySQL localmente.
const ASSET_EXCLUDED_FIELDS = new Set([
  'id', 'win_password', 'ms_password', 'password_mrt', 'password_corporativo',
  'creado_en', 'actualizado_en',
]);

// Columnas que solo existen en `activos` de MySQL (nunca en dbo.Activos de
// SAP) -- se filtran al empujar un renglón de MySQL hacia SAP, así se le
// puede pasar el row completo tal cual sale de `SELECT * FROM activos` sin
// armar un objeto a mano en cada llamador.
const MYSQL_ONLY_FIELDS = new Set([
  'id', 'asset_uid', 'portal_user_id', 'tercero_id', 'physical_area_id',
  'creado_en', 'actualizado_en', 'sap_synced_at', 'sap_sync_error',
]);

export async function fetchSapAssets() {
  const pool = await getPool();
  const { recordset } = await pool.request().query('SELECT * FROM dbo.Vista_Activos_Completa');
  return recordset.map((row) => {
    const clean = { sap_source_id: row.id };
    for (const [key, value] of Object.entries(row)) {
      if (!ASSET_EXCLUDED_FIELDS.has(key)) clean[key] = value;
    }
    return clean;
  });
}

// Cada tabla de credenciales de SAP guarda un subconjunto de columnas de
// `activos` bajo otro nombre (ver server/src/meta.js para el lado MySQL).
// Nunca se incluye una columna de password en ningún mapa: esas nunca se
// escriben desde MRTI-Activos.
const CUENTA_WINDOWS_MAP = { cuenta: 'win_cuenta', usuario: 'win_usuario', comentario: 'win_comentario' };
const CUENTA_MICROSOFT_MAP = {
  cuenta: 'ms_cuenta', usuario: 'ms_usuario', licencia: 'ms_licencia', suscripcion: 'ms_suscripcion',
  fecha_suscripcion: 'fecha_suscripcion', anos_suscripcion: 'anos_suscripcion',
};
const CUENTA_DROPBOX_MAP = { cuenta: 'db_cuenta', usuario: 'db_usuario', licencia: 'db_licencia' };
const CUENTA_CORREO_MAP = {
  correo_mrt: 'correo_mrt', correo_corporativo: 'correo_corporativo', nombre_empleado: 'correo_nombre',
  departamento: 'correo_depto', puesto: 'correo_puesto', migrado: 'migrado', baja: 'correo_baja',
};
const ANTIVIRUS_MAP = { licencia: 'av_licencia', fecha_caducidad: 'av_caducidad', ds_team: 'av_team', comentario: 'av_comentario' };

// Borra e inserta si hay algo que guardar -- mismo patrón que ya usa
// ti-assets/backend/server.js (insertarCredenciales) para estas 5 tablas,
// así el resultado se ve igual sin importar cuál de las dos apps escribió.
async function upsertCredentialTable(transaction, table, activoId, columnMap, fields) {
  const entries = Object.entries(columnMap)
    .filter(([, localKey]) => fields[localKey] !== undefined)
    .map(([sapColumn, localKey]) => [sapColumn, fields[localKey]]);
  const hasData = entries.some(([, value]) => value !== null && value !== '');

  await new sql.Request(transaction).input('activo_id', sql.Int, activoId).query(`DELETE FROM ${table} WHERE activo_id = @activo_id`);
  if (!hasData) return;

  const request = new sql.Request(transaction);
  request.input('activo_id', sql.Int, activoId);
  const columns = ['activo_id'];
  const params = ['@activo_id'];
  entries.forEach(([column, value], index) => {
    const paramName = `p${index}`;
    columns.push(column);
    params.push(`@${paramName}`);
    request.input(paramName, value);
  });
  await request.query(`INSERT INTO ${table} (${columns.join(',')}) VALUES (${params.join(',')})`);
}

// Upsert por center_code (llave natural compartida con MySQL) contra
// dbo.Activos + las 5 tablas de credenciales relacionadas, en una sola
// transacción. Nunca toca columnas de password.
export async function pushAssetToSap(fields) {
  if (!fields.center_code) throw new Error('center_code es obligatorio para sincronizar con SAP');
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  try {
    const columns = Object.keys(fields).filter((key) => !ASSET_EXCLUDED_FIELDS.has(key) && !MYSQL_ONLY_FIELDS.has(key) && key !== 'center_code');
    const request = new sql.Request(transaction);
    request.input('center_code', sql.NVarChar, fields.center_code);
    for (const column of columns) request.input(column, fields[column] ?? null);
    const setClause = columns.map((column) => `${column} = @${column}`).join(', ');
    const insertColumns = ['center_code', ...columns];
    const insertParams = insertColumns.map((column) => `@${column}`);
    const { recordset } = await request.query(`
      MERGE dbo.Activos AS target
      USING (SELECT @center_code AS center_code) AS src
        ON target.center_code = src.center_code
      WHEN MATCHED THEN UPDATE SET ${setClause}
      WHEN NOT MATCHED THEN INSERT (${insertColumns.join(',')}) VALUES (${insertParams.join(',')})
      OUTPUT inserted.id;
    `);
    const activoId = recordset[0].id;

    await upsertCredentialTable(transaction, 'dbo.CuentaWindows', activoId, CUENTA_WINDOWS_MAP, fields);
    await upsertCredentialTable(transaction, 'dbo.CuentaMicrosoft', activoId, CUENTA_MICROSOFT_MAP, fields);
    await upsertCredentialTable(transaction, 'dbo.CuentaDropBox', activoId, CUENTA_DROPBOX_MAP, fields);
    await upsertCredentialTable(transaction, 'dbo.CuentaCorreo', activoId, CUENTA_CORREO_MAP, fields);
    await upsertCredentialTable(transaction, 'dbo.Antivirus', activoId, ANTIVIRUS_MAP, fields);

    await transaction.commit();
    return { sapId: activoId };
  } catch (error) {
    await transaction.rollback().catch(() => {});
    throw error;
  }
}

// ── Los otros 11 dominios: solo lectura, para el espejo sap_* ──────────
// Sin UI todavía (ver plan) -- estas funciones solo alimentan sapSync.js.
// Componentes/Mantenimientos/Documentos resuelven center_code en la misma
// consulta para no tener que cargar los ids internos de SAP en MySQL.

export async function fetchSapComponentes() {
  const pool = await getPool();
  const { recordset } = await pool.request().query(
    'SELECT c.*, a.center_code FROM dbo.Componentes c LEFT JOIN dbo.Activos a ON a.id = c.activo_id'
  );
  return recordset;
}

export async function fetchSapImpresoras() {
  const pool = await getPool();
  const { recordset } = await pool.request().query('SELECT * FROM dbo.Impresoras');
  return recordset;
}

export async function fetchSapNvr() {
  const pool = await getPool();
  const { recordset } = await pool.request().query('SELECT * FROM dbo.NVR');
  return recordset.map(({ password, clave_cifrado, codigo_verificacion, ...rest }) => ({
    ...rest,
    password_encrypted: encryptSecret(password),
    clave_cifrado_encrypted: encryptSecret(clave_cifrado),
    codigo_verificacion_encrypted: encryptSecret(codigo_verificacion),
  }));
}

export async function fetchSapPasswords() {
  const pool = await getPool();
  const { recordset } = await pool.request().query('SELECT * FROM dbo.Passwords');
  return recordset.map(({ password, ...rest }) => ({ ...rest, password_encrypted: encryptSecret(password) }));
}

export async function fetchSapStarlink() {
  const pool = await getPool();
  const { recordset } = await pool.request().query('SELECT * FROM dbo.Starlink');
  return recordset;
}

export async function fetchSapFortiGate() {
  const pool = await getPool();
  const { recordset } = await pool.request().query('SELECT * FROM dbo.FortiGate');
  return recordset;
}

export async function fetchSapDominios() {
  const pool = await getPool();
  const { recordset } = await pool.request().query('SELECT * FROM dbo.Dominios');
  return recordset;
}

export async function fetchSapMantenimientos() {
  const pool = await getPool();
  const { recordset } = await pool.request().query(
    'SELECT m.*, a.center_code FROM dbo.Mantenimientos m LEFT JOIN dbo.Activos a ON a.id = m.activo_id'
  );
  return recordset;
}

export async function fetchSapMantenimientoComponentes() {
  const pool = await getPool();
  const { recordset } = await pool.request().query('SELECT * FROM dbo.MantenimientoComponentes');
  return recordset;
}

export async function fetchSapUnidades() {
  const pool = await getPool();
  const { recordset } = await pool.request().query('SELECT * FROM dbo.Unidades');
  return recordset;
}

export async function fetchSapConfigAlertas() {
  const pool = await getPool();
  const { recordset } = await pool.request().query('SELECT * FROM dbo.ConfigAlertas');
  return recordset;
}

// Solo metadatos -- el archivo PDF en sí no se trae (ver plan: sin acceso
// de Windows al recurso compartido de SAP todavía).
export async function fetchSapDocumentos() {
  const pool = await getPool();
  const { recordset } = await pool.request().query(
    'SELECT d.*, a.center_code FROM dbo.Documentos d LEFT JOIN dbo.Activos a ON a.id = d.activo_id'
  );
  return recordset;
}
