# MRTI Activos

Inventario de activos de TI (equipos, asignaciones, licencias y accesos), integrado como módulo del portal MRTI.

## Arquitectura

- **Frontend**: React + Vite + Tailwind (carpeta `src/`), publicado en `/activos/`.
- **Backend**: Node.js + Express (carpeta `server/`), publicado en `/activos-api/`.
- **Base de datos**: MySQL 8 (`mysql/schema.sql`), base `mrti_activos`.
- **Autenticación**: sin login propio. Reutiliza la sesión emitida por MRTI-Infra —
  cada petición se valida reenviando el header `Authorization` a
  `GET /api/auth/module-access/activos` en MRTI-Infra (mismo patrón que usa
  MRTI Agent Core). El módulo `activos` se administra desde el Centro de
  control de MRTI-Infra como cualquier otro módulo.

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
cp .env.example .env   # edita MYSQL_PASSWORD y MRTI_INFRA_URL
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
