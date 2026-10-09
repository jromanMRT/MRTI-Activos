# Alertas de vencimiento de licencias

Fecha original: 2026-09-23. Actualización Microsoft: 2026-10-09.

## Resultado

Activos es propietario de las fechas de licencia. En Antivirus, el campo
histórico `av_caducidad` se presenta según su significado operativo real:
**Adquisición antivirus**. `av_vencimiento` permite capturar el vencimiento
directo; si está vacío, se calcula adquisición + 1 año para conservar todos los
registros existentes. Microsoft distingue ahora una suscripción por años de una
licencia perpetua. Para una suscripción, el servidor calcula siempre
`fecha_suscripcion + anos_suscripcion`; `ms_vencimiento` permanece como espejo
compatible y ya no se captura. Una perpetua no tiene vencimiento ni genera
alertas.

La pantalla de Alertas y la campanilla global usan `sap_config_alertas` como
única configuración del margen de aviso. Antivirus y Office 365 quedaron en 30
días; FortiGate conserva su margen configurado. Cada licencia futura dentro de
la ventana genera un aviso propio. En Antivirus, los dispositivos con la misma
clave forman un solo grupo y producen un único aviso; una diferencia de fechas
usa preventivamente el vencimiento más próximo y queda señalada para revisión.
Los registros ya vencidos se agrupan por tipo para no saturar la campanilla, y
todos enlazan al filtro correspondiente de `/activos/alertas`.

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

`030_microsoft_license_terms.sql` añade `ms_license_mode` de forma idempotente,
clasifica como perpetuas las filas históricas con cero años y como suscripción
las de años positivos. Si una fila antigua sólo tenía vencimiento directo, la
convierte a un periodo anual equivalente para conservar el aviso. Después
vuelve a calcular el espejo de todas las suscripciones completas. Las filas
ambiguas sin fechas ni años quedan sin modalidad para revisión humana.

Los campos locales de modalidad y vencimiento calculado pertenecen a MRTI
Activos porque las tablas históricas de ActivosTI no contienen columnas
equivalentes. La sincronización continúa escribiendo los datos antiguos que sí
reconoce SAP. Las alertas calculan la fecha desde inicio y años en cada lectura,
por lo que nunca dependen de que el espejo local esté actualizado. El umbral
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

Restaurar el release anterior, revertir el commit de Activos y reiniciar su
proceso. La columna aditiva `ms_license_mode` y las columnas de fechas existentes
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

Actualización Microsoft 2026-10-09: 170/170 pruebas y build Vite
correctos. La migración `030` se aplicó y el runner quedó sin pendientes en la
segunda ejecución; 23 suscripciones completas tienen un espejo igual al cálculo
por aniversario, 4 licencias son perpetuas y ninguna suscripción clasificada
quedó incompleta. El estado anterior de 30 filas con datos de vigencia se guardó
con permisos `0600` en `run/microsoft-license-20261009/before.json` para rollback.
