-- ============================================================
-- 003: Terceros externos
--
-- Personas que pueden tener un activo asignado sin ser empleado ni
-- usuario de la plataforma (contratista, proveedor, visita, etc.) -- no
-- existen en MRTI Core, asi que no tienen portal_user_id ni tiene sentido
-- crearles una cuenta solo para que un equipo quede "a nombre de alguien".
-- Se registran localmente en esta base, unica y exclusivamente para este
-- proposito.
-- ============================================================

USE mrti_activos;

CREATE TABLE IF NOT EXISTS terceros (
  id CHAR(36) NOT NULL PRIMARY KEY,
  nombre VARCHAR(150) NOT NULL,
  organizacion VARCHAR(150) NULL,
  motivo VARCHAR(150) NULL,
  telefono VARCHAR(30) NULL,
  correo VARCHAR(120) NULL,
  notas TEXT NULL,
  estado VARCHAR(30) NOT NULL DEFAULT 'Activo',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_terceros_estado (estado),
  KEY idx_terceros_nombre (nombre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- El tenedor actual de un activo sigue siendo, como hasta ahora, o bien un
-- portal_user_id (empleado con cuenta en Core) o bien -- nuevo -- un
-- tercero registrado aqui. usuario_asignado sigue siendo el nombre para
-- mostrar en pantalla independientemente de cual de los dos sea.
ALTER TABLE activos
  ADD COLUMN tercero_id CHAR(36) NULL AFTER portal_user_id,
  ADD KEY idx_activos_tercero (tercero_id),
  ADD CONSTRAINT fk_activos_tercero FOREIGN KEY (tercero_id) REFERENCES terceros(id) ON DELETE RESTRICT,
  ADD CONSTRAINT chk_activos_holder CHECK (portal_user_id IS NULL OR tercero_id IS NULL);

-- portal_user_id era NOT NULL porque hasta ahora solo existia esa via de
-- asignacion; con terceros como alternativa, un renglon de historial puede
-- tener el otro campo en NULL -- pero nunca ambos, ni ninguno.
ALTER TABLE activo_asignaciones
  MODIFY portal_user_id CHAR(36) NULL,
  ADD COLUMN tercero_id CHAR(36) NULL AFTER portal_user_id,
  ADD KEY idx_asignaciones_tercero (tercero_id, unassigned_at),
  ADD CONSTRAINT fk_asignaciones_tercero FOREIGN KEY (tercero_id) REFERENCES terceros(id) ON DELETE RESTRICT,
  ADD CONSTRAINT chk_asignaciones_holder CHECK (
    (portal_user_id IS NOT NULL AND tercero_id IS NULL) OR
    (portal_user_id IS NULL AND tercero_id IS NOT NULL)
  );
