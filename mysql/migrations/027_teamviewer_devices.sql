-- Accesos TeamViewer de los equipos. Activos es el dueño de este dato; el
-- equipo se referencia por asset_uid (estable), nunca por id numérico. La
-- contraseña se guarda cifrada con CREDENTIALS_ENCRYPTION_KEY (igual que
-- sap_nvr/sap_passwords) y solo se revela a administradores con auditoría.
CREATE TABLE IF NOT EXISTS teamviewer_devices (
  id CHAR(36) NOT NULL,
  teamviewer_id VARCHAR(20) NOT NULL,
  alias VARCHAR(180) NULL,
  password_encrypted TEXT NULL,
  asset_uid CHAR(36) NULL,
  notes TEXT NULL,
  created_by CHAR(36) NULL,
  updated_by CHAR(36) NULL,
  password_updated_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_teamviewer_devices_tv_id (teamviewer_id),
  UNIQUE KEY uq_teamviewer_devices_asset (asset_uid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
