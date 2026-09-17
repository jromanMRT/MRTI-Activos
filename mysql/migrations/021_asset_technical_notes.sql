-- Notes belong to Activos; Core authors are stable references, without cross-database FKs.
CREATE TABLE IF NOT EXISTS asset_technical_notes (
  id CHAR(36) NOT NULL PRIMARY KEY,
  title VARCHAR(180) NOT NULL,
  equipment_reference VARCHAR(500) NULL,
  serial_reference VARCHAR(180) NULL,
  replacement_reference VARCHAR(500) NULL,
  purchase_url VARCHAR(2000) NULL,
  content TEXT NOT NULL,
  asset_uid CHAR(36) NULL,
  created_by CHAR(36) NOT NULL,
  created_by_name VARCHAR(255) NULL,
  updated_by CHAR(36) NOT NULL,
  revision INT UNSIGNED NOT NULL DEFAULT 0,
  archived_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_technical_notes_asset (asset_uid),
  KEY idx_technical_notes_visible (archived_at, updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
