import { describe, expect, it } from 'vitest';
import { EDGE_FUNCTION_DESACTUALIZADA, isMissingRoute } from '@/lib/apiCompat';
import { DataError } from '@/lib/dataClient';

describe('isMissingRoute', () => {
  it('reconhece a recusa de um caminho que a função não conhece', () => {
    // É a mensagem exacta com que a Edge Function responde a uma rota desconhecida.
    expect(isMissingRoute(new DataError('Rota não encontrada.', 404))).toBe(true);
  });

  it('não confunde com um registo que não existe', () => {
    // Estas também são 404, mas vêm de rotas que existem: tratá-las como rota em falta
    // levaria a gravar na tabela por cima de um erro verdadeiro.
    expect(isMissingRoute(new DataError('Encomenda não encontrada.', 404))).toBe(false);
    expect(isMissingRoute(new DataError('Registo não encontrado.', 404))).toBe(false);
  });

  it('ignora erros com outro código', () => {
    expect(isMissingRoute(new DataError('Rota não encontrada.', 500))).toBe(false);
    expect(isMissingRoute(new DataError('Sem permissão para esta operação.', 403))).toBe(false);
    expect(isMissingRoute(new DataError('Servidor indisponível.', 0))).toBe(false);
  });

  it('aguenta erros mal formados', () => {
    expect(isMissingRoute(null)).toBe(false);
    expect(isMissingRoute(undefined)).toBe(false);
    expect(isMissingRoute({})).toBe(false);
    expect(isMissingRoute({ status: 404 })).toBe(false);
    expect(isMissingRoute(new Error('Rota não encontrada.'))).toBe(false);
  });

  it('não distingue maiúsculas', () => {
    expect(isMissingRoute(new DataError('ROTA NÃO ENCONTRADA.', 404))).toBe(true);
  });
});

describe('EDGE_FUNCTION_DESACTUALIZADA', () => {
  it('diz o que é preciso fazer, e não só o que correu mal', () => {
    expect(EDGE_FUNCTION_DESACTUALIZADA).toContain('Publique a Edge Function');
  });
});
