-- ============================================================
-- MRTI Activos — Esquema MySQL 8
--
-- Uso:
--   mysql -u root -p < mysql/schema.sql
--
-- Crea la base de datos `mrti_activos` con la tabla de inventario
-- de activos de TI. No incluye contraseñas por diseño: los campos
-- win_password, ms_password, password_mrt y password_corporativo
-- no existen en este esquema.
-- ============================================================

CREATE DATABASE IF NOT EXISTS mrti_activos
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE mrti_activos;

CREATE TABLE IF NOT EXISTS activos (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  asset_uid CHAR(36) NOT NULL,
  center_code VARCHAR(20) NOT NULL,
  cod_activo_fijo VARCHAR(40) NULL,
  tipo VARCHAR(30) NULL,
  descripcion VARCHAR(255) NULL,
  marca VARCHAR(40) NULL,
  modelo VARCHAR(60) NULL,
  service_tag VARCHAR(40) NULL,
  numero_serie VARCHAR(60) NULL,
  empresa VARCHAR(60) NULL,
  id_empleado VARCHAR(20) NULL,
  usuario_asignado VARCHAR(80) NULL,
  unidad VARCHAR(60) NULL,
  area VARCHAR(80) NULL,
  physical_area_id CHAR(36) NULL,
  cel_empleado VARCHAR(20) NULL,
  cuenta_contable VARCHAR(30) NULL,
  expediente VARCHAR(60) NULL,
  requisicion VARCHAR(30) NULL,
  orden_compra VARCHAR(30) NULL,
  factura VARCHAR(30) NULL,
  cuenta_microsoft VARCHAR(120) NULL,
  software_incluido VARCHAR(255) NULL,
  version VARCHAR(20) NULL,
  esp_tec TEXT NULL,
  active VARCHAR(10) NOT NULL DEFAULT 'tYES',
  estado VARCHAR(30) NOT NULL DEFAULT 'Activo',
  bitlocker VARCHAR(20) NULL,
  baja_empleado VARCHAR(20) NULL,
  baja_equipo VARCHAR(10) NULL,
  revisada VARCHAR(10) NULL,
  ex_propietario VARCHAR(120) NULL,
  fecha_compra DATETIME NULL,
  garantia_hasta DATE NULL,
  valid_from DATETIME NULL,
  valid_to DATETIME NULL,
  notas TEXT NULL,
  creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  win_cuenta VARCHAR(60) NULL,
  win_usuario VARCHAR(60) NULL,
  win_comentario VARCHAR(120) NULL,
  ms_cuenta VARCHAR(80) NULL,
  ms_usuario VARCHAR(80) NULL,
  ms_licencia VARCHAR(80) NULL,
  ms_suscripcion VARCHAR(60) NULL,
  fecha_suscripcion DATETIME NULL,
  anos_suscripcion TINYINT UNSIGNED NULL,
  db_cuenta VARCHAR(60) NULL,
  db_usuario VARCHAR(80) NULL,
  db_licencia VARCHAR(80) NULL,
  correo_mrt VARCHAR(60) NULL,
  correo_corporativo VARCHAR(60) NULL,
  portal_user_id CHAR(36) NULL,
  correo_nombre VARCHAR(80) NULL,
  correo_depto VARCHAR(80) NULL,
  correo_puesto VARCHAR(60) NULL,
  migrado VARCHAR(10) NULL,
  correo_baja VARCHAR(10) NULL,
  av_licencia VARCHAR(80) NULL,
  av_caducidad DATETIME NULL,
  av_team VARCHAR(80) NULL,
  av_comentario VARCHAR(80) NULL,
  UNIQUE KEY uq_activos_asset_uid (asset_uid),
  KEY idx_activos_tipo (tipo),
  KEY idx_activos_estado (estado),
  KEY idx_activos_unidad (unidad),
  KEY idx_activos_empresa (empresa),
  KEY idx_activos_usuario (usuario_asignado),
  KEY idx_activos_portal_user (portal_user_id),
  KEY idx_activos_physical_area (physical_area_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
  CONSTRAINT fk_asignaciones_activo FOREIGN KEY (asset_uid) REFERENCES activos(asset_uid) ON DELETE RESTRICT
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
  CONSTRAINT fk_mantenimientos_activo FOREIGN KEY (asset_uid) REFERENCES activos(asset_uid) ON DELETE RESTRICT
);
