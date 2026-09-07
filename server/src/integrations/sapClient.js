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

// Lista positiva tomada del esquema real de dbo.Activos. Las cuentas,
// licencias y antivirus viven en sus tablas relacionadas y se escriben más
// abajo mediante mapas explícitos; no deben colarse en el MERGE principal.
const SAP_ASSET_WRITABLE_FIELDS = new Set([
  'cod_activo_fijo', 'tipo', 'descripcion', 'software_incluido', 'version',
  'marca', 'modelo', 'service_tag', 'numero_serie', 'empresa', 'id_empleado',
  'usuario_asignado', 'unidad', 'area', 'cel_empleado', 'cuenta_contable',
  'expediente', 'requisicion', 'orden_compra', 'factura', 'cuenta_microsoft',
  'esp_tec', 'active', 'estado', 'bitlocker', 'baja_empleado', 'baja_equipo',
  'revisada', 'ex_propietario', 'fecha_compra', 'valid_from', 'valid_to', 'notas',
]);

export function pickSapAssetWritableFields(fields = {}) {
  return Object.fromEntries(Object.entries(fields).filter(([key]) => SAP_ASSET_WRITABLE_FIELDS.has(key)));
}

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

export function pickSapAssetCredentials(row = {}) {
  return {
    win_password: row.win_password ?? null,
    ms_password: row.ms_password ?? null,
    password_mrt: row.password_mrt ?? null,
    password_corporativo: row.password_corporativo ?? null,
    db_password: row.db_password ?? null,
  };
}

// Lectura puntual para una remisión interna. Los secretos nunca pasan por el
// GET normal del activo ni se guardan en MySQL: se consultan en vivo, mediante
// parámetro, y la ruta que llama esta función exige administrador y audita el
// acceso. Si el código está duplicado es preferible no imprimir una contraseña
// potencialmente ajena.
export async function fetchSapAssetCredentials(centerCode) {
  const pool = await getPool();
  const { recordset } = await pool.request()
    .input('center_code', sql.NVarChar(20), centerCode)
    .query(`SELECT v.id, v.win_password, v.ms_password, v.password_mrt, v.password_corporativo,
        (SELECT TOP (1) db.password FROM dbo.CuentaDropBox db
          WHERE db.activo_id = v.id ORDER BY db.id DESC) AS db_password
      FROM dbo.Vista_Activos_Completa v WHERE v.center_code = @center_code`);
  if (!recordset.length) {
    const error = new Error('El activo no existe en la fuente de credenciales');
    error.status = 404;
    throw error;
  }
  if (recordset.length > 1) {
    const error = new Error('El código TI está duplicado en la fuente; no es seguro revelar sus credenciales');
    error.status = 409;
    throw error;
  }
  return pickSapAssetCredentials(recordset[0]);
}

const REMISSION_CREDENTIAL_TARGETS = Object.freeze({
  win_password: ['dbo.CuentaWindows', 'password'],
  ms_password: ['dbo.CuentaMicrosoft', 'password'],
  db_password: ['dbo.CuentaDropBox', 'password'],
  password_mrt: ['dbo.CuentaCorreo', 'password_mrt'],
  password_corporativo: ['dbo.CuentaCorreo', 'password_corporativo'],
});

export function normalizeSapAssetCredentialChanges(body = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    const error = new Error('Las credenciales deben enviarse como un objeto');
    error.status = 400;
    throw error;
  }
  const unknown = Object.keys(body).filter((key) => !Object.hasOwn(REMISSION_CREDENTIAL_TARGETS, key));
  if (unknown.length) {
    const error = new Error(`Campos de credenciales no permitidos: ${unknown.join(', ')}`);
    error.status = 400;
    throw error;
  }
  const changes = {};
  for (const key of Object.keys(REMISSION_CREDENTIAL_TARGETS)) {
    if (!Object.hasOwn(body, key)) continue;
    const value = body[key];
    if (value !== null && typeof value !== 'string') {
      const error = new Error(`${key} debe ser texto o null`);
      error.status = 400;
      throw error;
    }
    if (typeof value === 'string' && value.length > 255) {
      const error = new Error(`${key} no puede exceder 255 caracteres`);
      error.status = 400;
      throw error;
    }
    changes[key] = value === '' ? null : value;
  }
  if (!Object.keys(changes).length) {
    const error = new Error('Indica al menos una credencial para guardar o quitar');
    error.status = 400;
    throw error;
  }
  return changes;
}

// Escritura puntual de los secretos usados en la remisión. ActivosTI sigue
// siendo la única fuente de verdad; la respuesta sólo enumera qué campos se
// modificaron y jamás devuelve sus valores.
export async function updateSapAssetCredentials(centerCode, body) {
  const changes = normalizeSapAssetCredentialChanges(body);
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  try {
    const lookup = await new sql.Request(transaction)
      .input('center_code', sql.NVarChar(20), centerCode)
      .query('SELECT id FROM dbo.Activos WITH (UPDLOCK, HOLDLOCK) WHERE center_code = @center_code');
    if (!lookup.recordset.length) {
      const error = new Error('El activo no existe en la fuente de credenciales');
      error.status = 404;
      throw error;
    }
    if (lookup.recordset.length > 1) {
      const error = new Error('El código TI está duplicado en la fuente; no es seguro modificar sus credenciales');
      error.status = 409;
      throw error;
    }
    const activoId = lookup.recordset[0].id;
    const grouped = new Map();
    for (const [key, value] of Object.entries(changes)) {
      const [table, column] = REMISSION_CREDENTIAL_TARGETS[key];
      if (!grouped.has(table)) grouped.set(table, []);
      grouped.get(table).push([column, value]);
    }
    for (const [table, entries] of grouped) {
      const request = new sql.Request(transaction).input('activo_id', sql.Int, activoId);
      entries.forEach(([, value], index) => request.input(`secret${index}`, sql.NVarChar(255), value));
      const exists = await new sql.Request(transaction)
        .input('activo_id', sql.Int, activoId)
        .query(`SELECT TOP (1) id FROM ${table} WITH (UPDLOCK, HOLDLOCK) WHERE activo_id = @activo_id`);
      if (exists.recordset.length) {
        await request.query(`UPDATE ${table} SET ${entries.map(([column], index) => `${column} = @secret${index}`).join(', ')} WHERE activo_id = @activo_id`);
      } else {
        await request.query(`INSERT INTO ${table} (activo_id, ${entries.map(([column]) => column).join(', ')}) VALUES (@activo_id, ${entries.map((_, index) => `@secret${index}`).join(', ')})`);
      }
    }
    await transaction.commit();
    return { changed_fields: Object.keys(changes) };
  } catch (error) {
    await transaction.rollback().catch(() => {});
    throw error;
  }
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

// Actualiza únicamente los datos no secretos. No se borra el renglón porque
// contiene también las contraseñas administradas por la ruta protegida de
// remisión; una edición normal del activo debe conservarlas.
async function upsertCredentialTable(transaction, table, activoId, columnMap, fields) {
  const entries = Object.entries(columnMap)
    .filter(([, localKey]) => fields[localKey] !== undefined)
    .map(([sapColumn, localKey]) => [sapColumn, fields[localKey]]);
  const hasData = entries.some(([, value]) => value !== null && value !== '');

  const request = new sql.Request(transaction);
  request.input('activo_id', sql.Int, activoId);
  entries.forEach(([column, value], index) => {
    request.input(`p${index}`, value);
  });
  const exists = await new sql.Request(transaction)
    .input('activo_id', sql.Int, activoId)
    .query(`SELECT TOP (1) id FROM ${table} WITH (UPDLOCK, HOLDLOCK) WHERE activo_id = @activo_id`);
  if (exists.recordset.length) {
    if (entries.length) {
      await request.query(`UPDATE ${table} SET ${entries.map(([column], index) => `${column} = @p${index}`).join(', ')} WHERE activo_id = @activo_id`);
    }
    return;
  }
  if (!hasData) return;
  await request.query(`INSERT INTO ${table} (activo_id, ${entries.map(([column]) => column).join(', ')}) VALUES (@activo_id, ${entries.map((_, index) => `@p${index}`).join(', ')})`);
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
    const mainFields = pickSapAssetWritableFields(fields);
    const columns = Object.keys(mainFields);
    const request = new sql.Request(transaction);
    request.input('center_code', sql.NVarChar, fields.center_code);
    for (const column of columns) request.input(column, mainFields[column] ?? null);
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
