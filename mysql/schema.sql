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
  correo_nombre VARCHAR(80) NULL,
  correo_depto VARCHAR(80) NULL,
  correo_puesto VARCHAR(60) NULL,
  migrado VARCHAR(10) NULL,
  correo_baja VARCHAR(10) NULL,
  av_licencia VARCHAR(80) NULL,
  av_caducidad DATETIME NULL,
  av_team VARCHAR(80) NULL,
  av_comentario VARCHAR(80) NULL,
  KEY idx_activos_tipo (tipo),
  KEY idx_activos_estado (estado),
  KEY idx_activos_unidad (unidad),
  KEY idx_activos_empresa (empresa),
  KEY idx_activos_usuario (usuario_asignado)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
