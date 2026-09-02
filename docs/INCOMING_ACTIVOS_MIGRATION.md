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
