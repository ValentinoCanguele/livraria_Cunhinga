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
  },
  preview: {
    allowedHosts: [
      'livraria-adventista-230460246055.europe-west2.run.app',
    ],
  },
  build: {
    outDir: '../../dist/app/web',
    emptyOutDir: true,
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        // Divide os pacotes pesados em chunks dedicados para reduzir o payload inicial e
        // evitar que o bundle principal fique dominado por panel, gráficos e integrações.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;

          if (id.includes('/react') || id.includes('/scheduler') || id.includes('/react-router-dom')) return 'vendor-react';
          if (id.includes('/recharts') || id.includes('/d3')) return 'vendor-charts';
          if (id.includes('/firebase') || id.includes('/@firebase')) return 'vendor-firebase';
          if (id.includes('@supabase')) return 'vendor-supabase';
          if (id.includes('/framer-motion')) return 'vendor-motion';

          return 'vendor-commons';
        },
      },
    },
  },
});
