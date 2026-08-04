import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Publica el frontend bajo http://<servidor>/activos/.
  base: '/activos/',
  plugins: [react()],
  server: {
    proxy: {
      '/activos-api': 'http://localhost:3003',
    },
  },
});
