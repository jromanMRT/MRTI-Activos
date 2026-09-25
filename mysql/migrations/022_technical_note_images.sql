-- Imágenes de referencia para notas técnicas (etiqueta, número de parte,
-- especificación) para saber exactamente qué comprar. El archivo vive en
-- disco (ver server/src/imageStorage.js); aquí sólo se guarda la ruta
-- relativa y metadatos, nunca el binario.
CREATE TABLE IF NOT EXISTS asset_technical_note_images (
  id CHAR(36) NOT NULL PRIMARY KEY,
  note_id CHAR(36) NOT NULL,
  original_name VARCHAR(240) NULL,
  local_storage_path VARCHAR(255) NOT NULL,
  mime_type VARCHAR(30) NOT NULL,
  size_bytes INT UNSIGNED NOT NULL,
  sha256 CHAR(64) NOT NULL,
  uploaded_by_user_id CHAR(36) NULL,
  uploaded_by_name VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_technical_note_images_note (note_id),
  CONSTRAINT fk_technical_note_images_note FOREIGN KEY (note_id) REFERENCES asset_technical_notes(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
