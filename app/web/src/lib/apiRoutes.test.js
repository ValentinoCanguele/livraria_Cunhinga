import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * O site e a Edge Function são publicados por caminhos diferentes — Cloudflare Pages e
 * Supabase — e nada obrigava a que as rotas que o site chama existissem do outro lado. Foi
 * assim que o painel passou a chamar `/admin/orders/payment-status` numa função publicada
 * que não a tinha: confirmar o pagamento deixava de funcionar, e só se via em produção.
 *
 * Este teste não substitui o deploy da função; apanha o caso mais básico, que é alguém
 * escrever no frontend uma rota que o `index.ts` nunca registou (um nome trocado, um
 * caminho renomeado só de um lado).
 */

const SRC = path.resolve(__dirname, '..');
const EDGE_FUNCTION = path.resolve(__dirname, '../../../../supabase/functions/app/index.ts');

function sourceFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...sourceFiles(full));
    } else if (/\.jsx?$/.test(entry) && !/\.test\.jsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

/** Rotas registadas na Edge Function: `route("GET", "/health", …)`. */
function declaredRoutes() {
  const source = readFileSync(EDGE_FUNCTION, 'utf8');
  const found = new Set();
  for (const m of source.matchAll(/route\(\s*"(GET|POST)"\s*,\s*"([^"]+)"/g)) {
    found.add(m[2]);
  }
  return found;
}

/**
 * Rotas que o frontend chama. Normaliza o que é ruído e não caminho: o prefixo `/api/app`,
 * a query string e tudo a partir de uma interpolação.
 */
function calledRoutes() {
  const calls = new Map();
  const patterns = [
    /(?:pb\.send|appApi)\(\s*[`'"]([^`'"]+)/g,
    /\$\{APP_API_URL\}([^`'"]+)/g,
  ];
  for (const file of sourceFiles(SRC)) {
    const source = readFileSync(file, 'utf8');
    for (const pattern of patterns) {
      for (const m of source.matchAll(pattern)) {
        let route = m[1]
          .replace(/^\/api\/app/, '')
          .replace(/\$\{.*$/, '')
          .replace(/\?.*$/, '')
          .replace(/\/$/, '');
        if (!route.startsWith('/')) continue;
        // `/api/app/...` aparece num comentário a explicar o equivalente antigo.
        if (route.includes('...')) continue;
        if (!calls.has(route)) calls.set(route, path.relative(SRC, file));
      }
    }
  }
  return calls;
}

describe('rotas da Edge Function', () => {
  const declared = declaredRoutes();
  const called = calledRoutes();

  it('a Edge Function regista rotas', () => {
    // Se a extracção se partir, o teste abaixo passaria por não encontrar nada.
    expect(declared.size).toBeGreaterThan(30);
    expect(declared.has('/health')).toBe(true);
  });

  it('o frontend chama rotas', () => {
    expect(called.size).toBeGreaterThan(10);
  });

  it('todas as rotas que o frontend chama existem na Edge Function', () => {
    const missing = [...called.entries()]
      .filter(([route]) => !declared.has(route))
      .map(([route, file]) => `${route} (${file})`);
    expect(missing).toEqual([]);
  });

  it('as rotas acrescentadas nesta fase estão registadas', () => {
    // Explícitas para o teste falhar com um nome, e não só com uma lista vazia que mudou.
    for (const route of [
      '/account/welcome',
      '/admin/orders/payment-status',
      '/admin/email/templates',
      '/admin/email/preview',
      '/admin/email/resend',
    ]) {
      expect(declared.has(route), route).toBe(true);
    }
  });
});
