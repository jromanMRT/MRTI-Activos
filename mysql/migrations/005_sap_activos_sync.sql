-- ============================================================
-- 005: Integración con SAP (ActivosTI, SQL Server)
--
-- `activos` gana dos columnas para el push en vivo hacia SAP (ver
-- server/src/integrations/sapClient.js y sapSync.js): cuándo se sincronizó
-- por última vez y, si el último intento falló, el error -- mientras
-- sap_sync_error no sea NULL, el job periódico no sobreescribe esa fila con
-- un pull, para no perder un cambio local que aún no llegó a SAP.
--
-- El resto de tablas (`sap_*`) son espejos de solo lectura de los otros 11
-- dominios que maneja la plataforma ti-assets/SAP (Componentes, Impresoras,
-- NVR, Passwords de red, Starlink, FortiGate, Dominios, Mantenimientos,
-- MantenimientoComponentes, Unidades, ConfigAlertas, Documentos) -- sin UI
-- todavía, el objetivo de esta fase es que el dato exista aquí y no se
-- pierda nada; dónde vive cada uno en la app se decide después. `sap_id` es
-- el id original en SQL Server, único, es la llave de upsert del sync.
--
-- Las columnas de contraseña de SAP (CuentaWindows/Microsoft/DropBox/
-- Correo) nunca se traen -- ni siquiera aquí -- porque `activos` ya excluía
-- esas columnas por diseño. NVR.password y Passwords.password sí se traen,
-- pero cifradas (AES-256-GCM, ver server/src/integrations/credentialCrypto.js)
-- -- decisión explícita del usuario, no en texto plano.
-- ============================================================

USE mrti_activos;

-- MySQL no admite volver a agregar columnas/índices existentes. Estas
-- guardas permiten ejecutar la migración sobre instalaciones donde la
-- primera copia se aplicó manualmente antes de registrar schema_migrations.
SET @add_sap_synced_at = (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE activos ADD COLUMN sap_synced_at DATETIME NULL',
    'SELECT 1')
  FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'activos' AND column_name = 'sap_synced_at'
);
PREPARE stmt FROM @add_sap_synced_at; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @add_sap_sync_error = (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE activos ADD COLUMN sap_sync_error VARCHAR(255) NULL',
    'SELECT 1')
  FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'activos' AND column_name = 'sap_sync_error'
);
PREPARE stmt FROM @add_sap_sync_error; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @add_sap_sync_index = (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE activos ADD KEY idx_activos_sap_sync_error (sap_sync_error(1))',
    'SELECT 1')
  FROM information_schema.statistics
  WHERE table_schema = DATABASE() AND table_name = 'activos' AND index_name = 'idx_activos_sap_sync_error'
);
PREPARE stmt FROM @add_sap_sync_index; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS sap_componentes (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  sap_id INT UNSIGNED NOT NULL,
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
  synced_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_sap_componentes_id (sap_id),
  KEY idx_sap_componentes_center_code (center_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sap_impresoras (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  sap_id INT UNSIGNED NOT NULL,
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
  synced_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_sap_impresoras_id (sap_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Todas las credenciales se cifran con AES-256-GCM; la aplicación nunca
-- expone estas columnas en listados y sólo un administrador puede pedir su
-- descifrado puntual.
CREATE TABLE IF NOT EXISTS sap_nvr (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  sap_id INT UNSIGNED NOT NULL,
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
  synced_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_sap_nvr_id (sap_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sap_passwords (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  sap_id INT UNSIGNED NOT NULL,
  categoria VARCHAR(100) NULL,
  subcategoria VARCHAR(100) NULL,
  ip VARCHAR(50) NULL,
  direccion VARCHAR(100) NULL,
  usuario VARCHAR(150) NULL,
  password_encrypted TEXT NULL,
  comentario VARCHAR(300) NULL,
  sap_creado_en DATETIME NULL,
  sap_actualizado_en DATETIME NULL,
  synced_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_sap_passwords_id (sap_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sap_starlink (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  sap_id INT UNSIGNED NOT NULL,
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
  synced_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_sap_starlink_id (sap_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sap_fortigate (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  sap_id INT UNSIGNED NOT NULL,
  software VARCHAR(200) NULL,
  numero_serie VARCHAR(100) NULL,
  proyecto VARCHAR(100) NULL,
  fecha_expira DATE NULL,
  comentario VARCHAR(300) NULL,
  sap_creado_en DATETIME NULL,
  sap_actualizado_en DATETIME NULL,
  synced_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_sap_fortigate_id (sap_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sap_dominios (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  sap_id INT UNSIGNED NOT NULL,
  dominio VARCHAR(100) NULL,
  servicios VARCHAR(200) NULL,
  fecha_expira DATE NULL,
  status VARCHAR(50) NULL,
  comentario VARCHAR(300) NULL,
  sap_creado_en DATETIME NULL,
  sap_actualizado_en DATETIME NULL,
  synced_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_sap_dominios_id (sap_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sap_mantenimientos (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  sap_id INT UNSIGNED NOT NULL,
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
  sap_id INT UNSIGNED NOT NULL,
  nombre VARCHAR(150) NULL,
  activa TINYINT(1) NULL,
  orden INT NULL,
  synced_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_sap_unidades_id (sap_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Sin `id` propio en SAP -- `clave` ('antivirus'/'o365'/'fortigate') es su
-- llave natural, se usa tal cual como PK aquí.
CREATE TABLE IF NOT EXISTS sap_config_alertas (
  clave VARCHAR(30) NOT NULL PRIMARY KEY,
  nombre VARCHAR(80) NULL,
  dias_aviso INT NULL,
  activo TINYINT(1) NULL,
  sap_actualizado_en DATETIME NULL,
  synced_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Solo metadatos: el PDF real vive como archivo en el disco del servidor
-- SAP y hoy no hay forma de traerlo (sin acceso de Windows al recurso
-- compartido) -- `archivo` guarda el nombre de archivo original para
-- cuando ese acceso exista.
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
  synced_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_sap_documentos_id (sap_id),
  KEY idx_sap_documentos_center_code (center_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
