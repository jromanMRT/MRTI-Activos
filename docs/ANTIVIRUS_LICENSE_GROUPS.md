# Control de licencias antivirus

Fecha inicial: 2026-09-23. Entidad canónica: 2026-09-25.

## Resultado

`/activos/licencias-antivirus` administra compras reales. Cada licencia define
producto, clave, compra, caducidad, proveedor, referencia, notas y capacidad.
Los equipos se vinculan por `asset_uid`; el servidor bloquea una asignación si
el activo ya pertenece a otra licencia o si no quedan lugares.

El catálogo incluye ESET Endpoint Security como opción predeterminada y también
Microsoft Defender, Bitdefender, Kaspersky, Sophos, CrowdStrike, SentinelOne,
Trend Micro, Avast y Otro. Las alertas leen una vez la caducidad de la licencia,
por lo que cinco equipos generan un solo aviso.

## Migración y compatibilidad

`026_antivirus_license_entities.sql` crea `antivirus_products`,
`antivirus_licenses` y `antivirus_license_assets`. Es aditiva e idempotente.
Migra una licencia por clave normalizada y conserva todos los campos `av_*`.
Cuando una clave ya tenía seis equipos, su capacidad inicial queda en seis para
no dejar la base en un estado inválido. Cuando había fechas distintas, conserva
la más próxima para continuidad de alertas y marca `needs_review`; la evidencia
original sigue disponible en cada activo.

Las altas y modificaciones sincronizan clave y fechas hacia `activos.av_licencia`,
`av_caducidad` y `av_vencimiento` mientras ActivosTI/SAP dependa de ellos. La
interfaz ya no ofrece esos campos como una segunda captura. Cuatro activos sin
clave quedaron visibles como históricos para vincularlos manualmente.

## Evidencia

- 10 productos, 60 licencias, 119 asignaciones activas y cero asignaciones
  duplicadas por `asset_uid`.
- Capacidad total migrada: 302; 15 licencias marcadas para revisión.
- La segunda ejecución del runner no aplicó cambios.
- Suite completa del servidor y build Vite correctos.

## Rollback

Revertir código y frontend devuelve temporalmente la lectura agrupada anterior:
los campos `av_*` se conservan y siguen completos. Mantener las tres tablas
nuevas durante el periodo de compatibilidad. Si después se autoriza retirarlas,
exportar primero las tablas, verificar que cada asignación aún esté reflejada en
`activos.av_*` y eliminarlas en orden: asignaciones, licencias y productos.
