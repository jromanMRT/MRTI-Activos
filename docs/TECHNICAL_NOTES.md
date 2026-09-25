# Notas técnicas de Activos

Fecha: 2026-09-17.

Sección `/activos/notas-tecnicas`, disponible en el menú inmediatamente después
de Inventario. Guarda texto técnico, equipo/producto de referencia, serie,
repuesto o número de parte, enlace web opcional, vínculo opcional por
`asset_uid` y hasta 6 imágenes de referencia (etiqueta, número de parte,
especificación) por nota. Las notas generales pueden describir compatibilidad
con varios modelos sin vincularse a un equipo específico.

La búsqueda combina todas las palabras contra campos de la nota y código TI,
marca, modelo, serie y service tag del equipo vinculado. La base usa colación
UTF-8 sin distinción de mayúsculas/acentos. Los resultados se paginan de 30 en 30.
El selector de equipos devuelve hasta 20 coincidencias y permite acotar por
código o serie. Los enlaces de compra admiten únicamente HTTP/HTTPS sin
credenciales y se abren con `noopener noreferrer`; el contenido se presenta como
texto, sin interpretar HTML.

## Propiedad y permisos

Activos es propietario de `asset_technical_notes`; referencias de autor son UUID
de Core, sin FK entre bases y sin sincronización/escrituras a SAP. Todas las
rutas `/api/technical-notes` exigen sesión y acceso al módulo. Cualquier usuario
con dicho acceso consulta y crea notas; autor o administrador edita, archiva y
restaura. La identidad se deriva del servidor y se ignoran autores enviados por
el cliente. La revisión incremental evita sobreescribir cambios concurrentes
(409). Las notas archivadas permanecen recuperables desde el filtro Archivadas.
Las mutaciones quedan registradas en la auditoría existente de Activos.

## Despliegue y verificación

- Migración aditiva `021_asset_technical_notes.sql`: `CREATE TABLE IF NOT EXISTS`;
  runner ejecutado dos veces sin pendientes en la segunda ejecución.
- `npm test` en server: 139/139; incluye validación, permisos de autor,
  conflictos concurrentes, límites, URLs y búsqueda con caracteres literales.
- Sintaxis Node y `git diff --check`; build Vite aislado de los cambios ajenos
  en `src/remissionPrint.js` y `docs/qa/`.
- Smoke publicado con cuentas desechables: 401 sin sesión/inválida, 403 sin
  acceso al módulo, alta 201 con autor fijado en servidor, consulta por texto,
  número de parte, serie manual, código y serie del equipo; edición, conflicto
  409, archivo/restauración y URL insegura 400.
- Chromium sobre Nginx: alta vinculada, búsqueda por número de parte, edición,
  persistencia tras recarga, archivo/restauración; escritorio 1440 px y móvil
  390 px, formulario y listado sin desbordamiento ni errores JS. Etiquetas de
  textarea y filtro de estado asociadas explícitamente para accesibilidad.
- Auditoría: ocho eventos esperados del smoke completo; notas, usuarios y
  auditorías de QA retirados. Health y frontend publicados 200. Logs contienen
  los errores 400/409 esperados de pruebas negativas, sin error inesperado.
- No se afirma que una batería de ejemplo sea compatible con un equipo real:
  los ejemplos de QA se eliminan al finalizar.

## Imágenes de referencia (2026-09-22)

Cada nota admite hasta 6 imágenes JPG/PNG (10 MB máx. cada una, detectadas por
firma binaria, no por extensión declarada). Mismo patrón que los documentos de
activos: el binario se guarda en disco bajo `TECHNICAL_NOTE_IMAGES_DIR`
(por defecto `server/storage/technical-note-images/`, ya excluido de git por
`server/storage/.gitignore`) con nombre aleatorio; en
`asset_technical_note_images` sólo queda la ruta relativa y metadatos
(nombre original, tipo MIME, tamaño, sha256, autor). Nada de esto se guarda
como blob en la base de datos.

Rutas nuevas bajo `/api/technical-notes`, todas tras `moduleAccessRequired` +
`portalSessionRequired`:
- `GET /:id/images` — metadatos, cualquiera con acceso al módulo.
- `POST /:id/images` — sólo autor o administrador, nota no archivada, tope de
  6 imágenes por nota.
- `GET /:noteId/images/:imageId/file` — sirve el binario desde disco (para el
  `<img>` de la miniatura, vía blob URL con el token de sesión).
- `DELETE /:noteId/images/:imageId` — sólo autor o administrador.

Migración aditiva `022_technical_note_images.sql` (`CREATE TABLE IF NOT
EXISTS`, FK a `asset_technical_notes` con `ON DELETE CASCADE`). Falta aplicar
en el servidor con `npm run migrate` y reiniciar `mrti-activos-api` para que
las rutas nuevas queden disponibles; hasta entonces el frontend ya construido
mostraría error al listar/subir imágenes.

Verificado en este cambio: `npm test` en `server/` (141/141, incluye
`test/imageStorage.test.js` nuevo y los casos de permisos añadidos a
`test/technicalNotes.test.js`) y build de Vite sin errores. No se ejecutó
smoke test contra el servidor real ni verificación en navegador — no hay
Chromium/Playwright disponible en este entorno.

## Rollback

Restaurar `dist/index.html` desde
`/tmp/activos-notes-rollback-3beplpc3/dist/index.html`; los assets anteriores se
conservaron al publicar. Para reversión permanente, revertir el commit de esta
función, reconstruir desde checkout limpio y reiniciar `mrti-activos-api`.
La tabla aditiva y las notas reales deben permanecer: el código anterior las
ignora. No borrar notas ni retirar la tabla para revertir el frontend/backend.
