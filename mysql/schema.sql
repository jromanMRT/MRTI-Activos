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
  ms_vencimiento DATE NULL,
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
  sap_synced_at DATETIME NULL,
  sap_sync_error VARCHAR(255) NULL,
  UNIQUE KEY uq_activos_asset_uid (asset_uid),
  KEY idx_activos_tipo (tipo),
  KEY idx_activos_estado (estado),
  KEY idx_activos_unidad (unidad),
  KEY idx_activos_empresa (empresa),
  KEY idx_activos_usuario (usuario_asignado),
  KEY idx_activos_portal_user (portal_user_id),
  KEY idx_activos_physical_area (physical_area_id),
  KEY idx_activos_sap_sync_error (sap_sync_error(1))
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

-- Seguimiento operativo de devoluciones por baja laboral. La asignación se
-- mantiene abierta mientras el equipo esté pendiente o no devuelto.
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

CREATE TABLE IF NOT EXISTS employee_offboarding_cases (
  id CHAR(36) NOT NULL PRIMARY KEY,
  reference_type VARCHAR(20) NOT NULL,
  reference_value VARCHAR(40) NOT NULL,
  employee_name VARCHAR(160) NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'open',
  tasks_json JSON NOT NULL,
  notes TEXT NULL,
  completed_at DATETIME NULL,
  completed_by_user_id CHAR(36) NULL,
  completed_by_name VARCHAR(160) NULL,
  updated_by_user_id CHAR(36) NULL,
  updated_by_name VARCHAR(160) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_employee_offboarding_reference (reference_type, reference_value, status),
  KEY idx_employee_offboarding_status (status, updated_at),
  CONSTRAINT chk_employee_offboarding_reference CHECK (reference_type IN ('rh_employee','core_user')),
  CONSTRAINT chk_employee_offboarding_case_status CHECK (status IN ('open','completed'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- Catálogos sincronizados desde SAP con altas locales aisladas por sap_id NULL
-- (ver migraciones 005 y 010).
-- ============================================================
CREATE TABLE IF NOT EXISTS sap_componentes (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  sap_id INT UNSIGNED NULL,
  record_origin VARCHAR(20) NOT NULL DEFAULT 'sap',
  created_by_user_id CHAR(36) NULL,
  center_code VARCHAR(50) NULL,
  code VARCHAR(20) NULL,
  nombre VARCHAR(200) NULL,
  tipo VARCHAR(100) NULL,
  marca VARCHAR(100) NULL,
  modelo VARCHAR(150) NULL,
  serial_service_tag VARCHAR(150) NULL,
  firmware VARCHAR(100) NULL,
  ip_address VARCHAR(50) NULL,
  mac_address VARCHAR(50) NULL,
  hostname VARCHAR(100) NULL,
  unidad VARCHAR(100) NULL,
  departamento VARCHAR(100) NULL,
  usuario VARCHAR(200) NULL,
  contabilidad VARCHAR(50) NULL,
  orden_compra VARCHAR(50) NULL,
  comentario VARCHAR(300) NULL,
  sap_creado_en DATETIME NULL,
  sap_actualizado_en DATETIME NULL,
  archived_at DATETIME NULL,
  archived_by CHAR(36) NULL,
  synced_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_sap_componentes_id (sap_id),
  KEY idx_sap_componentes_center_code (center_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sap_impresoras (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  sap_id INT UNSIGNED NULL,
  record_origin VARCHAR(20) NOT NULL DEFAULT 'sap',
  created_by_user_id CHAR(36) NULL,
  usuario VARCHAR(200) NULL,
  ubicacion VARCHAR(100) NULL,
  ip_address VARCHAR(50) NULL,
  mac_address VARCHAR(50) NULL,
  hostname VARCHAR(100) NULL,
  modelo VARCHAR(200) NULL,
  numero_serie VARCHAR(100) NULL,
  conteo_paginas INT NULL,
  comentario VARCHAR(300) NULL,
  sap_creado_en DATETIME NULL,
  sap_actualizado_en DATETIME NULL,
  archived_at DATETIME NULL,
  archived_by CHAR(36) NULL,
  synced_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_sap_impresoras_id (sap_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sap_nvr (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  sap_id INT UNSIGNED NULL,
  record_origin VARCHAR(20) NOT NULL DEFAULT 'sap',
  created_by_user_id CHAR(36) NULL,
  alias VARCHAR(100) NULL,
  device_domain VARCHAR(100) NULL,
  device_serial VARCHAR(100) NULL,
  ip_port VARCHAR(100) NULL,
  status VARCHAR(20) NULL,
  clave_cifrado_encrypted TEXT NULL,
  codigo_verificacion_encrypted TEXT NULL,
  usuario VARCHAR(50) NULL,
  password_encrypted TEXT NULL,
  acceso_local VARCHAR(200) NULL,
  localidad VARCHAR(100) NULL,
  ubicacion VARCHAR(100) NULL,
  sap_creado_en DATETIME NULL,
  sap_actualizado_en DATETIME NULL,
  archived_at DATETIME NULL,
  archived_by CHAR(36) NULL,
  synced_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_sap_nvr_id (sap_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sap_passwords (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  sap_id INT UNSIGNED NULL,
  record_origin VARCHAR(20) NOT NULL DEFAULT 'sap',
  created_by_user_id CHAR(36) NULL,
  categoria VARCHAR(100) NULL,
  subcategoria VARCHAR(100) NULL,
  ip VARCHAR(50) NULL,
  direccion VARCHAR(100) NULL,
  usuario VARCHAR(150) NULL,
  password_encrypted TEXT NULL,
  comentario VARCHAR(300) NULL,
  sap_creado_en DATETIME NULL,
  sap_actualizado_en DATETIME NULL,
  archived_at DATETIME NULL,
  archived_by CHAR(36) NULL,
  synced_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_sap_passwords_id (sap_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sap_starlink (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  sap_id INT UNSIGNED NULL,
  record_origin VARCHAR(20) NOT NULL DEFAULT 'sap',
  created_by_user_id CHAR(36) NULL,
  correo_cuenta VARCHAR(200) NULL,
  ubicacion VARCHAR(200) NULL,
  id_starlink VARCHAR(100) NULL,
  version_equipo VARCHAR(50) NULL,
  importe_mes DECIMAL(10,4) NULL,
  dia_corte VARCHAR(20) NULL,
  suscripcion VARCHAR(100) NULL,
  cliente VARCHAR(100) NULL,
  comentario VARCHAR(200) NULL,
  sap_creado_en DATETIME NULL,
  sap_actualizado_en DATETIME NULL,
  archived_at DATETIME NULL,
  archived_by CHAR(36) NULL,
  synced_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_sap_starlink_id (sap_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sap_fortigate (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  sap_id INT UNSIGNED NULL,
  record_origin VARCHAR(20) NOT NULL DEFAULT 'sap',
  created_by_user_id CHAR(36) NULL,
  software VARCHAR(200) NULL,
  numero_serie VARCHAR(100) NULL,
  proyecto VARCHAR(100) NULL,
  fecha_expira DATE NULL,
  comentario VARCHAR(300) NULL,
  sap_creado_en DATETIME NULL,
  sap_actualizado_en DATETIME NULL,
  archived_at DATETIME NULL,
  archived_by CHAR(36) NULL,
  synced_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_sap_fortigate_id (sap_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sap_dominios (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  sap_id INT UNSIGNED NULL,
  record_origin VARCHAR(20) NOT NULL DEFAULT 'sap',
  created_by_user_id CHAR(36) NULL,
  dominio VARCHAR(100) NULL,
  servicios VARCHAR(200) NULL,
  fecha_expira DATE NULL,
  status VARCHAR(50) NULL,
  comentario VARCHAR(300) NULL,
  sap_creado_en DATETIME NULL,
  sap_actualizado_en DATETIME NULL,
  archived_at DATETIME NULL,
  archived_by CHAR(36) NULL,
  synced_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_sap_dominios_id (sap_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sap_mantenimientos (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  sap_id INT UNSIGNED NULL,
  record_origin VARCHAR(20) NOT NULL DEFAULT 'sap',
  created_by_user_id CHAR(36) NULL,
  center_code VARCHAR(50) NULL,
  fecha_servicio DATE NULL,
  fecha_fin DATE NULL,
  tipo_servicio VARCHAR(80) NULL,
  descripcion TEXT NULL,
  tecnico VARCHAR(150) NULL,
  proveedor VARCHAR(150) NULL,
  costo DECIMAL(12,2) NULL,
  numero_ticket VARCHAR(100) NULL,
  estado VARCHAR(30) NULL,
  garantia_hasta DATE NULL,
  observaciones TEXT NULL,
  creado_por VARCHAR(150) NULL,
  archived_at DATETIME NULL,
  archived_by CHAR(36) NULL,
  synced_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_sap_mantenimientos_id (sap_id),
  KEY idx_sap_mantenimientos_center_code (center_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sap_mantenimiento_componentes (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  sap_id INT UNSIGNED NOT NULL,
  sap_mantenimiento_id INT UNSIGNED NULL,
  tipo_componente VARCHAR(100) NULL,
  descripcion VARCHAR(300) NULL,
  marca VARCHAR(100) NULL,
  modelo VARCHAR(150) NULL,
  numero_serie VARCHAR(150) NULL,
  accion VARCHAR(50) NULL,
  costo DECIMAL(12,2) NULL,
  synced_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_sap_mant_comp_id (sap_id),
  KEY idx_sap_mant_comp_mant (sap_mantenimiento_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sap_unidades (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  sap_id INT UNSIGNED NULL,
  record_origin VARCHAR(20) NOT NULL DEFAULT 'sap',
  created_by_user_id CHAR(36) NULL,
  nombre VARCHAR(150) NULL,
  activa TINYINT(1) NULL,
  orden INT NULL,
  archived_at DATETIME NULL,
  archived_by CHAR(36) NULL,
  synced_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_sap_unidades_id (sap_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sap_config_alertas (
  clave VARCHAR(30) NOT NULL PRIMARY KEY,
  nombre VARCHAR(80) NULL,
  dias_aviso INT NULL,
  activo TINYINT(1) NULL,
  sap_actualizado_en DATETIME NULL,
  synced_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sap_documentos (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  sap_id INT UNSIGNED NOT NULL,
  center_code VARCHAR(50) NULL,
  nombre VARCHAR(255) NULL,
  tipo VARCHAR(50) NULL,
  archivo VARCHAR(500) NULL,
  tamano INT NULL,
  subido_por VARCHAR(150) NULL,
  sap_creado_en DATETIME NULL,
  local_storage_path VARCHAR(500) NULL,
  archived_at DATETIME NULL,
  archived_by CHAR(36) NULL,
  synced_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_sap_documentos_id (sap_id),
  KEY idx_sap_documentos_center_code (center_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sap_asset_duplicates (
  center_code VARCHAR(50) NOT NULL PRIMARY KEY,
  source_ids_json TEXT NOT NULL,
  snapshot_json LONGTEXT NOT NULL,
  detected_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at DATETIME NULL,
  KEY idx_sap_asset_duplicates_resolved (resolved_at, last_seen_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
