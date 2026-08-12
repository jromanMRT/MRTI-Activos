import 'dotenv/config';
import mysql from 'mysql2/promise';
import { matchObservedDevices } from '../src/reconciliation.js';

const apply = process.argv.includes('--apply');
const assetsDatabase = process.env.MYSQL_DATABASE || 'mrti_activos';
const obsDatabase = process.env.MRTI_OBS_DATABASE || 'mrti_infra';
for (const name of [assetsDatabase, obsDatabase]) {
  if (!/^[a-zA-Z0-9_]+$/.test(name)) throw new Error(`Nombre de base inválido: ${name}`);
}

const connection = await mysql.createConnection({
  host: process.env.MYSQL_HOST || 'localhost',
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: assetsDatabase,
});

try {
  const [assets] = await connection.query(
    `SELECT asset_uid, numero_serie, service_tag, cod_activo_fijo FROM \`${assetsDatabase}\`.activos`
  );
  const [devices] = await connection.query(
    `SELECT id, serial_number, inventory_tag, area_id, assigned_user_id, assigned_user
       FROM \`${obsDatabase}\`.devices WHERE asset_id IS NULL`
  );
  const results = matchObservedDevices(assets, devices);
  const counts = results.reduce((acc, item) => {
    acc[item.status] = (acc[item.status] || 0) + 1;
    return acc;
  }, { matched: 0, ambiguous: 0, unmatched: 0 });

  if (apply) {
    await connection.beginTransaction();
    for (const match of results.filter((item) => item.status === 'matched')) {
      const source = devices.find((device) => device.id === match.device_id);
      await connection.query(
        `UPDATE \`${obsDatabase}\`.devices SET asset_id = ? WHERE id = ? AND asset_id IS NULL`,
        [match.asset_id, match.device_id]
      );
      await connection.query(
        `UPDATE \`${assetsDatabase}\`.activos
            SET physical_area_id = COALESCE(physical_area_id, ?),
                portal_user_id = COALESCE(portal_user_id, ?),
                usuario_asignado = COALESCE(usuario_asignado, ?)
          WHERE asset_uid = ?`,
        [source.area_id, source.assigned_user_id, source.assigned_user, match.asset_id]
      );
      if (source.assigned_user_id) {
        await connection.query(
          `INSERT INTO \`${assetsDatabase}\`.activo_asignaciones
             (id, asset_uid, portal_user_id, notes)
           SELECT UUID(), ?, ?, 'Migrada desde MRTI-Obs hacia MRTI Activos'
            WHERE NOT EXISTS (
              SELECT 1 FROM \`${assetsDatabase}\`.activo_asignaciones
               WHERE asset_uid = ? AND unassigned_at IS NULL
            )`,
          [match.asset_id, source.assigned_user_id, match.asset_id]
        );
      }
    }
    await connection.commit();
  }

  console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', ...counts }));
  if (counts.ambiguous > 0) process.exitCode = 2;
} catch (error) {
  if (apply) await connection.rollback().catch(() => {});
  throw error;
} finally {
  await connection.end();
}
