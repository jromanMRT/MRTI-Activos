# Ejecución del plan de revisión de unidades

Fecha: 2026-09-08. Autorización: ejecutar todas las etapas del plan propuesto.

| Etapa | Estado | Criterio de terminado |
|---|---|---|
| 1. Validación y navegación | Completa | Navegador escritorio/móvil y ambos temas, abrir/cerrar ficha conservando contexto, refresco y errores. |
| 2. Bandeja accionable | En progreso | Motivos y equipos afectados, filtros y acción de revisión auditada. |
| 3. Clasificar y definir correspondencias | Pendiente | Separar etiquetas históricas de ubicaciones/organización, registrar evidencia y no inferir alias ambiguos. |
| 4. Piloto recuperable | Pendiente | Aplicación idempotente pequeña, valores anteriores, reversión y persistencia después de sincronizar. |
| 5. Prevenir inconsistencias | Pendiente | Captura guiada, referencias validadas al propietario, compatibilidad y control de entradas externas. |
| 6. Retiro selectivo | Pendiente | Archivar sólo registros obsoletos demostrados; conservar lo indeterminado y documentar pendientes reales. |

Cambios ajenos preservados: Activos `src/remissionPrint.js`; RH
`server/src/routes/positions.js` y `src/pages/PositionListPage.jsx`.
Sin push, borrado de tablas/endpoints ni rotación de secretos.

Etapa 1: 50/50 pruebas, build aislado y smoke publicado de los 38 grupos correctos.
Playwright ejecutado con bibliotecas extraídas en `/tmp/mrti-browser-libs`:
escritorio 1440px, móvil 390px, temas claro/oscuro, filtro persistente al recargar,
abrir/cerrar ficha, quitar filtro y casos sin unidad/por revisar; 0 errores JS.
No requiere migración. Rollback: revertir el commit de navegación y reconstruir.
