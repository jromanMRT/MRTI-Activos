-- Primer catálogo sap_* con escritura de vuelta hacia SAP (rollout de menor
-- a mayor riesgo: fortigate primero, passwords/nvr al final). Columnas
-- separadas de `synced_at` (que ya existe y es de la sincronización de
-- lectura): estas dos son del lado de escritura, mismo patrón que
-- `sap_synced_at`/`sap_sync_error` de la tabla `activos`.
SET @ddl = IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='sap_fortigate' AND column_name='sap_synced_at'),'SELECT 1','ALTER TABLE sap_fortigate ADD COLUMN sap_synced_at DATETIME NULL'); PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='sap_fortigate' AND column_name='sap_sync_error'),'SELECT 1','ALTER TABLE sap_fortigate ADD COLUMN sap_sync_error VARCHAR(255) NULL'); PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
