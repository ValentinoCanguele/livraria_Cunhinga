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
        // Só as bibliotecas que a loja carrega de qualquer maneira ficam num chunk
        // separado, para não mudarem de hash a cada alteração do nosso código.
        //
        // Tudo o resto fica entregue à divisão automática do Vite — e em especial o
        // recharts e o firebase, que têm de ficar dentro dos chunks assíncronos de quem
        // os usa (/admin e as ferramentas Google). A versão anterior agrupava por
        // substring ("react" apanhava também o react-smooth, do recharts): partia pacotes
        // por vários chunks, o Rollup religava-os com imports estáticos, e o index.html
        // acabava a pré-carregar ~250 KB gzip que só o /admin usa.
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
});
