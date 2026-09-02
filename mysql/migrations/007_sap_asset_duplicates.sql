-- Conserva y hace visibles los códigos de centro duplicados detectados en
-- ActivosTI. El inventario local usa center_code como llave natural, por lo
-- que nunca debe resolver estos conflictos silenciosamente.
USE mrti_activos;

CREATE TABLE IF NOT EXISTS sap_asset_duplicates (
  center_code VARCHAR(50) NOT NULL PRIMARY KEY,
  source_ids_json TEXT NOT NULL,
  snapshot_json LONGTEXT NOT NULL,
  detected_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at DATETIME NULL,
  KEY idx_sap_asset_duplicates_resolved (resolved_at, last_seen_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
