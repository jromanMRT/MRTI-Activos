-- Sólo sap_fortigate recibe estos campos -- los demás catálogos sap_* no se
-- tocan. asset_uid es el mismo tipo de identificador estable que ya usa
-- `activos` (002_asset_master.sql) para que MRTI-Infra pueda vincular un
-- dispositivo de Monitor sin FK entre módulos. locally_edited_at es la marca
-- que hace que mirrorRows() (sapSync.js) deje de pisar este renglón para
-- siempre, una vez que un humano lo edita a mano.
SET @ddl = IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='sap_fortigate' AND column_name='ip_address'),'SELECT 1','ALTER TABLE sap_fortigate ADD COLUMN ip_address VARCHAR(50) NULL AFTER comentario'); PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='sap_fortigate' AND column_name='asset_uid'),'SELECT 1','ALTER TABLE sap_fortigate ADD COLUMN asset_uid CHAR(36) NULL AFTER id'); PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='sap_fortigate' AND column_name='locally_edited_at'),'SELECT 1','ALTER TABLE sap_fortigate ADD COLUMN locally_edited_at DATETIME NULL'); PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='sap_fortigate' AND column_name='locally_edited_by'),'SELECT 1','ALTER TABLE sap_fortigate ADD COLUMN locally_edited_by CHAR(36) NULL'); PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Backfill: los renglones que ya existían reciben su UUID estable de una
-- vez, para poder vincularse a Monitor sin tener que editarlos primero.
UPDATE sap_fortigate SET asset_uid = UUID() WHERE asset_uid IS NULL;

SET @ddl = IF(EXISTS(SELECT 1 FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='sap_fortigate' AND index_name='uq_sap_fortigate_asset_uid'),'SELECT 1','ALTER TABLE sap_fortigate ADD UNIQUE KEY uq_sap_fortigate_asset_uid (asset_uid)'); PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
