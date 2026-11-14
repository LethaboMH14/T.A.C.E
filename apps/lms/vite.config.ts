import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Static SPA (hash routes). The API is called directly from the browser (plain fetch to Supabase RPC).
export default defineConfig({
  base: '/',
  plugins: [react()],
  build: { outDir: 'dist' },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
