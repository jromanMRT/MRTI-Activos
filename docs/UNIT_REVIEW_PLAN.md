# Ejecución del plan de revisión de unidades

Fecha: 2026-09-08. Autorización: ejecutar todas las etapas del plan propuesto.

| Etapa | Estado | Criterio de terminado |
|---|---|---|
| 1. Validación y navegación | Completa | Navegador escritorio/móvil y ambos temas, abrir/cerrar ficha conservando contexto, refresco y errores. |
| 2. Bandeja accionable | Completa (mecanismo) | Motivos y equipos afectados, filtros y acción de revisión auditada. |
| 3. Clasificar y definir correspondencias | Completa (mecanismo) | Separar etiquetas históricas de ubicaciones/organización, registrar evidencia y no inferir alias ambiguos. |
| 4. Piloto recuperable | Completa (mecanismo de corrección/SAP); **sin piloto de datos reales** | Aplicación idempotente pequeña, valores anteriores, reversión y persistencia después de sincronizar. |
| 5. Prevenir inconsistencias | Completa | Captura guiada, referencias validadas al propietario, compatibilidad y control de entradas externas. |
| 6. Retiro selectivo | Completa (mecanismo); **sin archivar ningún registro real** | Archivar sólo registros obsoletos demostrados; conservar lo indeterminado y documentar pendientes reales. |

Cambios ajenos preservados: Activos `src/remissionPrint.js`; RH
`server/src/routes/positions.js` y `src/pages/PositionListPage.jsx`.
Sin push, borrado de tablas/endpoints ni rotación de secretos.

Etapa 1: 50/50 pruebas, build aislado y smoke publicado de los 38 grupos correctos.
Playwright ejecutado con bibliotecas extraídas en `/tmp/mrti-browser-libs`:
escritorio 1440px, móvil 390px, temas claro/oscuro, filtro persistente al recargar,
abrir/cerrar ficha, quitar filtro y casos sin unidad/por revisar; 0 errores JS.
No requiere migración. Rollback: revertir el commit de navegación y reconstruir.

## Etapas 2-5: mecanismo de gobierno (completo, publicado)

Commits Activos: `d15e7ba` (catálogo, corrección con historial/reversión,
validación de referencias en vivo), `83cf075` (protección frente a SAP),
`7a196ce` (captura guiada y bandeja accionable en el frontend). Migración
`013_unit_review_governance.sql` aplicada y verificada.

**Importante sobre el alcance:** estas tres etapas entregan el *mecanismo* —
nadie clasificó, corrigió ni archivó ningún registro real de negocio como
parte de este trabajo, salvo las pruebas descritas abajo, que se revirtieron
por completo antes de terminar. Clasificar "DONADA", "Dañada", fusionar
variantes de Matamoros/Olivos o decidir si "El Realito"/"Los Olivos" son
sitios legítimos siguen siendo decisiones de negocio pendientes (ver
"Decisiones de negocio pendientes" al final de este documento) — la bandeja
y la clasificación son la herramienta para que un humano las tome con
evidencia, no una sustitución de esa decisión.

### Qué se construyó

- `sap_unidades` gana `usage_kind` (pending/inventory/physical/
  organizational/legacy/obsolete), `reference_id`, `review_note`,
  `reviewed_by`, `reviewed_at`, `review_revision`. `activos` gana
  `unit_is_manual` y `unit_revision`. Tabla nueva `asset_unit_changes`
  (antes/después, motivo, autor, reversión) — historial permanente e
  inmutable, igual que `audit_events`.
- `GET /api/activos-suite/unit-review/queue`: extiende la proyección de
  sólo lectura existente (`unitInventory.js`) con los motivos por los que
  cada nombre necesita revisión (sin unidad, fuera de catálogo, catálogo
  inactivo, nombre repetido, sin clasificar, etiqueta histórica todavía en
  uso, referencia pendiente). No decide nada — sólo explica.
- `PATCH /api/activos-suite/unit-review/catalog/:id` (administrador):
  clasifica un renglón del catálogo por su `id`, no por nombre — dos
  renglones duplicados se clasifican por separado, nunca se fusionan
  automáticamente. Si la clasificación es `physical` u `organizational`,
  valida la referencia en vivo contra MRTI-Obs (`/api/self/physical-areas`)
  o MRTI-RH (`/api/rh/org-units`) reenviando la sesión del administrador —
  nunca se copia esa tabla ni se asume vigente sin consultarla.
- `PATCH /api/activos-suite/unit-review/assets/:id` + history + `POST
  .../revert/:changeId` (administrador): corrige la unidad de un activo con
  motivo y control de concurrencia (`expected_revision`), protege el valor
  de la próxima sincronización con SAP y permite revertir sólo el cambio
  más reciente.
- `server/src/integrations/sapSync.js`: `pullSapAssets()` ya no sobreescribe
  `unidad` cuando `unit_is_manual=1`; si SAP cambia la unidad de un activo
  *no* protegido, sube `unit_revision` para invalidar una corrección
  concurrente que estuviera a medio capturar.
- Frontend: el campo "Unidad" (captura general y modal de datos
  incompletos, mismo componente `AssetField`) pasa de texto libre a una
  lista guiada del catálogo vigente; un valor histórico fuera de catálogo se
  conserva y se muestra, nunca se ofrece como opción nueva. La ficha del
  activo gana un panel "Historial de unidad" con reversión. La pestaña "Por
  revisar" de Inventario por unidad deja de ser un filtro cliente y consume
  la bandeja real, con clasificar/archivar para administradores.
- `PATCH /api/activos/:id` (ruta general) y `POST /api/activos` ahora
  siempre pasan `unidad` por la misma validación (`captureUnit`/
  `saveAssetFields`) — un formulario viejo que mande texto libre no puede
  eludir la ruta dedicada.
- Archivar un renglón del catálogo (`PATCH
  /api/activos-suite/resources/unidades/:id/archive`) ahora exige motivo y
  bloquea con 409 si `activos` o `sap_componentes` todavía lo referencian;
  la ausencia de equipos por sí sola no es motivo suficiente.

### Límite conocido, no resuelto aquí

`GET /api/rh/org-units` en MRTI-RH exige que la sesión reenviada tenga
acceso al módulo RH (`moduleAccessRequiredFor('rh')`), no sólo a Activos —
no existe hoy una vía de servicio para esta lectura puntual. Un
administrador de Activos sin acceso a RH recibirá 403 al intentar clasificar
una unidad como `organizational`. La cuenta usada para verificar sí tenía
acceso a ambos módulos, así que esto no bloqueó las pruebas, pero es una
decisión pendiente: ¿RH expone una lectura de autoservicio para este caso,
o se exige acceso a RH para clasificar así? Ver
`server/src/integrations/rhClient.js`.

### Evidencia (2026-09-08)

- `cd server && npm test`: 86/86 aprobadas (36 nuevas: `unitReview.test.js`,
  `unitReviewQueue.test.js`, `sapSync.test.js`), incluye dos defectos reales
  encontrados y corregidos antes de publicar: el INSERT a `audit_events`
  omitía `request_id` (columna `NOT NULL` sin default, migración 004) y
  `revertUnitChange` comparaba snapshots con `JSON.stringify` en vez de
  campo por campo (MySQL no garantiza el orden de claves de un JSON).
- Migración `013_unit_review_governance.sql`: aplicada con `npm run
  migrate`; además ejecutada una segunda vez de forma directa (sin pasar por
  `schema_migrations`) para probar idempotencia real a nivel SQL — sin
  error, sin columnas ni tabla duplicadas. Verificado: 35 renglones de
  `sap_unidades` con `usage_kind='pending'`, 272 activos con
  `unit_is_manual=0`/`unit_revision=0`, `asset_unit_changes` vacía antes de
  cualquier prueba.
- Build aislado en `/tmp/mrti-unit-review-build` (excluye el cambio ajeno de
  `src/remissionPrint.js`, igual que el patrón de la etapa 1) y publicado en
  `dist/`. `mrti-activos-api` reiniciado con `--update-env` para tomar
  `MRTI_OBS_URL`/`MRTI_RH_URL` nuevas; log de arranque sin errores nuevos
  (sólo la advertencia TLS/IP ya conocida).
- Permisos publicados vía Nginx: `unit-review/queue` 401 sin sesión, 401 con
  token inválido, 403 para el mismo viewer sin módulo usado en la etapa 1,
  200 para administrador. Clasificar y corregir devuelven 401/403 sin
  administrador y 409 con `revision`/`expected_revision` vencida.
- Sincronización con SAP en vivo (no simulada): se corrigió la unidad de un
  activo real (`Chihuahua` → `Cieneguita`, quedó `unit_is_manual=1`), se
  disparó `POST /api/activos-suite/sync` (274 activos, `unitProtected: 1`
  en la respuesta) y se confirmó que la unidad protegida no cambió y su
  `unit_revision` no se movió por el sync. Se revirtió de inmediato con el
  endpoint de reversión, quedando en el valor y `unit_is_manual` originales.
- Corrección + historial + reversión ejecutados dos veces completas de
  extremo a extremo contra el mismo activo real (`activos.id=1`,
  `asset_uid=ae85cf1d-9662-11f1-8b97-d85ed39ec8fa`): cada ciclo corrige,
  verifica el historial, revierte y confirma que revertir el mismo cambio
  una segunda vez responde 409. Estado final verificado: `unidad=Chihuahua`,
  `unit_is_manual=0`, igual que antes de las pruebas.
- Concurrencia: una corrección con `expected_revision` vencida responde 409
  y no persiste (verificado leyendo la fila después).
- PATCH general (`/api/activos/:id`) probado con el payload completo que
  manda `AssetFormPage` (incluida `unidad` sin cambios): no genera entradas
  espurias en `asset_unit_changes`; un intento de escribir un nombre fuera
  del catálogo por esa misma ruta responde 409 y no se escribe.
- Archivar: bloqueado con 409 sobre una unidad con activos referenciándola
  (`Chihuahua`); bloqueado con 400 por falta de motivo sobre una unidad sin
  ningún equipo ni componente asociado — la ausencia de uso no bastó por sí
  sola, como exige el plan.
- Playwright (bibliotecas de `/tmp/mrti-browser-libs`): bandeja "Por
  revisar" en escritorio 1440px y móvil 390px, ambos temas, motivos
  visibles como etiquetas, botón "Clasificar" abre el formulario guiado; 0
  errores de JavaScript. Capturas en `/tmp/mrti-unit-review-desktop.png` y
  `/tmp/mrti-unit-review-mobile.png`. El smoke original de la etapa 1
  (`/tmp/mrti-unit-inventory-smoke.mjs`) se volvió a ejecutar completo y
  sigue en verde — sin regresión.
- Incidente propio durante las pruebas, corregido: una ejecución manual
  interrumpida (`head -1` cortó la salida de un script) dejó
  `activos.id=1` protegido a medio revertir (`unit_is_manual=1`,
  `unidad='Cieneguita'*`) durante unos minutos. Se detectó al verificar el
  estado final, se revirtió con el mismo endpoint de reversión (no con un
  UPDATE manual) y quedó documentado en el propio historial de
  `asset_unit_changes` con el motivo "Limpieza: revirtiendo protección
  residual...". No afectó a ningún otro activo ni a la sincronización con
  SAP de otros equipos.
- Limpieza de fixtures: no se creó ningún registro nuevo en `sap_unidades`
  ni se archivó ninguno. `asset_unit_changes` conserva 8 filas por diseño
  (es un historial inmutable, igual que `audit_events`) documentando las
  pruebas anteriores con motivos autoexplicativos ("Smoke test: ...",
  "Verificación de protección SAP: ...", "Limpieza: ..."); el activo de
  prueba quedó exactamente en su estado y `notas` originales.

### Rollback

Revertir `7a196ce`, `83cf075` y `d15e7ba` (en ese orden) y reconstruir el
frontend. Las migraciones son sólo aditivas (columnas nuevas con default y
una tabla nueva): no requiere reversión de esquema para volver al código
anterior, aunque las columnas/tabla nuevas pueden conservarse sin uso. No
toca Nginx, Core, RH ni Monitor. Resguardo de esta publicación en
`/tmp/mrti-unit-review-rollback/` (dist anterior completo y los `.orig` de
cada archivo de backend/frontend tocado, tomados con `git show HEAD:`).

## Decisiones de negocio pendientes (no tomadas aquí, requieren evidencia)

Ninguna de estas se resolvió ni se infirió durante este trabajo; la bandeja
"Por revisar" y la clasificación son la herramienta para resolverlas, no la
respuesta.

1. **"El Realito" y "Los Olivos"** (un equipo cada uno, fuera del
   catálogo): ¿son sitios legítimos que deben registrarse tal cual en el
   catálogo, o el equipo debe corregirse a un nombre ya existente? No hay
   evidencia suficiente para decidirlo desde aquí.
2. **Variantes de Matamoros y Olivos** (p. ej. "Villa Matamoros" vs.
   "VILLAMATAMOROS", "Olivos" vs. "Los Olivos"): su equivalencia no está
   demostrada. Se conservan como nombres distintos; unirlos requiere que
   alguien con conocimiento del sitio lo confirme.
3. **"DONADA"** (13 equipos; 9 en estado Activo, 8 con referencia de
   asignación) y **"Dañada"** (12 equipos): son etiquetas de estado
   capturadas históricamente en el campo de unidad, no ubicaciones. Falta
   decidir su clasificación (¿`legacy`? ¿deben moverse a un campo de estado
   real?) y quién es el propietario de esa decisión.
4. **"Sin Asignar"** (48 equipos) y **"BUSCAR"** (1 equipo): mismo caso —
   probablemente `legacy`, pendiente de confirmación.
5. **12 nombres del catálogo sin equipos**: no se archivó ninguno. Archivar
   exige motivo y evidencia de obsolescencia, no sólo ausencia de uso (ver
   guardas nuevas en `assetSuite.js`) — falta que alguien aporte esa
   evidencia por nombre.
6. **Piloto de datos reales** (etapa 6 original): no se ejecutó ningún
   piloto sobre nombres reales. El mecanismo (migración/clasificación
   idempotente) está listo; falta la decisión de negocio de qué casos
   concretos aplicar primero.
7. **Acceso cruzado a RH para clasificar `organizational`**: ver "Límite
   conocido" arriba — decidir si Activos necesita una vía de servicio
   propia en RH o si se exige acceso a RH para esta tarea.
