# Agrupación de licencias antivirus

Fecha: 2026-09-23.

## Resultado

Los activos con la misma clave de Antivirus se presentan como una sola licencia
en `/activos/licencias-antivirus`. Cada grupo muestra capacidad operativa de
cinco dispositivos, lugares disponibles, compra, vencimiento y enlaces a los
equipos vinculados. La coincidencia normaliza mayúsculas y espacios; los equipos
sin clave permanecen separados para no crear relaciones falsas.

Las alertas y la campanilla también trabajan por grupo. Si cinco equipos usan la
misma clave, generan un solo aviso. Cuando un grupo contiene fechas distintas,
se muestra el intervalo completo, se marca para revisión y la alerta usa el
vencimiento más próximo para no ocultar un riesgo.

## Decisión de estructura

Esta fase deriva los grupos de los datos existentes y no crea todavía una tabla
central. El inventario real contiene 18 claves con fechas distintas al considerar
todos los estados y 14 entre equipos activos; dos claves activas aparecen en seis
dispositivos. Migrar automáticamente una fecha central descartaría diferencias
que primero deben revisarse.

Después de corregir esos grupos se puede añadir, en una migración independiente,
una entidad propietaria de licencia con capacidad configurable e historial de
compras/renovaciones, más una tabla de asignaciones por `asset_uid`. Hasta
entonces `activos.av_licencia`, `av_caducidad` y `av_vencimiento` siguen siendo
la fuente compatible y no se duplican ni reescriben.

## Evidencia

- 61 claves activas y 123 dispositivos activos con datos de Antivirus.
- 14 grupos activos con fechas por revisar y 2 sobre la capacidad inicial.
- Suite completa de Activos: 154/154 pruebas.
- Build Vite, sintaxis y `git diff --check` correctos.
- Smoke publicado: API sin sesión 401; API autenticada 200; agrupación, alertas
  y campanilla verificadas; Chromium a 1440, 390 y 320 px sin errores ni
  desbordamiento; cero fixtures residuales.
- `mrti-activos-api` quedó en línea y la configuración de PM2 fue guardada.
- Respaldo y capturas: `/tmp/mrti-antivirus-groups-btuIN7`.

## Rollback

Revertir el commit de Activos, reconstruir el frontend y reiniciar
`mrti-activos-api`. Para restaurar de inmediato la publicación anterior, copiar
el `index.html` del directorio de evidencia. No existe migración de base ni dato
nuevo que retirar; las fechas y claves originales permanecen intactas.
