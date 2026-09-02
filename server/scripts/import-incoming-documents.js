// Copia idempotente de los PDF del antiguo _incoming-activos al almacén
// privado del módulo oficial. No elimina ni modifica el origen.
import 'dotenv/config';
import path from 'node:path';
import { chmod, copyFile, mkdir, stat } from 'node:fs/promises';
import mysql from 'mysql2/promise';

const sourceRoot = path.resolve(process.env.INCOMING_ACTIVOS_UPLOAD_DIR || '/var/www/mrt/MRTI/_incoming-activos/ti-assets/backend/uploads');
const storageRoot = path.resolve(process.env.ASSET_DOCUMENTS_DIR || path.resolve(process.cwd(), 'storage/asset-documents'));
await mkdir(storageRoot, { recursive: true, mode: 0o700 });

const connection = await mysql.createConnection({
  host: process.env.MYSQL_HOST || 'localhost', port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER || 'root', password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'mrti_activos',
});

const [documents] = await connection.query('SELECT id, archivo, local_storage_path FROM sap_documentos ORDER BY id');
let copied = 0; let alreadyPresent = 0; let missing = 0;
for (const document of documents) {
  const originalName = path.basename(String(document.archivo || ''));
  if (!originalName || originalName !== document.archivo) { missing += 1; continue; }
  const relativePath = `${document.id}-${originalName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const source = path.resolve(sourceRoot, originalName);
  const destination = path.resolve(storageRoot, relativePath);
  if (!source.startsWith(`${sourceRoot}${path.sep}`) || !destination.startsWith(`${storageRoot}${path.sep}`)) { missing += 1; continue; }
  try {
    await stat(destination);
    alreadyPresent += 1;
  } catch {
    try { await copyFile(source, destination); copied += 1; } catch (error) { if (error.code === 'ENOENT') { missing += 1; continue; } throw error; }
  }
  await chmod(destination, 0o600);
  await connection.query('UPDATE sap_documentos SET local_storage_path = ? WHERE id = ?', [relativePath, document.id]);
}

await connection.end();
console.log(JSON.stringify({ total: documents.length, copied, alreadyPresent, missing, storageRoot }, null, 2));
