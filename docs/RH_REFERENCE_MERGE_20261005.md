# Referencias de RH fusionadas — 2026-10-05

Fusión autorizada RH-0001 (2017) → empleado 2055 (2039), misma persona.
TI-00110 (activo 110) tiene una asignación abierta
`b6b7db9b-6ee0-4172-a458-4e98ab073fd7`; ambas referencias cambian a 2039.
No cambia responsable real, UUID patrimonial, fechas, estado ni documentos.
RH-0003 (2056) no tiene referencias por ID en Activos. El UUID de Core
de Omar permanece igual, por lo que no requiere cambio de referencia.

Desde `server/`: `node scripts/merge-rh-references-20261005.mjs --install`,
después `--preview`, `--rehearse` y `--apply`. Una segunda aplicación no
hace nada. El runner sólo escribe en la base propietaria de Activos y
rechaza asignaciones cerradas, responsables distintos o referencias nuevas.
Respaldo transaccional en `rh_reference_repairs`; auditoría sin secretos.

Aplicar antes de retirar las fichas duplicadas en RH. Para revertir, restaurar
primero RH y después ejecutar este runner con `--rollback`; puede ensayarse
sin persistir con `--rehearse-rollback`. Aborta si la asignación cambió.
No se debe usar la operación normal de desasignar/reasignar: inventaría un
movimiento patrimonial que no ocurrió. No requiere reinicio ni frontend.

Evidencia: 167 pruebas, sintaxis y diff correctos; ensayo transaccional
revertido. Ver cierre y smoke en la guía Core/Infra, registro 2026-10-05.
