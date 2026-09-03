-- ============================================================
-- 009: Documentos creados directamente en MRTI Activos
--
-- Los documentos importados de SAP conservan sap_id. Los nuevos usan el
-- asset_uid estable del activo y sap_id NULL; no se escriben en la fuente
-- externa ni se crean llaves foráneas entre módulos.
-- ============================================================

USE mrti_activos;

SET @sap_id_nullable = (
  SELECT IS_NULLABLE FROM information_schema.columns
   WHERE table_schema=DATABASE() AND table_name='sap_documentos' AND column_name='sap_id'
);
SET @ddl = IF(@sap_id_nullable = 'NO',
  'ALTER TABLE sap_documentos MODIFY COLUMN sap_id INT UNSIGNED NULL',
  'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl = IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='sap_documentos' AND column_name='asset_uid'),
  'SELECT 1', 'ALTER TABLE sap_documentos ADD COLUMN asset_uid CHAR(36) NULL AFTER sap_id');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl = IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='sap_documentos' AND column_name='mime_type'),
  'SELECT 1', 'ALTER TABLE sap_documentos ADD COLUMN mime_type VARCHAR(100) NULL AFTER local_storage_path');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl = IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='sap_documentos' AND column_name='sha256'),
  'SELECT 1', 'ALTER TABLE sap_documentos ADD COLUMN sha256 CHAR(64) NULL AFTER mime_type');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl = IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='sap_documentos' AND column_name='document_origin'),
  'SELECT 1', 'ALTER TABLE sap_documentos ADD COLUMN document_origin VARCHAR(20) NOT NULL DEFAULT ''sap'' AFTER sha256');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl = IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='sap_documentos' AND column_name='uploaded_by_user_id'),
  'SELECT 1', 'ALTER TABLE sap_documentos ADD COLUMN uploaded_by_user_id CHAR(36) NULL AFTER document_origin');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl = IF(EXISTS(SELECT 1 FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='sap_documentos' AND index_name='idx_sap_documentos_asset_uid'),
  'SELECT 1', 'ALTER TABLE sap_documentos ADD KEY idx_sap_documentos_asset_uid (asset_uid, archived_at)');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Backfill no destructivo: los documentos históricos ya enlazaban por el
-- center_code. Se agrega el UUID estable sin retirar esa ruta compatible.
UPDATE sap_documentos d
JOIN activos a ON a.center_code = d.center_code
SET d.asset_uid = a.asset_uid
WHERE d.asset_uid IS NULL;
