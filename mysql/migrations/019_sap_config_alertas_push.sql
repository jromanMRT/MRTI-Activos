-- config-alertas: catálogo pequeño de umbrales de aviso (antivirus/fortigate/
-- o365 hoy), llave natural `clave` compartida con SAP (sin id/sap_id
-- separado como los demás catálogos). Edición únicamente -- no admite altas
-- nuevas (ver RESOURCE_CONFIG['config-alertas'].creatable=false): las claves
-- son fijas, las define la lógica de alertas del lado de SAP.

SET @ddl = IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='sap_config_alertas' AND column_name='locally_edited_at'),'SELECT 1','ALTER TABLE sap_config_alertas ADD COLUMN locally_edited_at DATETIME NULL'); PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='sap_config_alertas' AND column_name='locally_edited_by'),'SELECT 1','ALTER TABLE sap_config_alertas ADD COLUMN locally_edited_by CHAR(36) NULL'); PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='sap_config_alertas' AND column_name='sap_synced_at'),'SELECT 1','ALTER TABLE sap_config_alertas ADD COLUMN sap_synced_at DATETIME NULL'); PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='sap_config_alertas' AND column_name='sap_sync_error'),'SELECT 1','ALTER TABLE sap_config_alertas ADD COLUMN sap_sync_error VARCHAR(255) NULL'); PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
