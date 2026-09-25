import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { pool } from '../db.js';
import { canEditNote, normalizeNote, noteError, noteRevision, noteSearch } from '../domain/technicalNotes.js';
import { cleanOriginalImageName, detectTechnicalNoteImage, removeStoredTechnicalNoteImage, safeImagePath, storeTechnicalNoteImage, technicalNoteImageUpload } from '../imageStorage.js';

// Fotos suficientes para mostrar etiqueta, número de parte y detalle sin
// convertir la nota en un álbum.
const MAX_IMAGES_PER_NOTE = 6;

export function createTechnicalNotesRouter(db = pool) {
  const router = Router();
  const select = `SELECT n.*, a.id AS asset_id, a.center_code AS asset_code,
    a.marca AS asset_brand, a.modelo AS asset_model, a.numero_serie AS asset_serial, a.service_tag AS asset_service_tag,
    (SELECT COUNT(*) FROM asset_technical_note_images i WHERE i.note_id = n.id) AS image_count
    FROM asset_technical_notes n LEFT JOIN activos a ON a.asset_uid = n.asset_uid`;
  const publicNote = (row, actor) => ({ ...row, can_edit: canEditNote(row, actor) });
  const read = async (id) => {
    const [[row]] = await db.query(`${select} WHERE n.id = ?`, [id]);
    if (!row) throw noteError('Nota no encontrada.', 404);
    return row;
  };
  const validateAsset = async (uid) => {
    if (!uid) return;
    const [[asset]] = await db.query('SELECT id FROM activos WHERE asset_uid = ?', [uid]);
    if (!asset) throw noteError('El equipo vinculado ya no está disponible.');
  };

  router.get('/assets', async (req, res, next) => {
    try {
      const terms = noteSearch(req.query.q);
      if (!terms.length) return res.json({ data: [] });
      const where = terms.map(() => "CONCAT_WS(' ',center_code,marca,modelo,numero_serie,service_tag) LIKE ? ESCAPE '='").join(' AND ');
      const [rows] = await db.query(`SELECT id,asset_uid,center_code,marca,modelo,numero_serie,service_tag FROM activos WHERE ${where} ORDER BY center_code DESC LIMIT 20`, terms);
      res.json({ data: rows });
    } catch (error) { next(error); }
  });

  router.get('/', async (req, res, next) => {
    try {
      const terms = noteSearch(req.query.q);
      const clauses = [req.query.archived === '1' ? 'n.archived_at IS NOT NULL' : 'n.archived_at IS NULL'];
      const params = [];
      for (const term of terms) {
        clauses.push("CONCAT_WS(' ',n.title,n.content,n.equipment_reference,n.serial_reference,n.replacement_reference,n.purchase_url,a.center_code,a.marca,a.modelo,a.numero_serie,a.service_tag) LIKE ? ESCAPE '='");
        params.push(term);
      }
      if (req.query.asset_uid) { clauses.push('n.asset_uid = ?'); params.push(String(req.query.asset_uid)); }
      const page = Math.max(1, Math.min(100000, parseInt(req.query.page, 10) || 1));
      const from = 'FROM asset_technical_notes n LEFT JOIN activos a ON a.asset_uid = n.asset_uid';
      const where = `WHERE ${clauses.join(' AND ')}`;
      const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total ${from} ${where}`, params);
      const [rows] = await db.query(`${select} ${where} ORDER BY n.updated_at DESC,n.id LIMIT 30 OFFSET ?`, [...params, (page - 1) * 30]);
      res.json({ data: rows.map((row) => publicNote(row, req.portalUser)), total: Number(total), page, page_size: 30 });
    } catch (error) { next(error); }
  });

  router.post('/', async (req, res, next) => {
    try {
      const fields = normalizeNote(req.body);
      await validateAsset(fields.asset_uid);
      const id = randomUUID();
      const keys = Object.keys(fields);
      await db.query(`INSERT INTO asset_technical_notes (id,${keys.join(',')},created_by,created_by_name,updated_by)
        VALUES (${Array(keys.length + 4).fill('?').join(',')})`, [id, ...Object.values(fields), req.portalUser.id, req.portalUser.name || null, req.portalUser.id]);
      res.status(201).json({ data: publicNote(await read(id), req.portalUser) });
    } catch (error) { next(error); }
  });

  router.patch('/:id', async (req, res, next) => {
    try {
      const before = await read(req.params.id);
      if (!canEditNote(before, req.portalUser)) throw noteError('Sólo el autor o un administrador puede editar esta nota.', 403);
      if (before.archived_at) throw noteError('Restaura la nota antes de editarla.', 409);
      const fields = normalizeNote(req.body);
      const revision = noteRevision(req.body.revision);
      await validateAsset(fields.asset_uid);
      const [result] = await db.query(`UPDATE asset_technical_notes SET ${Object.keys(fields).map((key) => `${key} = ?`).join(',')},
        updated_by = ?, revision = revision + 1, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND revision = ? AND archived_at IS NULL`, [...Object.values(fields), req.portalUser.id, before.id, revision]);
      if (!result.affectedRows) throw noteError('La nota cambió en otra sesión. Recarga la lista antes de editarla.', 409);
      res.json({ data: publicNote(await read(before.id), req.portalUser) });
    } catch (error) { next(error); }
  });

  router.patch('/:id/archive', async (req, res, next) => {
    try {
      const before = await read(req.params.id);
      if (!canEditNote(before, req.portalUser)) throw noteError('Sólo el autor o un administrador puede archivar o restaurar esta nota.', 403);
      if (typeof req.body.archived !== 'boolean') throw noteError('Indica si deseas archivar o restaurar la nota.');
      const revision = noteRevision(req.body.revision);
      const [result] = await db.query(`UPDATE asset_technical_notes SET archived_at = ?, updated_by = ?,
        revision = revision + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND revision = ?`,
      [req.body.archived ? new Date() : null, req.portalUser.id, before.id, revision]);
      if (!result.affectedRows) throw noteError('La nota cambió en otra sesión. Recarga la lista.', 409);
      res.json({ data: publicNote(await read(before.id), req.portalUser) });
    } catch (error) { next(error); }
  });

  router.get('/:id/images', async (req, res, next) => {
    try {
      await read(req.params.id);
      const [rows] = await db.query(
        'SELECT id, original_name, mime_type, size_bytes, created_at FROM asset_technical_note_images WHERE note_id = ? ORDER BY created_at ASC',
        [req.params.id]
      );
      res.json({ data: rows });
    } catch (error) { next(error); }
  });

  router.post('/:id/images', technicalNoteImageUpload.single('file'), async (req, res, next) => {
    let stored = null;
    try {
      const before = await read(req.params.id);
      if (!canEditNote(before, req.portalUser)) throw noteError('Sólo el autor o un administrador puede agregar imágenes a esta nota.', 403);
      if (before.archived_at) throw noteError('Restaura la nota antes de agregar imágenes.', 409);
      if (!req.file) throw noteError('Selecciona una imagen.');
      const detected = detectTechnicalNoteImage(req.file.buffer);
      if (!detected) throw noteError('Formato no permitido. Usa JPG o PNG.');
      const [[{ count }]] = await db.query('SELECT COUNT(*) AS count FROM asset_technical_note_images WHERE note_id = ?', [before.id]);
      if (count >= MAX_IMAGES_PER_NOTE) throw noteError(`Cada nota admite hasta ${MAX_IMAGES_PER_NOTE} imágenes.`);
      stored = await storeTechnicalNoteImage(req.file.buffer, detected.extension);
      const id = randomUUID();
      await db.query(
        `INSERT INTO asset_technical_note_images
          (id, note_id, original_name, local_storage_path, mime_type, size_bytes, sha256, uploaded_by_user_id, uploaded_by_name)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, before.id, cleanOriginalImageName(req.file.originalname), stored.relativePath, detected.mimeType,
          req.file.size, stored.sha256, req.portalUser.id, req.portalUser.name || null]
      );
      const [[image]] = await db.query('SELECT id, original_name, mime_type, size_bytes, created_at FROM asset_technical_note_images WHERE id = ?', [id]);
      res.status(201).json({ data: image });
    } catch (error) {
      if (stored?.relativePath) await removeStoredTechnicalNoteImage(stored.relativePath).catch(() => {});
      next(error);
    }
  });

  router.get('/:noteId/images/:imageId/file', async (req, res, next) => {
    try {
      await read(req.params.noteId);
      const [[image]] = await db.query(
        'SELECT mime_type, local_storage_path FROM asset_technical_note_images WHERE id = ? AND note_id = ?',
        [req.params.imageId, req.params.noteId]
      );
      if (!image) throw noteError('Imagen no encontrada.', 404);
      const filePath = safeImagePath(image.local_storage_path);
      if (!filePath) throw noteError('La imagen ya no está disponible.', 404);
      res.set('Cache-Control', 'private, max-age=86400');
      res.type(image.mime_type);
      res.sendFile(filePath, (error) => { if (error) next(error); });
    } catch (error) { next(error); }
  });

  router.delete('/:noteId/images/:imageId', async (req, res, next) => {
    try {
      const before = await read(req.params.noteId);
      if (!canEditNote(before, req.portalUser)) throw noteError('Sólo el autor o un administrador puede quitar imágenes de esta nota.', 403);
      const [[image]] = await db.query('SELECT id, local_storage_path FROM asset_technical_note_images WHERE id = ? AND note_id = ?', [req.params.imageId, before.id]);
      if (!image) throw noteError('Imagen no encontrada.', 404);
      await db.query('DELETE FROM asset_technical_note_images WHERE id = ?', [image.id]);
      await removeStoredTechnicalNoteImage(image.local_storage_path).catch(() => {});
      res.json({ data: { id: image.id, deleted: true } });
    } catch (error) { next(error); }
  });

  return router;
}
export const technicalNotesRouter = createTechnicalNotesRouter();
