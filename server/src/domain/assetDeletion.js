// Eliminación de un activo desde la plataforma. Para evitar errores, quien
// elimina debe escribir el Código TI (center_code) del equipo exactamente;
// sólo se ignoran mayúsculas/minúsculas y espacios en los extremos.
//
// No es un DELETE físico: el renglón queda con deleted_at y desaparece de
// todas las consultas. Ver mysql/migrations/029_asset_deletion.sql para el
// porqué (SAP lo volvería a traer y hay referencias por asset_uid).

export function deletionError(message, status = 400) {
  return Object.assign(new Error(message), { status });
}

export function normalizeCenterCode(value) {
  return String(value ?? '').trim().toUpperCase();
}

export function confirmationMatches(centerCode, typed) {
  const expected = normalizeCenterCode(centerCode);
  return Boolean(expected) && expected === normalizeCenterCode(typed);
}

export async function deleteAsset(db, assetId, typedCode, actor) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [[asset]] = await connection.query(
      'SELECT id, asset_uid, center_code FROM activos WHERE id = ? AND deleted_at IS NULL FOR UPDATE',
      [assetId]
    );
    if (!asset) throw deletionError('Activo no encontrado', 404);
    if (!confirmationMatches(asset.center_code, typedCode)) {
      throw deletionError(`El código escrito no coincide con el Código TI del equipo (${asset.center_code}). No se eliminó nada.`, 422);
    }
    await connection.query(
      'UPDATE activo_asignaciones SET unassigned_at = CURRENT_TIMESTAMP WHERE asset_uid = ? AND unassigned_at IS NULL',
      [asset.asset_uid]
    );
    await connection.query(
      `UPDATE activos SET deleted_at = NOW(), deleted_by_user_id = ?, deleted_by_name = ?,
              estado = 'Inactivo', active = 'NO',
              portal_user_id = NULL, tercero_id = NULL, rh_employee_id = NULL, usuario_asignado = NULL
        WHERE id = ?`,
      [actor?.id || null, String(actor?.name || actor?.email || '').slice(0, 160) || null, asset.id]
    );
    await connection.commit();
    return { id: asset.id, asset_uid: asset.asset_uid, center_code: asset.center_code, deleted: true };
  } catch (error) {
    await connection.rollback().catch(() => {});
    throw error;
  } finally {
    connection.release();
  }
}
