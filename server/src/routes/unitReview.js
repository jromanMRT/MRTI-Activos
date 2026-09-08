import { Router } from 'express';
import { pool } from '../db.js';
import { administratorOnly } from '../auth.js';
import { unitReviewQueue, REVIEW_REASON_LABELS } from '../unitReviewQueue.js';
import { classifyUnit, saveAssetFields, revertUnitChange, UNIT_KINDS } from '../domain/unitReview.js';
import { listPhysicalAreas } from '../integrations/obsClient.js';
import { listOrgUnits } from '../integrations/rhClient.js';

export const unitReviewRouter = Router();

// Lectura: cualquier persona con acceso al módulo Activos puede ver la
// bandeja y las referencias disponibles -- sólo clasificar, corregir,
// revertir y archivar quedan reservados a administradores más abajo.
unitReviewRouter.get('/queue', async (_req, res, next) => {
  try {
    res.json({ data: await unitReviewQueue(pool), reason_labels: REVIEW_REASON_LABELS, usage_kinds: UNIT_KINDS });
  } catch (error) { next(error); }
});

unitReviewRouter.get('/references/physical-areas', async (req, res, next) => {
  try { res.json({ data: await listPhysicalAreas(req.headers.authorization) }); }
  catch (error) { next(error); }
});

unitReviewRouter.get('/references/org-units', async (req, res, next) => {
  try { res.json({ data: await listOrgUnits(req.headers.authorization) }); }
  catch (error) { next(error); }
});

unitReviewRouter.patch('/catalog/:id', administratorOnly, async (req, res, next) => {
  try {
    const actor = { ...req.portalUser, authorization: req.headers.authorization };
    const result = await classifyUnit(pool, req.params.id, req.body || {}, actor);
    res.json({ data: result });
  } catch (error) { next(error); }
});

unitReviewRouter.get('/assets/:id/history', async (req, res, next) => {
  try {
    const [[asset]] = await pool.query('SELECT asset_uid FROM activos WHERE id = ?', [req.params.id]);
    if (!asset) return res.status(404).json({ error: 'Activo no encontrado' });
    const [rows] = await pool.query(
      `SELECT id, asset_revision, before_json, after_json, reason, actor_name, reverses_id, created_at
         FROM asset_unit_changes WHERE asset_uid = ? ORDER BY asset_revision DESC`,
      [asset.asset_uid]
    );
    res.json({ data: rows });
  } catch (error) { next(error); }
});

// Corrección puntual de la unidad de un activo -- las entradas al servicio
// vienen exclusivamente de esta lista, nunca del body completo (ver
// domain/unitReview.js: saveAssetFields también es el camino del PATCH
// general de /api/activos, así ninguno de los dos elude la validación).
unitReviewRouter.patch('/assets/:id', administratorOnly, async (req, res, next) => {
  try {
    const body = req.body || {};
    if (!Object.hasOwn(body, 'unidad')) return res.status(400).json({ error: 'Envía el campo unidad a corregir.' });
    const fields = { unidad: body.unidad === '' ? null : body.unidad };
    const result = await saveAssetFields(pool, req.params.id, fields, req.portalUser, {
      reason: body.reason,
      expectedRevision: body.expected_revision !== undefined ? Number(body.expected_revision) : undefined,
    });
    res.json({ data: { changed: result.changed, change: result.change, unidad: result.data.unidad, unit_revision: result.data.unit_revision } });
  } catch (error) { next(error); }
});

unitReviewRouter.post('/assets/:id/revert/:changeId', administratorOnly, async (req, res, next) => {
  try {
    const [[asset]] = await pool.query('SELECT asset_uid FROM activos WHERE id = ?', [req.params.id]);
    if (!asset) return res.status(404).json({ error: 'Activo no encontrado' });
    const [[event]] = await pool.query('SELECT asset_uid FROM asset_unit_changes WHERE id = ?', [req.params.changeId]);
    if (!event || event.asset_uid !== asset.asset_uid) return res.status(404).json({ error: 'Cambio no encontrado para este activo' });
    const result = await revertUnitChange(pool, req.params.changeId, req.portalUser, req.body?.reason);
    res.json({ data: result });
  } catch (error) { next(error); }
});
