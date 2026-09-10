-- Tercera tanda del rollout de escritura hacia SAP: componentes y
-- mantenimientos. A diferencia de la tanda anterior, estos dos resuelven
-- center_code -> activo_id de SAP en cada push (ver pushLinkedCatalogRowToSap
-- en sapClient.js) en vez de guardar ese id localmente.

SET @ddl = IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='sap_componentes' AND column_name='locally_edited_at'),'SELECT 1','ALTER TABLE sap_componentes ADD COLUMN locally_edited_at DATETIME NULL'); PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='sap_componentes' AND column_name='locally_edited_by'),'SELECT 1','ALTER TABLE sap_componentes ADD COLUMN locally_edited_by CHAR(36) NULL'); PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='sap_componentes' AND column_name='sap_synced_at'),'SELECT 1','ALTER TABLE sap_componentes ADD COLUMN sap_synced_at DATETIME NULL'); PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='sap_componentes' AND column_name='sap_sync_error'),'SELECT 1','ALTER TABLE sap_componentes ADD COLUMN sap_sync_error VARCHAR(255) NULL'); PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl = IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='sap_mantenimientos' AND column_name='locally_edited_at'),'SELECT 1','ALTER TABLE sap_mantenimientos ADD COLUMN locally_edited_at DATETIME NULL'); PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='sap_mantenimientos' AND column_name='locally_edited_by'),'SELECT 1','ALTER TABLE sap_mantenimientos ADD COLUMN locally_edited_by CHAR(36) NULL'); PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='sap_mantenimientos' AND column_name='sap_synced_at'),'SELECT 1','ALTER TABLE sap_mantenimientos ADD COLUMN sap_synced_at DATETIME NULL'); PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='sap_mantenimientos' AND column_name='sap_sync_error'),'SELECT 1','ALTER TABLE sap_mantenimientos ADD COLUMN sap_sync_error VARCHAR(255) NULL'); PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
