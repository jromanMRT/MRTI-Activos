-- Fecha canónica de vencimiento de Microsoft 365. Los campos históricos
-- fecha_suscripcion + anos_suscripcion se conservan como respaldo compatible.
SET @ddl = IF(
  EXISTS(
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = DATABASE()
       AND table_name = 'activos'
       AND column_name = 'ms_vencimiento'
  ),
  'SELECT 1',
  'ALTER TABLE activos ADD COLUMN ms_vencimiento DATE NULL AFTER anos_suscripcion'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
