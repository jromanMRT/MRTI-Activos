-- av_caducidad conserva la fecha histórica que en la operación corresponde a
-- la adquisición. Esta columna local permite registrar el vencimiento real y
-- deja como respaldo compatible adquisición + 1 año.
SET @ddl = IF(
  EXISTS(
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = DATABASE()
       AND table_name = 'activos'
       AND column_name = 'av_vencimiento'
  ),
  'SELECT 1',
  'ALTER TABLE activos ADD COLUMN av_vencimiento DATE NULL AFTER av_caducidad'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Materializa el vencimiento esperado para que la ficha muestre ambas fechas.
-- Sólo completa valores ausentes y nunca reemplaza una corrección explícita.
UPDATE activos
SET av_vencimiento = DATE_ADD(DATE(av_caducidad), INTERVAL 1 YEAR)
WHERE av_vencimiento IS NULL
  AND av_caducidad IS NOT NULL;
