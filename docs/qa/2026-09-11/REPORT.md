# Verificación de Activos — 2026-09-11

Resultado: sin fallos en el alcance ejecutado.

- 121 pruebas automatizadas aprobadas (0 fallos, 0 omitidas).
- Compilación de producción correcta, realizada en /tmp sin modificar dist. Bundle JS coincide con el publicado: index-CyR4diZA.js.
- 18 rutas publicadas, probadas en escritorio (1440 px) y móvil (390 px): 36 vistas, sin excepciones JavaScript, HTTP inesperados ni desbordamiento horizontal de página.
- Rutas: resumen, inventario, inventario por unidades, alertas, bajas de personal, formulario nuevo y 12 catálogos.
- 20 comprobaciones de acceso sobre 5 endpoints: 401 sin token o con token inválido, 200 administrador y 403 viewer sin acceso al módulo.
- API en PM2 online; web y health HTTP 200.
- Dos cuentas temporales de prueba eliminadas al finalizar; comprobación de residuos: 0.
- Cambio previo en src/remissionPrint.js conservado. No se modificaron activos reales ni se desplegaron cambios.

## Límites

La navegación comprueba carga de vistas y llamadas de lectura, no todos los clics o resultados de negocio. No se ejecutaron altas, ediciones, asignaciones, bajas, carga/descarga de documentos reales, revelación de credenciales, impresión física ni sincronizaciones SAP/RH/Monitor en producción. La suite automatizada cubre aspectos de esas funciones con fixtures/mocks, pero no sustituye su validación de extremo a extremo con datos de prueba. No es una prueba de carga ni una garantía de ausencia de errores.

Evidencia de navegador y permisos: browser-results.json. Logs de ejecución: /tmp/mrti-activos-qa-20260911-tests.log, /tmp/mrti-activos-qa-20260911-build.log y /tmp/mrti-activos-qa-20260911-browser.log.
