-- Additive, repeatable expansion. Local governance fields are not mirrored to SAP.
SET @ddl = IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='sap_unidades' AND column_name='usage_kind'),'SELECT 1','ALTER TABLE sap_unidades ADD COLUMN usage_kind VARCHAR(24) NOT NULL DEFAULT ''pending'''); PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='sap_unidades' AND column_name='reference_id'),'SELECT 1','ALTER TABLE sap_unidades ADD COLUMN reference_id VARCHAR(64) NULL'); PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='sap_unidades' AND column_name='review_note'),'SELECT 1','ALTER TABLE sap_unidades ADD COLUMN review_note TEXT NULL'); PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='sap_unidades' AND column_name='reviewed_by'),'SELECT 1','ALTER TABLE sap_unidades ADD COLUMN reviewed_by CHAR(36) NULL'); PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='sap_unidades' AND column_name='reviewed_at'),'SELECT 1','ALTER TABLE sap_unidades ADD COLUMN reviewed_at DATETIME NULL'); PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='sap_unidades' AND column_name='review_revision'),'SELECT 1','ALTER TABLE sap_unidades ADD COLUMN review_revision INT UNSIGNED NOT NULL DEFAULT 0'); PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='activos' AND column_name='unit_is_manual'),'SELECT 1','ALTER TABLE activos ADD COLUMN unit_is_manual TINYINT(1) NOT NULL DEFAULT 0'); PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='activos' AND column_name='unit_revision'),'SELECT 1','ALTER TABLE activos ADD COLUMN unit_revision INT UNSIGNED NOT NULL DEFAULT 0'); PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
CREATE TABLE IF NOT EXISTS asset_unit_changes (
 id CHAR(36) PRIMARY KEY,
 asset_uid CHAR(36) NOT NULL,
 asset_revision INT UNSIGNED NOT NULL,
 before_json JSON NOT NULL,
 after_json JSON NOT NULL,
 reason VARCHAR(1000) NOT NULL,
 actor_user_id CHAR(36) NOT NULL,
 actor_name VARCHAR(200) NULL,
 reverses_id CHAR(36) NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE KEY uq_asset_unit_revision (asset_uid, asset_revision),
 UNIQUE KEY uq_unit_reversal (reverses_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
