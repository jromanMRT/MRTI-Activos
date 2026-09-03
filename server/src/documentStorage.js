import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import multer from 'multer';

export const ASSET_DOCUMENT_MAX_BYTES = 25 * 1024 * 1024;
export const STORAGE_ROOT = path.resolve(process.env.ASSET_DOCUMENTS_DIR || path.resolve(process.cwd(), 'storage/asset-documents'));

export const assetDocumentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { files: 1, fileSize: ASSET_DOCUMENT_MAX_BYTES, fields: 8, fieldSize: 4096 },
});

export function safeDocumentPath(relativePath) {
  if (!relativePath || path.isAbsolute(relativePath)) return null;
  const resolved = path.resolve(STORAGE_ROOT, relativePath);
  return resolved.startsWith(`${STORAGE_ROOT}${path.sep}`) ? resolved : null;
}

export function detectAssetDocument(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) return null;
  if (buffer.subarray(0, 5).toString('ascii') === '%PDF-') return { mimeType: 'application/pdf', extension: '.pdf' };
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { mimeType: 'image/png', extension: '.png' };
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return { mimeType: 'image/jpeg', extension: '.jpg' };
  return null;
}

export function cleanOriginalFilename(filename) {
  const base = path.basename(String(filename || '')).replace(/[\u0000-\u001f\u007f]/g, '').trim();
  return (base || 'documento').slice(0, 240);
}

export async function storeAssetDocument(buffer, extension) {
  await mkdir(STORAGE_ROOT, { recursive: true, mode: 0o700 });
  const relativePath = `${randomUUID()}${extension}`;
  const absolutePath = safeDocumentPath(relativePath);
  await writeFile(absolutePath, buffer, { flag: 'wx', mode: 0o600 });
  return {
    relativePath,
    absolutePath,
    sha256: createHash('sha256').update(buffer).digest('hex'),
  };
}

export async function removeStoredAssetDocument(relativePath) {
  const absolutePath = safeDocumentPath(relativePath);
  if (absolutePath) await unlink(absolutePath).catch((error) => { if (error.code !== 'ENOENT') throw error; });
}
