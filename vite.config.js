import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  // Publica el frontend bajo http://<servidor>/activos/.
  base: '/activos/',
  plugins: [tailwindcss(), react()],
  // `dist/` es el symlink que sirve Nginx, así que un `vite build` directo
  // escribe en build-local/ y nunca en lo publicado. Para publicar se usa `npm run build` / `npm run release`
  // (MRTI-Platform release.mjs), que pasa su propio --outDir.
  build: {
    outDir: 'build-local',
  },
  server: {
    proxy: {
      '/activos-api': 'http://localhost:3003',
    },
  },
});
