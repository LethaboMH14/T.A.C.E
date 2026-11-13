import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dev: the Vite server proxies /api to the studio server (web/server.mjs on :4173).
// Build: static files in dist/, served by web/server.mjs at "/" when dist exists.
export default defineConfig({
  base: '/',
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    // TACE_API lets parallel builders test against their own studio server (e.g. PORT=4181 node web/server.mjs).
    proxy: {
      '/api': process.env.TACE_API || 'http://localhost:4173',
    },
  },
  build: {
    outDir: 'dist',
  },
});
