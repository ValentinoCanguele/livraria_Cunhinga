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
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            // clsx é usado pelo cn() em todo o site e pelo recharts; sem bloco próprio o Rollup
            // metia-o no vendor-recharts e esse bloco era carregado logo na página inicial.
            if (/node_modules\/(clsx|tailwind-merge)\//.test(id)) {
              return 'vendor-utils';
            }
            // Só o próprio recharts: pacotes aninhados (ex.: recharts/node_modules/react-is) usados
            // também pelo código inicial obrigavam a carregar o bloco inteiro em todas as páginas.
            if (/node_modules\/recharts\/(?!node_modules)/.test(id)) {
              return 'vendor-recharts';
            }
            if (id.includes('firebase')) {
              return 'vendor-firebase';
            }
            if (id.includes('framer-motion')) {
              return 'vendor-motion';
            }
            if (id.includes('lucide-react')) {
              return 'vendor-icons';
            }
            if (id.includes('@radix-ui')) {
              return 'vendor-radix';
            }
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) {
              return 'vendor-react';
            }
          }
        },
      },
    },
  },
});
