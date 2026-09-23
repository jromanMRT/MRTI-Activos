-- Activos owns the relationship, Tickets owns articles. No cross-database FK.
CREATE TABLE IF NOT EXISTS asset_knowledge_links (
  asset_uid CHAR(36) NOT NULL,
  article_id INT UNSIGNED NOT NULL,
  created_by CHAR(36) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  archived_at DATETIME NULL,
  archived_by CHAR(36) NULL,
  PRIMARY KEY (asset_uid, article_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
