# Inventario por unidad

Fecha: 2026-09-08.

## Alcance y plan ejecutado

1. Completado: revisar guía Core/Infra, estado Git y uso real del catálogo.
2. Completado: agregar una proyección de lectura y navegación desde Inventario.
3. Completado: probar conteos, publicar y conservar reversión.

`/activos/inventario/unidades` cruza `sap_unidades` con la columna heredada
`activos.unidad`. Incluye nombres sin equipos, nombres usados fuera del catálogo,
catálogos inactivos/archivados, nombres repetidos y equipos sin unidad.
Los registros duplicados del catálogo no multiplican equipos. La agrupación y
el filtro usan la misma comparación MySQL y recortan espacios exteriores, sin
reescribir valores ni unir alias como Realito/El Realito.

Los estados se obtienen de `activos.estado`; las asignaciones, de las referencias
Core/RH/terceros existentes, independientemente del estado patrimonial. Una etiqueta
como `Dañada`, `DONADA` o `Sin Asignar` no determina ninguno de esos indicadores.
No se presenta este catálogo como topología física ni estructura laboral.

El acceso independiente Unidades sale del sidebar. Inventario y la distribución
del Dashboard enlazan a la vista. El catálogo anterior mantiene su URL, altas,
archivo y restauración, accesibles desde Administrar catálogo.

## Contrato compatible

- Nueva lectura protegida: `GET /api/activos-suite/unit-inventory`.
- Filtros aditivos en `GET /api/activos`: `unidad_operativa=<nombre>` y
  `sin_unidad=1`. El filtro anterior `unidad` permanece compatible.
- El frontend conserva el filtro de unidad en la URL, permite quitarlo y volver
  al resumen. Nulo/vacío se distingue de la etiqueta literal `Sin Asignar`.
- Sin migración de esquema o datos: sólo consultas SELECT. Repetir la lectura
  no cambia la base. RH y Monitor conservan sus dominios propietarios.

## Evidencia

- `cd server && npm test`: 49/49 aprobadas.
- `node scripts/check-unit-inventory.js`: 38 grupos, 272 equipos; cada grupo
  coincide con su filtro en total, activos, mantenimiento, bajas y asignaciones.
  Cero escrituras persistentes o fixtures.
- Build Vite correcto en `/tmp/mrti-unit-inventory-build`, usando un snapshot
  que excluye el cambio previo ajeno en `src/remissionPrint.js`.
- `node --check` en los tres archivos de backend y `git diff --check`: correctos.
- Smoke publicado por Nginx: nueva lectura 401 sin sesión, 401 con token inválido,
  403 para viewer sin módulo y 200 para administrador. Los 38 filtros publicados
  devolvieron exactamente el conteo del resumen, incluyendo 10 equipos sin unidad.
- Dos nombres fuera del catálogo: El Realito y Los Olivos. Se conservan sin unión
  automática con otros nombres. El catálogo mantiene sus 35 registros.
- Frontend, bundle y health publicados: 200. `mrti-activos-api` online; sincronización
  normal de arranque correcta. Log sólo muestra la advertencia TLS/IP ya existente.
- Prueba gráfica intentada con Playwright, sin ejecución: Chromium no pudo iniciar
  por falta de `libatk-1.0.so.0` y otras bibliotecas del sistema. No se afirma
  validación visual ni de interacción de navegador.

## Seguimiento de publicaciones

- `026f850` (2026-09-08): conserva el filtro de unidad al abrir/cerrar una
  ficha (usa `history.state`/URL en vez de depender de un `return` externo,
  ver `inventoryReturnHref`) y evita que la respuesta de una consulta
  anterior sobrescriba un resultado más nuevo cuando el usuario cambia de
  filtro rápido (se descarta la respuesta si ya no corresponde al filtro
  vigente). Mismas 50/50 pruebas y build aislado que la publicación
  original; Playwright confirmó abrir/cerrar ficha conservando
  `unidad_operativa` en la URL y recarga sin perder el filtro.
- `d15e7ba`, `83cf075`, `7a196ce` (2026-09-08): mecanismo de gobierno de
  unidades (clasificación del catálogo, corrección de activos con
  historial/reversión, protección frente a SAP, captura guiada y bandeja
  accionable). Detalle completo, decisiones pendientes y evidencia en
  `UNIT_REVIEW_PLAN.md` — ese documento es ahora la fuente de verdad para
  el trabajo posterior a la publicación inicial de este archivo.

## Rollback

Revertir el commit de esta función, reconstruir el frontend y reiniciar únicamente
`mrti-activos-api`. No requiere reversión de datos, migración, reinicio de Core,
cambio de Nginx ni escritura en SAP.

Resguardo inmediato de esta publicación: `/tmp/mrti-unit-inventory-rollback/dist`
y copias anteriores de `server/src/routes/activos.js` y `assetSuite.js` en el mismo
directorio. Restaurar esos archivos y el frontend anterior y reiniciar Activos
recupera el contrato anterior. El helper nuevo puede permanecer sin uso. Se verificó
que el resguardo contiene el index anterior y las dos rutas anteriores; Git es la
fuente durable para reconstruir, porque `/tmp` es temporal.
