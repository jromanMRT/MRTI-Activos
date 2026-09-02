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

## Reversión

Reconstruir el frontend desde el commit anterior y reiniciar
`mrti-activos-api`. Las tablas `sap_*`, las columnas de archivado y los PDF
pueden permanecer: son aditivos y el código anterior los ignora. No se debe
borrar `_incoming-activos` hasta que el propietario confirme el periodo de
retención del respaldo.
