-- 012: lista de control administrativa por salida de empleado.
-- Sólo registra verificación; cada cuenta/licencia sigue siendo modificada
-- desde su sistema propietario.
USE mrti_activos;

CREATE TABLE IF NOT EXISTS employee_offboarding_cases (
  id CHAR(36) NOT NULL PRIMARY KEY,
  reference_type VARCHAR(20) NOT NULL,
  reference_value VARCHAR(40) NOT NULL,
  employee_name VARCHAR(160) NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'open',
  tasks_json JSON NOT NULL,
  notes TEXT NULL,
  completed_at DATETIME NULL,
  completed_by_user_id CHAR(36) NULL,
  completed_by_name VARCHAR(160) NULL,
  updated_by_user_id CHAR(36) NULL,
  updated_by_name VARCHAR(160) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_employee_offboarding_reference (reference_type, reference_value, status),
  KEY idx_employee_offboarding_status (status, updated_at),
  CONSTRAINT chk_employee_offboarding_reference CHECK (reference_type IN ('rh_employee','core_user')),
  CONSTRAINT chk_employee_offboarding_case_status CHECK (status IN ('open','completed'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
