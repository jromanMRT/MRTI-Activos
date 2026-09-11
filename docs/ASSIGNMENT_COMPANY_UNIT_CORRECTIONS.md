# Empresa, unidad e historial de asignaciones

Fecha: 2026-09-11.

La empresa del activo se actualiza al asignar una persona, usando la ficha
validada en vivo por RH. El servidor ignora el nombre enviado por el navegador
y persiste el nombre y la empresa devueltos por RH. Si RH no puede validar la
ficha, la asignación falla cerrada. La columna heredada permanece por
compatibilidad con SAP; en la interfaz es de solo lectura y los listados
prefieren el valor vigente de RH.

La unidad destino procede exclusivamente de `activos.unidad`. Puede elegirse
desde el catálogo vigente dentro de la pestaña Asignación y se guarda al
seleccionarla, pasando por la validación y el historial de unidad existente.
La impresión utiliza esa unidad y no `unit_name` de RH. Empresa y unidad quedan
separadas también en la remisión.

Un administrador puede retirar del historial una asignación finalizada que se
haya capturado por error. La operación exige motivo, marca `archived_at`,
`archived_by` y `archive_reason`, y conserva físicamente la fila. Una asignación
vigente no puede retirarse del historial: primero debe cerrarse mediante
“Quitar asignación”. El middleware común registra la operación en auditoría.

Migración `020_assignment_history_archive.sql`: expansión aditiva e idempotente;
se aplicó dos veces. Los 127 movimientos existentes se conservaron y 0 estaban
archivados al aplicar. No hay FK entre bases ni escritura hacia RH.

## Evidencia

- 127/127 pruebas automatizadas aprobadas y build Vite correcto.
- Asignación real con fixtures desechables: nombre manipulado ignorado, nombre y
  empresa de RH persistidos; 201 y cero residuos.
- Historial: lectura 200 con dos movimientos, retiro vigente bloqueado 409,
  retiro finalizado 200, fila archivada y lectura posterior con un movimiento;
  cero residuos.
- Navegador publicado en 1440 y 390 px: selector de unidad, empresa no editable
  y acción de retiro visibles; sin excepciones ni desbordamiento horizontal.
- Health API y frontend permanecen en 200. El cambio previo de redacción en
  `src/remissionPrint.js` se preservó.

## Rollback

Revertir el commit de aplicación, reconstruir/publicar el frontend y reiniciar
`mrti-activos-api`. Las tres columnas y el índice de la migración pueden
permanecer sin afectar el código anterior. Para una reversión inmediata del
frontend, el `index.html` anterior está en
`/tmp/mrti-activos-index-before-assignment-v2.html`; los assets versionados
anteriores siguen en `dist/assets`. No desarchivar ni borrar movimientos reales
durante el rollback.
