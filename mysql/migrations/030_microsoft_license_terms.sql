-- Modalidad explícita para distinguir suscripciones de licencias perpetuas.
-- ms_vencimiento se conserva como espejo compatible, siempre derivado.
USE mrti_activos;

SET @add_mode = IF(
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'activos' AND column_name = 'ms_license_mode'),
  'SELECT 1',
  "ALTER TABLE activos ADD COLUMN ms_license_mode ENUM('subscription','perpetual') NULL AFTER ms_suscripcion"
);
PREPARE stmt FROM @add_mode; EXECUTE stmt; DEALLOCATE PREPARE stmt;

UPDATE activos
   SET ms_license_mode = 'perpetual', ms_vencimiento = NULL
 WHERE anos_suscripcion = 0
   AND (ms_license_mode IS NULL OR ms_license_mode <> 'perpetual');

UPDATE activos
   SET ms_license_mode = 'subscription'
 WHERE fecha_suscripcion IS NOT NULL AND anos_suscripcion > 0 AND ms_license_mode IS NULL;

-- Los pocos registros históricos que sólo tenían vencimiento se convierten
-- a un periodo anual equivalente para conservar la alerta sin fecha manual.
UPDATE activos
   SET ms_license_mode = 'subscription',
       anos_suscripcion = COALESCE(NULLIF(anos_suscripcion, 0), 1),
       fecha_suscripcion = COALESCE(fecha_suscripcion, DATE_SUB(ms_vencimiento, INTERVAL COALESCE(NULLIF(anos_suscripcion, 0), 1) YEAR))
 WHERE ms_vencimiento IS NOT NULL AND ms_license_mode IS NULL;

UPDATE activos
   SET ms_vencimiento = DATE_ADD(DATE(fecha_suscripcion), INTERVAL anos_suscripcion YEAR)
 WHERE ms_license_mode = 'subscription' AND fecha_suscripcion IS NOT NULL AND anos_suscripcion > 0;

UPDATE activos
   SET ms_license_mode = NULL, ms_vencimiento = NULL
 WHERE ms_license_mode = 'subscription'
   AND (fecha_suscripcion IS NULL OR anos_suscripcion IS NULL OR anos_suscripcion = 0);
