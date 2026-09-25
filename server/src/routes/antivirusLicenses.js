import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { pool } from '../db.js';
import { administratorOnly } from '../auth.js';
import { canonicalAntivirusLicense, loadAntivirusLicenseGroups } from '../antivirusLicenses.js';
import { syncToSapBestEffort } from './activos.js';

export const antivirusLicensesRouter = Router();

function requiredText(value, label, max = 255) {
  const normalized = String(value ?? '').trim();
  if (!normalized) { const error = new Error(`${label} es obligatorio`); error.status = 400; throw error; }
  return normalized.slice(0, max);
}

function optionalText(value, max = 5000) {
  const normalized = String(value ?? '').trim();
  return normalized ? normalized.slice(0, max) : null;
}

function dateValue(value, label) {
  if (value === '' || value === null || value === undefined) return null;
  const normalized = String(value).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) { const error = new Error(`${label} debe tener formato AAAA-MM-DD`); error.status = 400; throw error; }
  return normalized;
}

export function normalizeLicenseInput(body = {}, { partial = false } = {}) {
  const result = {};
  const has = (key) => Object.prototype.hasOwnProperty.call(body, key);
  if (!partial || has('product_id')) {
    const productId = Number(body.product_id);
    if (!Number.isInteger(productId) || productId < 1) { const error = new Error('Selecciona un antivirus'); error.status = 400; throw error; }
    result.product_id = productId;
  }
  if (!partial || has('license_key')) {
    result.license_key = requiredText(body.license_key, 'La clave de licencia');
    result.license_key_normalized = canonicalAntivirusLicense(result.license_key);
  }
  if (!partial || has('seat_capacity')) {
    const capacity = Number(body.seat_capacity ?? 5);
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 10000) { const error = new Error('La capacidad debe ser un entero entre 1 y 10000'); error.status = 400; throw error; }
    result.seat_capacity = capacity;
  }
  for (const field of ['display_name', 'provider', 'purchase_reference']) {
    if (!partial || has(field)) result[field] = optionalText(body[field], 180);
  }
  if (!partial || has('notes')) result.notes = optionalText(body.notes);
  if (!partial || has('purchase_date')) result.purchase_date = dateValue(body.purchase_date, 'La fecha de compra');
  if (!partial || has('expires_on')) result.expires_on = dateValue(body.expires_on, 'La fecha de caducidad');
  const purchase = result.purchase_date ?? (partial ? undefined : null);
  const expiry = result.expires_on ?? (partial ? undefined : null);
  if (purchase && expiry && expiry < purchase) { const error = new Error('La caducidad no puede ser anterior a la compra'); error.status = 400; throw error; }
  return result;
}

async function syncLegacyAssets(connection, licenseId) {
  const [assets] = await connection.query(`SELECT a.id FROM activos a
    JOIN antivirus_license_assets ala ON ala.asset_uid=a.asset_uid AND ala.unassigned_at IS NULL
    WHERE ala.license_id=?`, [licenseId]);
  await connection.query(`UPDATE activos a
    JOIN antivirus_license_assets ala ON ala.asset_uid = a.asset_uid AND ala.unassigned_at IS NULL
    JOIN antivirus_licenses l ON l.id = ala.license_id
    SET a.av_licencia = l.license_key,
        a.av_caducidad = l.purchase_date,
        a.av_vencimiento = l.expires_on
    WHERE l.id = ?`, [licenseId]);
  return assets.map((asset) => asset.id);
}

function pushAssetsToSap(assetIds) {
  for (const assetId of new Set(assetIds)) void syncToSapBestEffort(assetId);
}

antivirusLicensesRouter.get('/products', async (_req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT id, code, vendor, name, is_default, is_active FROM antivirus_products WHERE is_active=1 ORDER BY is_default DESC, vendor, name');
    res.json({ data: rows });
  } catch (error) { next(error); }
});

antivirusLicensesRouter.post('/products', administratorOnly, async (req, res, next) => {
  try {
    const vendor = requiredText(req.body?.vendor, 'El fabricante', 120);
    const name = requiredText(req.body?.name, 'El nombre del antivirus', 180);
    const code = requiredText(req.body?.code || `${vendor}-${name}`, 'El código', 60)
      .toLocaleLowerCase('es-MX').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const [result] = await pool.query('INSERT INTO antivirus_products (code,vendor,name) VALUES (?,?,?)', [code, vendor, name]);
    const [[row]] = await pool.query('SELECT id,code,vendor,name,is_default,is_active FROM antivirus_products WHERE id=?', [result.insertId]);
    res.status(201).json({ data: row });
  } catch (error) { if (error?.code === 'ER_DUP_ENTRY') { error.status = 409; error.message = 'Ese antivirus ya existe'; } next(error); }
});

antivirusLicensesRouter.get('/assets', async (req, res, next) => {
  try {
    const clauses = ["a.estado='Activo'"];
    const values = [];
    if (req.query.asset_uid) { clauses.push('a.asset_uid=?'); values.push(String(req.query.asset_uid)); }
    if (req.query.q) {
      clauses.push("CONCAT_WS(' ',a.center_code,a.descripcion,a.usuario_asignado,a.numero_serie,a.service_tag) LIKE ?");
      values.push(`%${String(req.query.q).slice(0, 120)}%`);
    }
    const [rows] = await pool.query(`SELECT a.id, a.asset_uid, a.center_code, a.descripcion, a.usuario_asignado, a.numero_serie,
        ala.license_id, l.display_name AS license_name, l.license_key, p.name AS product_name
      FROM activos a
      LEFT JOIN antivirus_license_assets ala ON ala.asset_uid=a.asset_uid AND ala.unassigned_at IS NULL
      LEFT JOIN antivirus_licenses l ON l.id=ala.license_id
      LEFT JOIN antivirus_products p ON p.id=l.product_id
      WHERE ${clauses.join(' AND ')}
      ORDER BY a.center_code LIMIT 500`, values);
    res.json({ data: rows });
  } catch (error) { next(error); }
});

antivirusLicensesRouter.get('/', async (_req, res, next) => {
  try {
    const groups = await loadAntivirusLicenseGroups(pool);
    res.set('Cache-Control', 'no-store');
    res.json({ data: groups, meta: {
      licenses: groups.filter((group) => !group.legacy).length,
      devices: groups.filter((group) => !group.legacy).reduce((total, group) => total + Number(group.device_count || 0), 0),
      capacity: groups.filter((group) => !group.legacy).reduce((total, group) => total + Number(group.capacity || 0), 0),
      available_seats: groups.filter((group) => !group.legacy).reduce((total, group) => total + Number(group.available_seats || 0), 0),
      conflicts: groups.filter((group) => group.migration_status === 'needs_review' || group.purchase_conflict || group.expiration_conflict).length,
      expired: groups.filter((group) => Number(group.dias_restantes) < 0).length,
    } });
  } catch (error) { next(error); }
});

antivirusLicensesRouter.post('/', administratorOnly, async (req, res, next) => {
  try {
    const input = normalizeLicenseInput(req.body);
    const id = randomUUID();
    await pool.query(`INSERT INTO antivirus_licenses
      (id,product_id,display_name,license_key,license_key_normalized,purchase_date,expires_on,seat_capacity,provider,purchase_reference,notes,created_by)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`, [id, input.product_id, input.display_name, input.license_key, input.license_key_normalized, input.purchase_date, input.expires_on, input.seat_capacity, input.provider, input.purchase_reference, input.notes, req.portalUser.id]);
    const groups = await loadAntivirusLicenseGroups(pool);
    res.status(201).json({ data: groups.find((row) => row.id === id) });
  } catch (error) { if (error?.code === 'ER_DUP_ENTRY') { error.status = 409; error.message = 'Ya existe una licencia con esa clave'; } next(error); }
});

antivirusLicensesRouter.patch('/:id', administratorOnly, async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const input = normalizeLicenseInput(req.body, { partial: true });
    if (!Object.keys(input).length) return res.status(400).json({ error: 'No se recibieron cambios' });
    await connection.beginTransaction();
    const [[current]] = await connection.query('SELECT * FROM antivirus_licenses WHERE id=? AND archived_at IS NULL FOR UPDATE', [req.params.id]);
    if (!current) { await connection.rollback(); return res.status(404).json({ error: 'Licencia no encontrada' }); }
    const [[usage]] = await connection.query('SELECT COUNT(*) total FROM antivirus_license_assets WHERE license_id=? AND unassigned_at IS NULL', [req.params.id]);
    const capacity = input.seat_capacity ?? current.seat_capacity;
    if (capacity < Number(usage.total)) { await connection.rollback(); return res.status(409).json({ error: `La licencia tiene ${usage.total} activos vinculados; desvincula equipos antes de reducir la capacidad` }); }
    const purchase = input.purchase_date === undefined ? current.purchase_date : input.purchase_date;
    const expiry = input.expires_on === undefined ? current.expires_on : input.expires_on;
    if (purchase && expiry && String(expiry).slice(0, 10) < String(purchase).slice(0, 10)) { await connection.rollback(); return res.status(400).json({ error: 'La caducidad no puede ser anterior a la compra' }); }
    const columns = Object.keys(input);
    await connection.query(`UPDATE antivirus_licenses SET ${columns.map((key) => `\`${key}\`=?`).join(',')}, migration_status='ready' WHERE id=?`, [...columns.map((key) => input[key]), req.params.id]);
    const assetIds = await syncLegacyAssets(connection, req.params.id);
    await connection.commit();
    pushAssetsToSap(assetIds);
    const groups = await loadAntivirusLicenseGroups(pool);
    res.json({ data: groups.find((row) => row.id === req.params.id) });
  } catch (error) { await connection.rollback().catch(() => {}); if (error?.code === 'ER_DUP_ENTRY') { error.status=409; error.message='Ya existe una licencia con esa clave'; } next(error); }
  finally { connection.release(); }
});

antivirusLicensesRouter.post('/:id/assets', administratorOnly, async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const assetUid = requiredText(req.body?.asset_uid, 'El activo', 36);
    await connection.beginTransaction();
    const [[license]] = await connection.query('SELECT id,seat_capacity FROM antivirus_licenses WHERE id=? AND archived_at IS NULL FOR UPDATE', [req.params.id]);
    if (!license) { await connection.rollback(); return res.status(404).json({ error: 'Licencia no encontrada' }); }
    const [[asset]] = await connection.query("SELECT asset_uid FROM activos WHERE asset_uid=? AND estado='Activo' FOR UPDATE", [assetUid]);
    if (!asset) { await connection.rollback(); return res.status(404).json({ error: 'Activo no encontrado o retirado' }); }
    const [[existing]] = await connection.query('SELECT license_id FROM antivirus_license_assets WHERE asset_uid=? AND unassigned_at IS NULL FOR UPDATE', [assetUid]);
    if (existing) { await connection.rollback(); return res.status(409).json({ error: existing.license_id === req.params.id ? 'El activo ya está vinculado a esta licencia' : 'El activo ya pertenece a otra licencia antivirus' }); }
    const [[usage]] = await connection.query('SELECT COUNT(*) total FROM antivirus_license_assets WHERE license_id=? AND unassigned_at IS NULL', [req.params.id]);
    if (Number(usage.total) >= Number(license.seat_capacity)) { await connection.rollback(); return res.status(409).json({ error: 'La licencia ya alcanzó su capacidad' }); }
    await connection.query('INSERT INTO antivirus_license_assets (license_id,asset_uid,assigned_by) VALUES (?,?,?)', [req.params.id, assetUid, req.portalUser.id]);
    const assetIds = await syncLegacyAssets(connection, req.params.id);
    await connection.commit();
    pushAssetsToSap(assetIds);
    const groups = await loadAntivirusLicenseGroups(pool);
    res.status(201).json({ data: groups.find((row) => row.id === req.params.id) });
  } catch (error) { await connection.rollback().catch(() => {}); next(error); }
  finally { connection.release(); }
});

antivirusLicensesRouter.delete('/:id/assets/:assetUid', administratorOnly, async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [result] = await connection.query(`UPDATE antivirus_license_assets SET unassigned_at=NOW(),unassigned_by=?
      WHERE license_id=? AND asset_uid=? AND unassigned_at IS NULL`, [req.portalUser.id, req.params.id, req.params.assetUid]);
    if (!result.affectedRows) { await connection.rollback(); return res.status(404).json({ error: 'Vínculo no encontrado' }); }
    const [[asset]] = await connection.query('SELECT id FROM activos WHERE asset_uid=?', [req.params.assetUid]);
    await connection.query(`UPDATE activos SET av_licencia=NULL,av_caducidad=NULL,av_vencimiento=NULL
      WHERE asset_uid=? AND NOT EXISTS (SELECT 1 FROM antivirus_license_assets WHERE asset_uid=? AND unassigned_at IS NULL)`, [req.params.assetUid, req.params.assetUid]);
    await connection.commit();
    if (asset?.id) pushAssetsToSap([asset.id]);
    res.json({ data: { license_id: req.params.id, asset_uid: req.params.assetUid, unassigned: true } });
  } catch (error) { await connection.rollback().catch(() => {}); next(error); }
  finally { connection.release(); }
});
