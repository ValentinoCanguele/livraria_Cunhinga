import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    // Inclui também os módulos de email da Edge Function: são TypeScript sem nada de Deno,
    // e assim o `npm test` (que o deploy usa como gate) cobre o HTML enviado aos clientes.
    include: ['src/**/*.test.{js,jsx}', '../../supabase/functions/**/*.test.ts'],
  },
});
