-- Fase 7 de CORE_INFRA_MIGRATION_GUIDE.md: vincula filas de `activos` con
-- el usuario de MRTI Core que las tiene asignadas, para poder ofrecer
-- /api/activos-self sin exponer el módulo administrativo completo.
-- Un empleado puede tener varios activos (1:N), por eso no hay UNIQUE.

ALTER TABLE activos
  ADD COLUMN portal_user_id CHAR(36) NULL AFTER correo_corporativo,
  ADD INDEX idx_activos_portal_user (portal_user_id);
