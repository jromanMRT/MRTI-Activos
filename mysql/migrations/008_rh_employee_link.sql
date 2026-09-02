-- ============================================================
-- 008: Vínculo directo con un empleado de RH sin requerir cuenta de Core
--
-- portal_user_id/tercero_id ya cubrían "empleado con sesión de Core" y
-- "externo sin ficha en RH". Faltaba el caso intermedio, muy común en la
-- práctica: un empleado real, con ficha en RH, que todavía no tiene correo
-- corporativo vinculado a Core. `rh_employee_id` referencia `employees.id`
-- de RH por convención (mismo patrón que `device.asset_id` en MRTI-Obs
-- apuntando al `asset_uid` de Activos) -- sin llave foránea entre bases.
--
-- Cuando ese empleado obtenga su cuenta de Core más adelante, el activo
-- puede re-conciliarse hacia `portal_user_id` (fuera de esta migración).
-- ============================================================

USE mrti_activos;

SET @has_rh_employee_column = (
  SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE() AND table_name = 'activos' AND column_name = 'rh_employee_id'
);
SET @rh_employee_column_sql = IF(@has_rh_employee_column = 0,
  'ALTER TABLE activos ADD COLUMN rh_employee_id INT UNSIGNED NULL AFTER tercero_id',
  'SELECT 1');
PREPARE stmt FROM @rh_employee_column_sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_rh_employee_index = (
  SELECT COUNT(*) FROM information_schema.statistics
   WHERE table_schema = DATABASE() AND table_name = 'activos' AND index_name = 'idx_activos_rh_employee'
);
SET @rh_employee_index_sql = IF(@has_rh_employee_index = 0,
  'ALTER TABLE activos ADD KEY idx_activos_rh_employee (rh_employee_id)',
  'SELECT 1');
PREPARE stmt FROM @rh_employee_index_sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Reemplaza el CHECK "a lo más uno de portal_user_id/tercero_id" por
-- "a lo más uno de los tres" -- se nombra distinto (_v2) para poder
-- comprobar si ya se aplicó sin tener que comparar el texto del CHECK.
SET @has_holder_check_v2 = (
  SELECT COUNT(*) FROM information_schema.table_constraints
   WHERE constraint_schema = DATABASE() AND table_name = 'activos'
     AND constraint_name = 'chk_activos_holder_v2' AND constraint_type = 'CHECK'
);
SET @has_old_holder_check = (
  SELECT COUNT(*) FROM information_schema.table_constraints
   WHERE constraint_schema = DATABASE() AND table_name = 'activos'
     AND constraint_name = 'chk_activos_holder' AND constraint_type = 'CHECK'
);
SET @drop_old_holder_check_sql = IF(@has_holder_check_v2 = 0 AND @has_old_holder_check > 0,
  'ALTER TABLE activos DROP CHECK chk_activos_holder',
  'SELECT 1');
PREPARE stmt FROM @drop_old_holder_check_sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @add_holder_check_v2_sql = IF(@has_holder_check_v2 = 0,
  'ALTER TABLE activos ADD CONSTRAINT chk_activos_holder_v2 CHECK (
     (portal_user_id IS NULL) + (tercero_id IS NULL) + (rh_employee_id IS NULL) >= 2
   )',
  'SELECT 1');
PREPARE stmt FROM @add_holder_check_v2_sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Mismo tratamiento en el historial de asignaciones.
SET @has_asig_rh_employee_column = (
  SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE() AND table_name = 'activo_asignaciones' AND column_name = 'rh_employee_id'
);
SET @asig_rh_employee_column_sql = IF(@has_asig_rh_employee_column = 0,
  'ALTER TABLE activo_asignaciones ADD COLUMN rh_employee_id INT UNSIGNED NULL AFTER tercero_id',
  'SELECT 1');
PREPARE stmt FROM @asig_rh_employee_column_sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_asig_rh_employee_index = (
  SELECT COUNT(*) FROM information_schema.statistics
   WHERE table_schema = DATABASE() AND table_name = 'activo_asignaciones' AND index_name = 'idx_asignaciones_rh_employee'
);
SET @asig_rh_employee_index_sql = IF(@has_asig_rh_employee_index = 0,
  'ALTER TABLE activo_asignaciones ADD KEY idx_asignaciones_rh_employee (rh_employee_id, unassigned_at)',
  'SELECT 1');
PREPARE stmt FROM @asig_rh_employee_index_sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_asig_holder_check_v2 = (
  SELECT COUNT(*) FROM information_schema.table_constraints
   WHERE constraint_schema = DATABASE() AND table_name = 'activo_asignaciones'
     AND constraint_name = 'chk_asignaciones_holder_v2' AND constraint_type = 'CHECK'
);
SET @has_old_asig_holder_check = (
  SELECT COUNT(*) FROM information_schema.table_constraints
   WHERE constraint_schema = DATABASE() AND table_name = 'activo_asignaciones'
     AND constraint_name = 'chk_asignaciones_holder' AND constraint_type = 'CHECK'
);
SET @drop_old_asig_holder_check_sql = IF(@has_asig_holder_check_v2 = 0 AND @has_old_asig_holder_check > 0,
  'ALTER TABLE activo_asignaciones DROP CHECK chk_asignaciones_holder',
  'SELECT 1');
PREPARE stmt FROM @drop_old_asig_holder_check_sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @add_asig_holder_check_v2_sql = IF(@has_asig_holder_check_v2 = 0,
  'ALTER TABLE activo_asignaciones ADD CONSTRAINT chk_asignaciones_holder_v2 CHECK (
     (portal_user_id IS NULL) + (tercero_id IS NULL) + (rh_employee_id IS NULL) = 2
   )',
  'SELECT 1');
PREPARE stmt FROM @add_asig_holder_check_v2_sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
