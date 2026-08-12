# MRTI Activos

Fuente maestra del inventario patrimonial de TI: equipos, asignaciones,
compras, garantías, mantenimientos y licencias.

## Arquitectura

- **Frontend**: React + Vite + Tailwind (carpeta `src/`), publicado en `/activos/`.
- **Backend**: Node.js + Express (carpeta `server/`), publicado en `/activos-api/`.
- **Base de datos**: MySQL 8 (`mysql/schema.sql`), base `mrti_activos`.
- **Autenticación**: sin login propio; valida la sesión y el permiso `activos`
  contra MRTI Core.
- **Observabilidad**: la ficha del activo consulta en modo de solo lectura a
  MRTI-Obs mediante `asset_uid`. Los datos técnicos no se duplican aquí.

## Origen de los datos

Los 263 activos iniciales se importaron desde un sistema externo de activos TI
(API en otra máquina de la red). Por diseño no se importaron contraseñas en
texto plano (`win_password`, `ms_password`, `password_mrt`,
`password_corporativo`); ese sistema externo no fue modificado ni se eliminó
nada de él.

## Puesta en marcha

### 1. Base de datos

```bash
mysql -u root -p < mysql/schema.sql
```

### 2. Backend (API)

```bash
cd server
npm install
cp .env.example .env   # edita MYSQL_PASSWORD y MRTI_CORE_URL
npm run dev            # API en http://localhost:3003
```

### 3. Frontend

```bash
npm install
npm run dev            # http://localhost:5173 (peticiones /activos-api vía proxy)
```

## Producción

- Frontend: `npm run build` (genera `dist/`) y se publica en `/activos/`.
- Backend: `pm2 start ecosystem.config.cjs` dentro de esta carpeta.
- Nginx: agrega los bloques `/activos/` y `/activos-api/` (ver
  `deploy/nginx.conf.example` del portal MRTI).

## Conciliación con MRTI-Obs

Después de aplicar las migraciones en ambos módulos:

```bash
npm --prefix server run reconcile:obs
npm --prefix server run reconcile:obs -- --apply
```

La primera orden es un ensayo sin escrituras. La segunda vincula coincidencias
únicas por serie, service tag o etiqueta patrimonial y migra ubicación y
asignación. Los casos ambiguos o sin coincidencia quedan para revisión manual.
