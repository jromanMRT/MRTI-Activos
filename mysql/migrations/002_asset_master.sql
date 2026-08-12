-- MRTI Activos pasa a ser la fuente maestra patrimonial. El entero `id` se
-- conserva para las rutas existentes; `asset_uid` es el identificador estable
-- que pueden guardar otros módulos sin crear llaves foráneas entre bases.
ALTER TABLE activos
  ADD COLUMN asset_uid CHAR(36) NULL AFTER id,
  ADD COLUMN physical_area_id CHAR(36) NULL AFTER area,
  ADD COLUMN garantia_hasta DATE NULL AFTER fecha_compra;

UPDATE activos SET asset_uid = UUID() WHERE asset_uid IS NULL;

ALTER TABLE activos
  MODIFY asset_uid CHAR(36) NOT NULL,
  ADD UNIQUE KEY uq_activos_asset_uid (asset_uid),
  ADD KEY idx_activos_physical_area (physical_area_id);

CREATE TABLE IF NOT EXISTS activo_asignaciones (
  id CHAR(36) NOT NULL PRIMARY KEY,
  asset_uid CHAR(36) NOT NULL,
  portal_user_id CHAR(36) NOT NULL,
  assigned_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  unassigned_at DATETIME NULL,
  notes TEXT NULL,
  created_by CHAR(36) NULL,
  KEY idx_asignaciones_asset (asset_uid, unassigned_at),
  KEY idx_asignaciones_user (portal_user_id, unassigned_at),
  CONSTRAINT fk_asignaciones_activo
    FOREIGN KEY (asset_uid) REFERENCES activos(asset_uid) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS activo_mantenimientos (
  id CHAR(36) NOT NULL PRIMARY KEY,
  asset_uid CHAR(36) NOT NULL,
  tipo VARCHAR(80) NOT NULL,
  estado VARCHAR(30) NOT NULL DEFAULT 'Programado',
  fecha_inicio DATETIME NULL,
  fecha_fin DATETIME NULL,
  proveedor VARCHAR(120) NULL,
  costo DECIMAL(12,2) NULL,
  notes TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_mantenimientos_asset (asset_uid, fecha_inicio),
  CONSTRAINT fk_mantenimientos_activo
    FOREIGN KEY (asset_uid) REFERENCES activos(asset_uid) ON DELETE RESTRICT
);
