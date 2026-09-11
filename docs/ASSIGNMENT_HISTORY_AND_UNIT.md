# Historial de asignaciones y unidad del activo

Fecha: 2026-09-11.

Alcance solicitado: mostrar responsables anteriores dentro de Asignación y distinguir la unidad patrimonial de la empresa laboral. No altera las fases pendientes de retiro de identidad de Infra.

Plan ejecutado: revisar contratos y propiedad; presentar historial y corregir unidad; probar y publicar; registrar evidencia y rollback.

La ficha consulta el endpoint existente `GET /api/activos/:id/asignaciones`, propiedad de Activos. Muestra cada persona por referencia estable Core/RH (o tercero histórico), fecha inicial, fin, estado y notas. Los nombres actuales se consultan mediante el contrato por lotes ya existente de RH. Si RH falla, se conserva la referencia y el historial, con aviso. No se inventa el nombre histórico cuando ya no puede resolverse. El historial se refresca al asignar o quitar asignación.

La etiqueta **Unidad asignada al activo** usa exclusivamente `activos.unidad`, igual que Inventario y su filtro por unidad. RH conserva Empresa, número, nombre, área y celular. No se transforma una empresa de nómina en ubicación ni se modifican asignaciones. No cambia la unidad laboral de RH ni la topología de Monitor.

Migración: no aplica; se reutilizan tablas y contratos existentes. No hay nuevas FKs, escrituras cruzadas ni retiro de compatibilidad.

## Validación

- 124/124 pruebas de servidor aprobadas, incluidas 3 nuevas para referencias estables, fallback y unidad.
- Build correcto y git diff --check limpio.
- Navegador publicado: ficha de un activo asignado en 1440 y 390 px; historial visible, unidad coincide con el campo del activo, sin excepciones JavaScript, HTTP inesperados ni overflow horizontal.
- Historial por Nginx: 401 sin token, 401 token inválido, 403 viewer sin módulo, 200 administrador.
- Cero cuentas temporales residuales; no se modificaron activos reales. Las mutaciones existentes no se repitieron sobre registros reales.
- Compilación publicada sin reinicio de API. Cambio previo src/remissionPrint.js conservado; ya coincidía con el bundle publicado antes de esta entrega.

## Rollback

Restauración inmediata: copiar `/tmp/mrti-assignment-rollback/index.html` a `dist/index.html` de Activos de forma atómica; los assets anteriores se conservaron. Alternativamente revertir el commit de esta entrega y reconstruir/publicar el frontend. No hay base de datos ni API que revertir y nunca se borra historial.
