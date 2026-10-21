-- 031: Catálogo de teléfonos celulares gestionados en MRTI Activos.
USE mrti_activos;

CREATE TABLE IF NOT EXISTS telefonos_celulares (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  numero_linea VARCHAR(30) NULL,
  usuario VARCHAR(120) NULL,
  marca VARCHAR(60) NULL,
  modelo VARCHAR(80) NOT NULL,
  imei VARCHAR(30) NULL,
  numero_serie VARCHAR(60) NULL,
  operador VARCHAR(40) NULL,
  plan_datos VARCHAR(80) NULL,
  importe_mes DECIMAL(10,2) NULL,
  estado VARCHAR(30) NOT NULL DEFAULT 'Disponible',
  unidad VARCHAR(80) NULL,
  departamento VARCHAR(80) NULL,
  fecha_entrega DATE NULL,
  comentario TEXT NULL,
  record_origin VARCHAR(20) NOT NULL DEFAULT 'local',
  created_by_user_id CHAR(36) NULL,
  archived_at DATETIME NULL,
  archived_by CHAR(36) NULL,
  locally_edited_at DATETIME NULL,
  locally_edited_by CHAR(36) NULL,
  synced_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  sap_synced_at DATETIME NULL,
  sap_sync_error TEXT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
