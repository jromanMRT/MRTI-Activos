# Referencias técnicas y artículos relacionados

Fecha: 2026-09-23.

Activos conserva referencias de repuestos, compatibilidad, compras, especificaciones
y fotografías. El nombre visible cambia a **Referencias técnicas** y la ruta
canónica es `/activos/referencias-tecnicas`; `/activos/notas-tecnicas` continúa
operativa con sus parámetros. La API y notas existentes no se renombran ni copian.

La ficha del activo incorpora **Artículos relacionados** (`?tab=articulos`):
permite buscar artículos publicados, vincularlos, abrirlos en otra pestaña de
Tickets y retirar el vínculo. También enlaza las referencias filtradas por equipo;
una referencia nueva desde ese contexto preselecciona el vínculo al equipo.

## Propiedad y autorización

- Tickets conserva título, cuerpo, categoría y publicación. Activos guarda sólo
  `asset_uid`, `article_id`, autor y fechas de vinculación/archivo. Sin FK cruzadas.
- `GET /api/asset-knowledge/:assetUid` resuelve títulos en vivo mediante la API
  propietaria existente de Tickets; no almacena copias ni títulos desactualizados.
- `GET /api/asset-knowledge/:assetUid/search?q=...` devuelve hasta 30 publicados.
- `POST /api/asset-knowledge/:assetUid` recibe `article_id`, valida su publicación
  con Tickets y crea/restaura el vínculo de forma idempotente.
- `DELETE /api/asset-knowledge/:assetUid/:articleId` archiva únicamente el vínculo,
  con autor/fecha. Sólo su autor o un administrador de Core puede retirarlo.
  La auditoría de Activos conserva cada mutación; nunca se modifica el artículo.
- Todas las rutas exigen sesión y acceso a Activos. Las consultas y altas
  reenvían el bearer a Tickets, que exige además su permiso vigente. No se usan
  llaves de servicio ni se conceden permisos nuevos. Retirar una referencia propia
  no requiere leer Tickets y puede hacerse vía API aunque ese módulo esté caído.
- Sólo se muestran artículos publicados, incluso para administradores. Un artículo
  retirado conserva el vínculo pero aparece como no disponible sin título/cuerpo.
- Timeout de 5 segundos, sin seguir redirects, 401/403/404 explícitos y 503 por
  dependencia indisponible. El fallo se contiene en la pestaña, no bloquea la ficha.
- `MRTI_TICKETS_URL` opcional, por defecto `http://127.0.0.1:4000`, sólo en servidor.

## Migración y publicación

`mysql/migrations/023_asset_knowledge_links.sql` usa `CREATE TABLE IF NOT EXISTS`.
No transforma ni reclasifica automáticamente notas reales. Ejecutar con el runner
`cd server && npm run migrate`; verificar una segunda ejecución sin cambios.
Reiniciar únicamente `mrti-activos-api` y compilar/publicar el frontend de Activos.
Tickets no requiere cambios, migración ni reinicio.

## Rollback

Restaurar `dist/index.html` desde
`/tmp/mrti-asset-knowledge-mww9jrfu/dist/index.html`; los assets previos se conservan.
Para retirar el backend, restaurar `server/src/index.js` desde el subdirectorio
`before/` del mismo respaldo y reiniciar `mrti-activos-api`. Los archivos nuevos
quedan sin montar. Conservar `asset_knowledge_links` y cualquier vínculo real:
el código anterior ignora la tabla aditiva. No deshacer notas/fotografías ni
cambios previos del usuario. Para reinstalar desde Git, revertir sólo el commit de
esta entrega y reconstruir; no usar reset del árbol de trabajo.

## Verificación

- `cd server && npm test`: 148/148 pruebas. Siete casos nuevos cubren permiso,
  indisponibilidad, idempotencia, borradores, cambios de título, retiro recuperable
  y validación de identificadores, con dobles aislados de Tickets/base.
- Checkout aislado con sólo los cambios de esta entrega: 146/146 pruebas y build
  correcto; la diferencia corresponde a pruebas previas de imágenes fuera del commit.
- `npm run build -- --outDir /tmp/mrti-asset-knowledge-mww9jrfu/build`: correcto.
- Runner de migración ejecutado dos veces y DDL directo una vez adicional con
  vínculo de prueba existente: sin duplicados ni pérdida de datos.
- Smoke publicado por Nginx: 401 sin token/inválido; 403 sin Activos y con Activos
  pero sin Tickets; 200 con usuario autorizado y administrador. Borrador rechazado
  404, alta idempotente 200, retiro ajeno 403, retiro propio 200, auditoría presente.
- Chromium 1440/390/320 px: buscar, vincular, abrir artículo exacto en Tickets,
  recargar, retirar, abrir referencias filtradas, preselección de equipo al crear
  referencia y ruta anterior. Sin errores JS ni desbordamiento del documento.
- Despublicar el artículo lo ocultó inmediatamente en Activos incluso para admin.
- Fixtures: cuatro cuentas, dos áreas, dos artículos, vínculos y auditoría temporal
  retirados; tablas reales de notas conservadas. PM2 Activos online y health 200.
- Evidencia y capturas: `/tmp/mrti-asset-knowledge-mww9jrfu/`.

Se preservaron cambios previos de imágenes, credenciales, remisión y navegación.
El commit incluye únicamente esta integración y los textos nuevos. No se cambian
paquetes, no se reinicia Tickets ni se mueve información entre bases.
