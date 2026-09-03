# Integración de `_incoming-activos`

## Resultado

La aplicación oficial `/activos/` conserva el shell, la sesión y los permisos
de MRTI Core. Los catálogos del sistema anterior se consultan desde la copia
MySQL local mediante `/activos-api/api/activos-suite/*`; el navegador no se
conecta directamente a SQL Server ni al directorio de entrada.

Catálogos incorporados: credenciales no secretas de equipos, componentes,
impresoras, NVR/CCTV, contraseñas de red, Starlink, FortiGate, dominios,
mantenimientos, unidades, documentos y configuración de alertas. Inventario y
terceros siguen en sus rutas oficiales existentes.

La ficha de cada activo consulta los documentos por `center_code` y muestra
facturas, remisiones y otros PDF en una sección propia. La descarga conserva la
protección del módulo y nunca publica el directorio físico como contenido web.

La creación y edición se presenta como un diálogo sobre el inventario. Los
campos se organizan en pestañas de General, Asignación, Administración,
Windows, Microsoft, Dropbox, Correo y Antivirus; las fichas existentes agregan
Documentos y Monitor. En móvil el diálogo ocupa el viewport y mantiene las
pestañas desplazables, sin convertir el formulario en una página vertical.

El inventario muestra conteos por estado, filtros compactos y una fila resumida
por equipo. La columna **Docs** calcula los adjuntos activos por `center_code`;
su insignia abre directamente la pestaña Documentos del diálogo correspondiente.
El orden inicial usa el número de Código TI descendente (más nuevo primero) y
cada encabezado visible permite alternar orden ascendente/descendente; los datos
vacíos se mantienen al final.

Si la vista de origen devuelve más de una fila para el mismo `center_code`,
las variantes completas se conservan en `sap_asset_duplicates` y aparecen en
**Alertas → Códigos duplicados en el origen**. No se decide silenciosamente
cuál variante descartar.

## Seguridad y ciclo de vida

- Las contraseñas de NVR y red, la clave de cifrado y el código de verificación
  se guardan con AES-256-GCM. No aparecen en listados ni respuestas generales.
- Sólo un perfil `administrator` validado por Core puede solicitar el descifrado
  puntual. La respuesta usa `Cache-Control: no-store` y queda auditada.
- La acción de retirar un registro marca `archived_at`/`archived_by`; no elimina
  filas ni archivos y el administrador puede restaurarlos.
- Los cuatro passwords históricos de cada activo no se importan.
- Los PDF viven en `server/storage/asset-documents`, con directorio `0700` y
  archivos `0600`. Sólo se sirven tras validar acceso al módulo.

## Operación

La sincronización corre con `SAP_SYNC_CRON` (15 minutos de forma predeterminada)
y también al iniciar el proceso. El botón **Actualizar desde origen** permite al
administrador ejecutarla manualmente. Una falla de un catálogo no interrumpe los
demás y el resultado informa cada dominio por separado.

Comandos idempotentes:

```bash
cd /var/www/mrt/MRTI/MRTI-Activos/server
npm run migrate
npm run import:incoming-documents
pm2 restart mrti-activos-api --update-env
```

El importador comprueba tamaño y SHA-256 entre origen y destino, registra el
hash en `sap_documentos` y falla si encuentra un PDF sin metadatos o un registro
sin archivo. Después de retirar el directorio de entrada puede ejecutarse de
nuevo: valida el almacén oficial sin depender del respaldo antiguo.

## Cierre del directorio de entrada (2026-09-03)

Se revisó el contenido completo de `_incoming-activos/ti-assets` contra el
módulo oficial y contra `ActivosTI` en vivo:

- Los 53 PDF tienen un único destino oficial y coincidencia SHA-256 exacta.
- Los 270 activos y los catálogos no sensibles están representados por la
  sincronización vigente: 124 componentes, 46 impresoras, 13 Starlink, 7
  FortiGate, 3 dominios, 1 mantenimiento, 35 unidades, 53 documentos y 3
  configuraciones de alerta.
- `Act.xlsx`, `Antivirus.xlsx` y las hojas operativas de
  `2026_-_Activo_Fijo-CLUDE.xlsx` son instantáneas anteriores a la base viva;
  no se conservaron como una segunda fuente de verdad.
- No se trasladaron `.env`, usuarios/autenticación, passwords, hojas de cuentas
  ni secretos NVR. Tampoco se trasladaron `node_modules`, builds ni copias
  antiguas de la interfaz.
- El módulo oficial cubre la edición del inventario, carga documental y
  mantenimiento, además de consulta, búsqueda, orden y retiro lógico de los
  catálogos, unidades, alertas, dashboard y sincronización. No se copió el CRUD
  directo del sistema anterior sobre los catálogos de `ActivosTI`: los espejos
  permanecen de solo lectura para no crear dos propietarios del mismo dato.

## Reversión

Reconstruir el frontend desde el commit anterior y reiniciar
`mrti-activos-api`. Las tablas `sap_*`, las columnas de archivado y los PDF
pueden permanecer: son aditivos y el código anterior los ignora. El retiro de
`_incoming-activos` se conserva temporalmente fuera del workspace para permitir
una recuperación puntual sin volver a exponerlo en el árbol de trabajo.
