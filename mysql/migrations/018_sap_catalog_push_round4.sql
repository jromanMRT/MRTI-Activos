-- Cuarta y última tanda planeada del rollout de escritura hacia SAP: nvr y
-- passwords. Sólo los campos NO secretos se empujan (ver comentario en
-- sapClient.js) -- las columnas de contraseña siguen sin escribirse hacia
-- SAP por esta vía.

SET @ddl = IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='sap_nvr' AND column_name='locally_edited_at'),'SELECT 1','ALTER TABLE sap_nvr ADD COLUMN locally_edited_at DATETIME NULL'); PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='sap_nvr' AND column_name='locally_edited_by'),'SELECT 1','ALTER TABLE sap_nvr ADD COLUMN locally_edited_by CHAR(36) NULL'); PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='sap_nvr' AND column_name='sap_synced_at'),'SELECT 1','ALTER TABLE sap_nvr ADD COLUMN sap_synced_at DATETIME NULL'); PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='sap_nvr' AND column_name='sap_sync_error'),'SELECT 1','ALTER TABLE sap_nvr ADD COLUMN sap_sync_error VARCHAR(255) NULL'); PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- sap_passwords no recibe locally_edited_at/_by: no admite `editable`
-- (ver nota en RESOURCE_CONFIG.passwords), sólo se empuja en la alta.
SET @ddl = IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='sap_passwords' AND column_name='sap_synced_at'),'SELECT 1','ALTER TABLE sap_passwords ADD COLUMN sap_synced_at DATETIME NULL'); PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='sap_passwords' AND column_name='sap_sync_error'),'SELECT 1','ALTER TABLE sap_passwords ADD COLUMN sap_sync_error VARCHAR(255) NULL'); PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
