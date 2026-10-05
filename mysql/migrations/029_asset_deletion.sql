-- Eliminación de activos desde la plataforma (decisión del usuario,
-- 2026-10-05): el activo desaparece del inventario y de toda la plataforma,
-- pero el renglón se conserva marcado con deleted_at. Así:
--   * la sincronización con SAP (pullSapAssets) no lo vuelve a traer -- en
--     SAP sigue existiendo, por decisión explícita no se borra allá;
--   * asignaciones, mantenimientos y referencias externas por asset_uid
--     (Obs, Tickets, Infra) no quedan apuntando a un registro inexistente;
--   * un administrador puede recuperarlo con SQL si fue un error
--     (UPDATE activos SET deleted_at = NULL ... ).
USE mrti_activos;

SET @add_deleted_at = (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE activos ADD COLUMN deleted_at DATETIME NULL, ADD COLUMN deleted_by_user_id CHAR(36) NULL, ADD COLUMN deleted_by_name VARCHAR(160) NULL',
    'SELECT 1')
  FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'activos' AND column_name = 'deleted_at'
);
PREPARE stmt FROM @add_deleted_at; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @add_deleted_index = (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE activos ADD KEY idx_activos_deleted_at (deleted_at)',
    'SELECT 1')
  FROM information_schema.statistics
  WHERE table_schema = DATABASE() AND table_name = 'activos' AND index_name = 'idx_activos_deleted_at'
);
PREPARE stmt FROM @add_deleted_index; EXECUTE stmt; DEALLOCATE PREPARE stmt;
