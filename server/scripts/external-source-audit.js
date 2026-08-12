import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import { externalSourceConfig, hasReadOnlyGrants } from '../src/externalSource.js';

dotenv.config({ path: process.env.EXTERNAL_ENV_FILE || '.env.external' });

const command = process.argv[2] || 'check';
if (!['check', 'catalog'].includes(command)) {
  throw new Error('Uso: external-source-audit.js <check|catalog>');
}

const config = externalSourceConfig();
const connection = await mysql.createConnection({
  ...config,
  namedPlaceholders: false,
  multipleStatements: false,
});

try {
  await connection.query('SET SESSION TRANSACTION READ ONLY');
  await connection.query('SET SESSION MAX_EXECUTION_TIME = 10000');

  const [[identity]] = await connection.query(
    'SELECT DATABASE() AS database_name, CURRENT_USER() AS database_user, VERSION() AS server_version'
  );
  const [grantRows] = await connection.query('SHOW GRANTS FOR CURRENT_USER');
  const grants = grantRows.flatMap((row) => Object.values(row).map(String));
  const readOnly = hasReadOnlyGrants(grants);

  const result = {
    status: readOnly ? 'ready' : 'unsafe-grants',
    database: identity.database_name,
    database_user: identity.database_user,
    server_version: identity.server_version,
    session_read_only: true,
    account_read_only: readOnly,
  };

  if (command === 'catalog') {
    const [tables] = await connection.execute(
      `SELECT TABLE_NAME AS table_name, TABLE_TYPE AS table_type,
              TABLE_ROWS AS estimated_rows
         FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = ?
        ORDER BY TABLE_NAME`,
      [config.database]
    );
    const [columns] = await connection.execute(
      `SELECT TABLE_NAME AS table_name, ORDINAL_POSITION AS position,
              COLUMN_NAME AS column_name, COLUMN_TYPE AS column_type,
              IS_NULLABLE AS is_nullable, COLUMN_KEY AS column_key
         FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = ?
        ORDER BY TABLE_NAME, ORDINAL_POSITION`,
      [config.database]
    );
    result.tables = tables;
    result.columns = columns;
  }

  console.log(JSON.stringify(result, null, 2));
  if (!readOnly) process.exitCode = 2;
} finally {
  await connection.end();
}
