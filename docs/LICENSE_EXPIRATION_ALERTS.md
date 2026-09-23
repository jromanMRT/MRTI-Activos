# Alertas de vencimiento de licencias

Fecha: 2026-09-23.

## Resultado

Activos es propietario de las fechas de licencia. En Antivirus, el campo
histórico `av_caducidad` se presenta según su significado operativo real:
**Adquisición antivirus**. `av_vencimiento` permite capturar el vencimiento
directo; si está vacío, se calcula adquisición + 1 año para conservar todos los
registros existentes. Microsoft 365 usa `ms_vencimiento` como fecha directa y,
si está vacío, conserva el cálculo histórico
`fecha_suscripcion + anos_suscripcion`.

La pantalla de Alertas y la campanilla global usan `sap_config_alertas` como
única configuración del margen de aviso. Antivirus y Office 365 quedaron en 30
días; FortiGate conserva su margen configurado. Cada licencia futura dentro de
la ventana genera un aviso propio. Los registros ya vencidos se agrupan por
tipo para no saturar la campanilla, y todos enlazan al filtro correspondiente de
`/activos/alertas`.

Core sólo consolida la lectura de `/api/activos-suite/license-notifications` y
reenvía la sesión. No copia fechas, no calcula vencimientos y no concede acceso:
una cuenta sin permiso de Activos no consulta ni recibe esta fuente. Una caída
de Activos degrada sólo sus avisos y no oculta Tickets, RH o Legal.

## Migración y compatibilidad

`024_asset_license_expiration.sql` añade `activos.ms_vencimiento` y
`025_antivirus_expiration.sql` añade `activos.av_vencimiento`, ambas con guarda
idempotente. La segunda completa inicialmente el vencimiento como adquisición
+ 1 año sólo cuando el campo nuevo está vacío; no elimina ni reescribe la fecha
histórica. Se aplicaron mediante el runner y una segunda ejecución no hizo
cambios.

Los vencimientos directos nuevos son locales a MRTI Activos porque las tablas
históricas de ActivosTI no contienen columnas equivalentes. La sincronización
los preserva y continúa escribiendo los datos antiguos que sí reconoce SAP. El umbral
de 30 días se actualizó mediante la API administrativa existente, quedó marcado
como ajuste local protegido y se confirmó también en `dbo.ConfigAlertas`.

## Comportamiento de los avisos

- Próximo: un aviso por licencia, desde el día configurado hasta su fecha.
- Vence hoy: aviso propio con la fecha exacta.
- Vencido: un resumen por producto con acceso a la lista completa.
- Máximo visible: 20 próximos por producto y un resumen del resto.
- Identificador estable por activo, producto y fecha, para que el navegador no
  repita el aviso del mismo vencimiento en cada consulta.

## Rollback

Restaurar los `index.html` guardados en el directorio de evidencia, revertir los
commits de Activos y Core y reiniciar ambos procesos. Las columnas aditivas
deben permanecer: el código anterior las ignora y así no se pierden fechas que
el usuario haya capturado. Para volver temporalmente al comportamiento previo de
la campanilla basta con revertir Core; las alertas seguirán disponibles dentro
de Activos. Los umbrales pueden regresar a 60 desde Configuración de alertas,
que los enviará también a ActivosTI.

## Evidencia

La suite completa del servidor pasó 151/151 pruebas y el build Vite terminó
correctamente. Cada migración se ejecutó dos veces: la primera añadió su columna
y la segunda no encontró trabajo pendiente. La corrección de Antivirus completó
136 vencimientos derivados, sin fechas faltantes; 91 corresponden hoy a activos
con licencia vencida. `git diff --check` y las validaciones de sintaxis quedaron
limpios.

El smoke publicado confirmó:

- API protegida: 401 sin sesión y 200 con administrador.
- Umbrales de 30 días para Antivirus y Office 365.
- Avisos individuales con vencimientos temporales a 15 y 20 días tanto en
  Activos como en la campanilla consolidada de Core.
- Captura directa, filtro y campanilla sin errores ni desbordamiento a 1440,
  390 y 320 px.
- Restauración exacta de las fechas originales y cero fixtures residuales.

Core pasó su suite completa de 64/64 pruebas y su build Vite. Los procesos
`mrti-activos-api` y `mrti-core-api` quedaron en línea después del reinicio y
la configuración de PM2 fue guardada. El respaldo previo a publicación está
en `/tmp/mrti-license-alerts-byy7h3`; el de la corrección de Antivirus está en
`/tmp/mrti-antivirus-dates-vosn5k`.
