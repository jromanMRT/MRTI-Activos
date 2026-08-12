# Preparación de la fuente externa de activos

Este procedimiento deja preparada la inspección de la base que alimentó al
sistema disponible en `http://192.168.1.75:3001`. La dirección de la API no
demuestra que MySQL escuche en el mismo host o puerto: esos datos deben ser
confirmados por el administrador.

## Alcance y reglas de seguridad

- La fuente externa se consulta en modo de solo lectura; no se actualiza ni se
  elimina información en ella.
- La cuenta debe ser exclusiva para la migración y tener únicamente `SELECT` y
  `SHOW VIEW` sobre la base autorizada.
- No se copian contraseñas, tokens, llaves, documentos ni datos personales que
  no pertenezcan al dominio patrimonial de MRTI-Activos.
- El primer acceso sólo obtiene versión, identidad, permisos y catálogo. No lee
  filas de negocio.
- No se habilita una sincronización automática hasta conocer claves estables,
  duplicados, eliminaciones y reglas de actualización.

## Datos que debe entregar el administrador

1. Motor y versión de la base.
2. Host y puerto reales, o instrucciones para un túnel seguro.
3. Nombre de la base y una cuenta temporal de lectura.
4. Ventana de acceso y lista de IP permitidas.
5. Responsable que confirme qué tablas pertenecen a activos y cuáles contienen
   secretos o información fuera de alcance.

Ejemplo de privilegios que puede aplicar el administrador de MySQL, ajustando
la IP del servidor MRTI y el nombre real de la base:

```sql
CREATE USER 'mrti_import_reader'@'IP_DEL_SERVIDOR_MRTI'
  IDENTIFIED BY 'CONTRASEÑA_TEMPORAL_GENERADA';
GRANT SELECT, SHOW VIEW ON base_origen.*
  TO 'mrti_import_reader'@'IP_DEL_SERVIDOR_MRTI';
```

No se requiere `INSERT`, `UPDATE`, `DELETE`, `CREATE`, `DROP`, `ALTER`, `FILE`,
`PROCESS`, `SUPER` ni `GRANT OPTION`.

## Primera conexión

Desde `MRTI-Activos/server`:

```bash
cp .env.external.example .env.external
# Editar .env.external localmente; no pegar la contraseña en comandos o chat.
npm run source:check
npm run source:catalog > source-catalog.json
```

`source:check` termina con código 2 y muestra `unsafe-grants` si detecta
privilegios de escritura. `source:catalog` lista tablas, columnas y conteos
estimados de MySQL; no exporta filas. `source-catalog.json` puede contener
nombres internos, así que debe revisarse antes de compartirlo y borrarse al
terminar el mapeo.

Para usar otro archivo de configuración:

```bash
EXTERNAL_ENV_FILE=/ruta/segura/fuente.env npm run source:check
```

## Pasos posteriores (requieren autorización)

1. Clasificar tablas y columnas por propietario: Activos, RH, MRTI-Obs, Core o
   fuera de alcance.
2. Definir una clave estable y reglas de coincidencia para cada activo.
3. Crear un respaldo cifrado y registrar conteos/checksums sin secretos.
4. Implementar una importación idempotente en modo simulación.
5. Revisar altas, cambios, bajas, duplicados y huérfanos.
6. Ejecutar la importación en una transacción y conservar rollback.
7. Comparar conteos, muestrear resultados y verificar la interfaz.

La API en el puerto 3001 puede servir para comparar contratos, pero no debe
usarse como fuente de contraseñas ni para automatizar escrituras.
