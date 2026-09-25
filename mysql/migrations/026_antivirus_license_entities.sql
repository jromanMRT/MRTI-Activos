-- Entidad canónica de licencias antivirus. Los campos av_* de activos se
-- conservan durante el periodo de compatibilidad con ActivosTI/SAP.
CREATE TABLE IF NOT EXISTS antivirus_products (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  code VARCHAR(60) NOT NULL,
  vendor VARCHAR(120) NOT NULL,
  name VARCHAR(180) NOT NULL,
  is_default TINYINT(1) NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_antivirus_products_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO antivirus_products (code, vendor, name, is_default) VALUES
  ('eset-endpoint-security', 'ESET', 'ESET Endpoint Security', 1),
  ('microsoft-defender-business', 'Microsoft', 'Defender for Business', 0),
  ('bitdefender-gravityzone', 'Bitdefender', 'GravityZone Business Security', 0),
  ('kaspersky-endpoint-security', 'Kaspersky', 'Endpoint Security for Business', 0),
  ('sophos-intercept-x', 'Sophos', 'Intercept X Endpoint', 0),
  ('crowdstrike-falcon', 'CrowdStrike', 'Falcon Endpoint Protection', 0),
  ('sentinelone-singularity', 'SentinelOne', 'Singularity Endpoint', 0),
  ('trend-micro-worry-free', 'Trend Micro', 'Worry-Free Business Security', 0),
  ('avast-business', 'Avast', 'Business Antivirus', 0),
  ('otro', 'Otro', 'Otro antivirus', 0)
ON DUPLICATE KEY UPDATE vendor=VALUES(vendor), name=VALUES(name);

CREATE TABLE IF NOT EXISTS antivirus_licenses (
  id CHAR(36) NOT NULL,
  product_id INT UNSIGNED NOT NULL,
  display_name VARCHAR(180) NULL,
  license_key VARCHAR(255) NOT NULL,
  license_key_normalized VARCHAR(255) NOT NULL,
  purchase_date DATE NULL,
  expires_on DATE NULL,
  seat_capacity SMALLINT UNSIGNED NOT NULL DEFAULT 5,
  provider VARCHAR(180) NULL,
  purchase_reference VARCHAR(180) NULL,
  notes TEXT NULL,
  migration_status ENUM('ready','needs_review') NOT NULL DEFAULT 'ready',
  created_by CHAR(36) NULL,
  archived_at DATETIME NULL,
  archived_by CHAR(36) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_antivirus_license_key (license_key_normalized),
  KEY idx_antivirus_license_expiry (expires_on, archived_at),
  CONSTRAINT fk_antivirus_license_product FOREIGN KEY (product_id) REFERENCES antivirus_products(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS antivirus_license_assets (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  license_id CHAR(36) NOT NULL,
  asset_uid CHAR(36) NOT NULL,
  assigned_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  assigned_by CHAR(36) NULL,
  unassigned_at DATETIME NULL,
  unassigned_by CHAR(36) NULL,
  active_asset_uid CHAR(36) GENERATED ALWAYS AS (IF(unassigned_at IS NULL, asset_uid, NULL)) STORED,
  PRIMARY KEY (id),
  UNIQUE KEY uq_antivirus_active_asset (active_asset_uid),
  KEY idx_antivirus_assignment_license (license_id, unassigned_at),
  KEY idx_antivirus_assignment_asset (asset_uid, unassigned_at),
  CONSTRAINT fk_antivirus_assignment_license FOREIGN KEY (license_id) REFERENCES antivirus_licenses(id),
  CONSTRAINT fk_antivirus_assignment_asset FOREIGN KEY (asset_uid) REFERENCES activos(asset_uid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Expande los grupos históricos sin descartar diferencias. La fecha más
-- próxima mantiene las alertas actuales; needs_review hace visible que los
-- activos de la misma clave contenían valores diferentes.
INSERT INTO antivirus_licenses (
  id, product_id, display_name, license_key, license_key_normalized,
  purchase_date, expires_on, seat_capacity, notes, migration_status
)
SELECT UUID(), p.id, CONCAT('ESET · ', LEFT(g.license_key, 18)), g.license_key,
       g.license_key_normalized, g.purchase_date, g.expires_on,
       GREATEST(5, g.device_count),
       IF(g.needs_review = 1,
          'Migrada desde activos con fechas distintas; revisar contra la compra original.',
          'Migrada desde los datos históricos de activos.'),
       IF(g.needs_review = 1, 'needs_review', 'ready')
FROM (
  SELECT MIN(TRIM(av_licencia)) AS license_key,
         UPPER(REGEXP_REPLACE(TRIM(av_licencia), '[[:space:]]+', ' ')) AS license_key_normalized,
         MIN(DATE(av_caducidad)) AS purchase_date,
         MIN(COALESCE(DATE(av_vencimiento), DATE_ADD(DATE(av_caducidad), INTERVAL 1 YEAR))) AS expires_on,
         COUNT(*) AS device_count,
         IF(COUNT(DISTINCT DATE(av_caducidad)) > 1
            OR COUNT(DISTINCT COALESCE(DATE(av_vencimiento), DATE_ADD(DATE(av_caducidad), INTERVAL 1 YEAR))) > 1,
            1, 0) AS needs_review
  FROM activos
  WHERE estado = 'Activo' AND NULLIF(TRIM(av_licencia), '') IS NOT NULL
  GROUP BY UPPER(REGEXP_REPLACE(TRIM(av_licencia), '[[:space:]]+', ' '))
) g
JOIN antivirus_products p ON p.code = 'eset-endpoint-security'
ON DUPLICATE KEY UPDATE license_key_normalized=VALUES(license_key_normalized);

INSERT INTO antivirus_license_assets (license_id, asset_uid)
SELECT l.id, a.asset_uid
FROM activos a
JOIN antivirus_licenses l
  ON l.license_key_normalized = UPPER(REGEXP_REPLACE(TRIM(a.av_licencia), '[[:space:]]+', ' '))
LEFT JOIN antivirus_license_assets current_assignment
  ON current_assignment.asset_uid = a.asset_uid AND current_assignment.unassigned_at IS NULL
WHERE a.estado = 'Activo'
  AND NULLIF(TRIM(a.av_licencia), '') IS NOT NULL
  AND current_assignment.id IS NULL;
