// Copia idempotente de los PDF del antiguo _incoming-activos al almacén
// privado del módulo oficial. No elimina ni modifica el origen.
import 'dotenv/config';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { chmod, copyFile, mkdir, readdir, stat } from 'node:fs/promises';
import mysql from 'mysql2/promise';

const sourceRoot = path.resolve(process.env.INCOMING_ACTIVOS_UPLOAD_DIR || '/var/www/mrt/MRTI/_incoming-activos/ti-assets/backend/uploads');
const storageRoot = path.resolve(process.env.ASSET_DOCUMENTS_DIR || path.resolve(process.cwd(), 'storage/asset-documents'));
await mkdir(storageRoot, { recursive: true, mode: 0o700 });

const connection = await mysql.createConnection({
  host: process.env.MYSQL_HOST || 'localhost', port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER || 'root', password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'mrti_activos',
});

async function fileSha256(filePath) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest('hex');
}

async function fileExists(filePath) {
  try { return await stat(filePath); } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

const [documents] = await connection.query('SELECT id, archivo, local_storage_path, sha256 FROM sap_documentos ORDER BY id');
let copied = 0; let alreadyPresent = 0; let verified = 0; let missing = 0;
const mappedSourceNames = new Set();
for (const document of documents) {
  const originalName = path.basename(String(document.archivo || ''));
  if (!originalName || originalName !== document.archivo) { missing += 1; continue; }
  mappedSourceNames.add(originalName);
  const relativePath = `${document.id}-${originalName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const source = path.resolve(sourceRoot, originalName);
  const destination = path.resolve(storageRoot, relativePath);
  if (!source.startsWith(`${sourceRoot}${path.sep}`) || !destination.startsWith(`${storageRoot}${path.sep}`)) { missing += 1; continue; }
  let destinationStat = await fileExists(destination);
  const sourceStat = await fileExists(source);
  if (destinationStat) {
    alreadyPresent += 1;
  } else if (sourceStat) {
    await copyFile(source, destination);
    destinationStat = await stat(destination);
    copied += 1;
  } else {
    missing += 1;
    continue;
  }

  const destinationSha256 = await fileSha256(destination);
  if (sourceStat) {
    const sourceSha256 = await fileSha256(source);
    if (sourceSha256 !== destinationSha256 || sourceStat.size !== destinationStat.size) {
      throw new Error(`El documento migrado no coincide con el origen: ${originalName}`);
    }
  } else if (document.sha256 && document.sha256 !== destinationSha256) {
    throw new Error(`El documento oficial no coincide con su SHA-256 registrado: ${originalName}`);
  }
  verified += 1;
  await chmod(destination, 0o600);
  await connection.query(
    `UPDATE sap_documentos
       SET local_storage_path = ?, tamano = ?, sha256 = ?, mime_type = COALESCE(mime_type, 'application/pdf')
     WHERE id = ?`,
    [relativePath, destinationStat.size, destinationSha256, document.id]
  );
}

let sourceFiles = [];
try { sourceFiles = (await readdir(sourceRoot, { withFileTypes: true })).filter((entry) => entry.isFile()).map((entry) => entry.name); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
const unmappedSources = sourceFiles.filter((name) => !mappedSourceNames.has(name));
await connection.end();
if (missing || unmappedSources.length) {
  throw new Error(`Migración documental incompleta: ${missing} registros sin archivo y ${unmappedSources.length} archivos sin registro`);
}
console.log(JSON.stringify({ total: documents.length, copied, alreadyPresent, verified, missing, sourceFiles: sourceFiles.length, unmappedSources, storageRoot }, null, 2));
