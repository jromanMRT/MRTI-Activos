-- 028: checklist de preparación de equipos nuevos antes de entregarlos.
-- La plantilla (asset_setup_checklist_items) es editable desde la interfaz.
-- Cada checklist de un activo copia la etiqueta de cada paso al iniciarse
-- (entries.label), así que editar o quitar un paso de la plantilla no
-- reescribe el registro de lo que ya se hizo en un equipo.
CREATE TABLE IF NOT EXISTS asset_setup_checklist_items (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  seed_key VARCHAR(60) NULL,
  section VARCHAR(80) NOT NULL,
  label VARCHAR(255) NOT NULL,
  help_text VARCHAR(500) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_by_name VARCHAR(160) NULL,
  updated_by_name VARCHAR(160) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_setup_items_seed (seed_key),
  KEY idx_setup_items_order (is_active, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS asset_setup_checklists (
  id CHAR(36) NOT NULL,
  asset_uid CHAR(36) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'open',
  notes TEXT NULL,
  started_by_user_id CHAR(36) NULL,
  started_by_name VARCHAR(160) NULL,
  completed_at DATETIME NULL,
  completed_by_user_id CHAR(36) NULL,
  completed_by_name VARCHAR(160) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_setup_checklists_asset (asset_uid, created_at),
  KEY idx_setup_checklists_status (status, updated_at),
  CONSTRAINT chk_setup_checklist_status CHECK (status IN ('open','completed'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS asset_setup_checklist_entries (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  checklist_id CHAR(36) NOT NULL,
  item_id INT UNSIGNED NULL,
  section VARCHAR(80) NOT NULL,
  label VARCHAR(255) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  note VARCHAR(500) NULL,
  done_at DATETIME NULL,
  done_by_user_id CHAR(36) NULL,
  done_by_name VARCHAR(160) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_setup_entries_item (checklist_id, item_id),
  KEY idx_setup_entries_checklist (checklist_id, sort_order),
  CONSTRAINT fk_setup_entries_checklist FOREIGN KEY (checklist_id) REFERENCES asset_setup_checklists (id) ON DELETE CASCADE,
  CONSTRAINT chk_setup_entry_status CHECK (status IN ('pending','done','na'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Plantilla inicial. INSERT IGNORE por seed_key: volver a correr la
-- migración no duplica pasos ni revive los que se desactivaron.
INSERT IGNORE INTO asset_setup_checklist_items (seed_key, section, label, help_text, sort_order) VALUES
  ('windows_updates', 'Sistema y seguridad', 'Actualizaciones de Windows completas', 'Incluye opcionales de drivers; repetir hasta que no quede ninguna.', 10),
  ('vendor_drivers', 'Sistema y seguridad', 'Drivers, BIOS y software del fabricante actualizados', 'Dell Command Update, Lenovo Vantage o HP Support Assistant.', 20),
  ('bitlocker', 'Sistema y seguridad', 'BitLocker activado y clave de recuperación guardada en Activos', NULL, 30),
  ('bios_password', 'Sistema y seguridad', 'Contraseña de BIOS y arranque solo desde disco interno', NULL, 40),
  ('local_admin', 'Sistema y seguridad', 'Administrador local con contraseña propia; usuario sin derechos de administrador', NULL, 50),
  ('computer_name', 'Sistema y seguridad', 'Nombre del equipo igual al código de inventario', 'Ej. TI-00280.', 60),
  ('workgroup', 'Sistema y seguridad', 'Grupo de trabajo / dominio configurado', NULL, 70),
  ('antivirus', 'Sistema y seguridad', 'Antivirus instalado, activado con licencia y actualizado', NULL, 80),
  ('firewall', 'Sistema y seguridad', 'Firewall de Windows activo', NULL, 90),
  ('lock_screen', 'Sistema y seguridad', 'Bloqueo automático de pantalla (5–10 min)', NULL, 100),
  ('power_plan', 'Sistema y seguridad', 'Plan de energía y comportamiento de la tapa', NULL, 110),
  ('debloat', 'Sistema y seguridad', 'Juegos, apps innecesarias e iconos no utilizados eliminados', NULL, 120),
  ('wifi', 'Red y accesos', 'Wi-Fi corporativo configurado', NULL, 200),
  ('vpn', 'Red y accesos', 'VPN (FortiClient) configurada y probada', NULL, 210),
  ('printers', 'Red y accesos', 'Impresoras y escáner del área instalados; impresión de prueba', NULL, 220),
  ('network_drives', 'Red y accesos', 'Unidades o carpetas de red mapeadas', NULL, 230),
  ('teamviewer', 'Red y accesos', 'TeamViewer con acceso desatendido; ID y contraseña registrados en Activos', NULL, 240),
  ('windows_account', 'Cuentas del usuario', 'Cuenta de Windows del usuario creada y probada', NULL, 300),
  ('office', 'Cuentas del usuario', 'Office con sesión del usuario y licencia activada', NULL, 310),
  ('email', 'Cuentas del usuario', 'Correo corporativo configurado con firma institucional', NULL, 320),
  ('cloud_sync', 'Cuentas del usuario', 'OneDrive / Dropbox con sesión y sincronizando', 'Activar copia de Escritorio y Documentos si se usa OneDrive.', 330),
  ('teams', 'Cuentas del usuario', 'Teams con sesión; micrófono y cámara probados', NULL, 340),
  ('mfa', 'Cuentas del usuario', 'Autenticación en dos pasos (MFA) activada', NULL, 350),
  ('browsers', 'Software base', 'Navegador con el portal MRTI en favoritos', NULL, 400),
  ('pdf', 'Software base', 'Lector de PDF', NULL, 410),
  ('zip', 'Software base', '7-Zip', NULL, 420),
  ('role_software', 'Software base', 'Software propio del puesto con licencia y accesos directos', 'CONTPAQi, SAP, AutoCAD, etc.', 430),
  ('default_apps', 'Software base', 'Programas predeterminados (PDF, correo, navegador)', NULL, 440),
  ('locale', 'Software base', 'Idioma, teclado (Español – México) y zona horaria', NULL, 450),
  ('asset_record', 'Registro en Activos', 'Activo con serie, service tag, modelo y fecha de compra', NULL, 500),
  ('asset_assignment', 'Registro en Activos', 'Activo asignado al empleado', NULL, 510),
  ('asset_links', 'Registro en Activos', 'Licencia antivirus y TeamViewer vinculados', NULL, 520),
  ('asset_credentials', 'Registro en Activos', 'Credenciales guardadas en la ficha del activo', NULL, 530),
  ('remission', 'Registro en Activos', 'Remisión impresa, firmada y subida a Documentos', NULL, 540),
  ('label', 'Registro en Activos', 'Etiqueta física con el código TI', NULL, 550),
  ('user_login', 'Entrega al usuario', 'El usuario inicia sesión y cambia su contraseña', NULL, 600),
  ('user_apps', 'Entrega al usuario', 'El usuario abre correo, Teams, nube y el sistema de su puesto', NULL, 610),
  ('user_print', 'Entrega al usuario', 'El usuario imprime una prueba', NULL, 620),
  ('remote_test', 'Entrega al usuario', 'Prueba de conexión por TeamViewer', NULL, 630),
  ('support_info', 'Entrega al usuario', 'Explicar cómo pedir soporte (Tickets) y dónde guardar archivos', NULL, 640);
