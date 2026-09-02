// Vincula activos con su empleado real en RH usando el id_empleado y el
// nombre que ya trae cada activo (importados de SAP) -- sin exigir que ese
// empleado tenga todavía cuenta de Core (correo corporativo vinculado).
// Uso:
//   node scripts/reconcile-rh-employees.js            (solo reporte, no escribe nada)
//   node scripts/reconcile-rh-employees.js --apply    (aplica los confirmados)
//
// Nunca vincula solo por número: el número de empleado se cruza contra
// mrti_rh.employees.employee_number (sin ceros a la izquierda) y además el
// nombre debe coincidir (ver matchRhEmployees en ../src/reconciliation.js).
// Todo lo que no se pueda comprobar (número sin candidato, más de un
// candidato, nombre que no coincide, o usuario_asignado que ni siquiera
// parece nombre de persona -- "Dañada", nombres de laboratorio, etc.)
// queda listado para revisión manual, nunca se vincula a ciegas.
import 'dotenv/config';
import mysql from 'mysql2/promise';
import { matchRhEmployees } from '../src/reconciliation.js';

const apply = process.argv.includes('--apply');
const assetsDatabase = process.env.MYSQL_DATABASE || 'mrti_activos';
const rhDatabase = process.env.MRTI_RH_DATABASE || 'mrti_rh';
for (const name of [assetsDatabase, rhDatabase]) {
  if (!/^[a-zA-Z0-9_]+$/.test(name)) throw new Error(`Nombre de base inválido: ${name}`);
}

const connection = await mysql.createConnection({
  host: process.env.MYSQL_HOST || 'localhost',
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: assetsDatabase,
});

function fullName(row) {
  return [row.first_name, row.last_name_p, row.last_name_m].filter(Boolean).join(' ').trim();
}

try {
  const [assets] = await connection.query(
    `SELECT id, center_code, id_empleado, usuario_asignado
       FROM \`${assetsDatabase}\`.activos
      WHERE portal_user_id IS NULL AND tercero_id IS NULL AND rh_employee_id IS NULL
        AND id_empleado IS NOT NULL AND id_empleado != ''`
  );
  const [[{ sinIdEmpleado }]] = await connection.query(
    `SELECT COUNT(*) AS sinIdEmpleado FROM \`${assetsDatabase}\`.activos
      WHERE portal_user_id IS NULL AND tercero_id IS NULL AND rh_employee_id IS NULL
        AND (id_empleado IS NULL OR id_empleado = '')
        AND usuario_asignado IS NOT NULL AND usuario_asignado != ''`
  );
  const [employeeRows] = await connection.query(
    `SELECT id, employee_number, portal_user_id, first_name, last_name_p, last_name_m
       FROM \`${rhDatabase}\`.employees`
  );
  const employees = employeeRows.map((row) => ({ id: row.id, employee_number: row.employee_number, portal_user_id: row.portal_user_id, full_name: fullName(row) }));

  const results = matchRhEmployees(assets, employees);
  const byAssetId = new Map(assets.map((asset) => [asset.id, asset]));
  const counts = { matched: 0, name_mismatch: 0, not_found: 0, ambiguous: 0, no_id: 0 };
  const pendingReview = [];
  let viaCore = 0;
  let viaRhOnly = 0;

  if (apply) await connection.beginTransaction();

  for (const result of results) {
    counts[result.status] += 1;
    const asset = byAssetId.get(result.asset_id);

    if (result.status !== 'matched') {
      pendingReview.push({
        center_code: asset.center_code,
        id_empleado: asset.id_empleado,
        usuario_asignado: asset.usuario_asignado,
        motivo: result.status,
        candidato_rh: result.employee ? `${result.employee.full_name} (#${result.employee.employee_number})` : null,
      });
      continue;
    }

    const employee = result.employee;
    if (employee.portal_user_id) {
      viaCore += 1;
      if (apply) {
        await connection.query(
          `UPDATE \`${assetsDatabase}\`.activos SET portal_user_id = ?, usuario_asignado = ? WHERE id = ?`,
          [employee.portal_user_id, employee.full_name, asset.id]
        );
        await connection.query(
          `INSERT INTO \`${assetsDatabase}\`.activo_asignaciones (id, asset_uid, portal_user_id, notes)
           SELECT UUID(), asset_uid, ?, 'Conciliado por número de empleado y nombre (reconcile-rh-employees.js)'
             FROM \`${assetsDatabase}\`.activos WHERE id = ?`,
          [employee.portal_user_id, asset.id]
        );
      }
    } else {
      viaRhOnly += 1;
      if (apply) {
        await connection.query(
          `UPDATE \`${assetsDatabase}\`.activos SET rh_employee_id = ?, usuario_asignado = ? WHERE id = ?`,
          [employee.id, employee.full_name, asset.id]
        );
        await connection.query(
          `INSERT INTO \`${assetsDatabase}\`.activo_asignaciones (id, asset_uid, rh_employee_id, notes)
           SELECT UUID(), asset_uid, ?, 'Conciliado por número de empleado y nombre, sin cuenta de Core aún (reconcile-rh-employees.js)'
             FROM \`${assetsDatabase}\`.activos WHERE id = ?`,
          [employee.id, asset.id]
        );
      }
    }
  }

  if (apply) await connection.commit();

  console.log(JSON.stringify({
    modo: apply ? 'apply' : 'dry-run',
    total_con_id_empleado: assets.length,
    confirmados: counts.matched,
    confirmados_con_cuenta_core: viaCore,
    confirmados_solo_rh_employee_id: viaRhOnly,
    pendiente_nombre_no_coincide: counts.name_mismatch,
    pendiente_numero_sin_candidato: counts.not_found,
    pendiente_numero_ambiguo: counts.ambiguous,
    sin_id_empleado_no_revisados: sinIdEmpleado,
  }, null, 2));
  console.log('\n--- Pendientes de revisión manual ---');
  console.log(JSON.stringify(pendingReview, null, 2));
} catch (error) {
  if (apply) await connection.rollback().catch(() => {});
  throw error;
} finally {
  await connection.end();
}
