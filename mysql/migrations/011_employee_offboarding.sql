-- 011: seguimiento de devolución de activos por baja laboral.
-- RH conserva la baja del empleado; esta tabla sólo guarda el proceso físico
-- y referencia la asignación/activo locales. Los UUID de Core son texto, sin FK cruzada.
USE mrti_activos;

CREATE TABLE IF NOT EXISTS asset_offboarding_items (
  id CHAR(36) NOT NULL PRIMARY KEY,
  assignment_id CHAR(36) NOT NULL,
  asset_uid CHAR(36) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  due_date DATE NULL,
  returned_at DATETIME NULL,
  condition_state VARCHAR(24) NULL,
  destination VARCHAR(24) NULL,
  accessories_json JSON NULL,
  notes TEXT NULL,
  received_by_user_id CHAR(36) NULL,
  received_by_name VARCHAR(160) NULL,
  updated_by_user_id CHAR(36) NULL,
  updated_by_name VARCHAR(160) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_asset_offboarding_assignment (assignment_id),
  KEY idx_asset_offboarding_status (status, due_date),
  KEY idx_asset_offboarding_asset (asset_uid, updated_at),
  CONSTRAINT fk_asset_offboarding_assignment FOREIGN KEY (assignment_id) REFERENCES activo_asignaciones(id) ON DELETE RESTRICT,
  CONSTRAINT fk_asset_offboarding_asset FOREIGN KEY (asset_uid) REFERENCES activos(asset_uid) ON DELETE RESTRICT,
  CONSTRAINT chk_asset_offboarding_status CHECK (status IN ('pending','not_returned','returned')),
  CONSTRAINT chk_asset_offboarding_condition CHECK (condition_state IS NULL OR condition_state IN ('good','fair','damaged','incomplete')),
  CONSTRAINT chk_asset_offboarding_destination CHECK (destination IS NULL OR destination IN ('available','maintenance','retired'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
