import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    host: true,
    proxy: {
      '/api/pb': {
        target: 'http://127.0.0.1:8090',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/pb/, ''),
      },
    },
  },
});
