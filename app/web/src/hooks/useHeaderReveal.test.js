import { describe, expect, it } from 'vitest';
import { REVEAL_AT, shouldReveal } from '@/hooks/useHeaderReveal';

describe('shouldReveal', () => {
  it('esconde o cabeçalho no topo, para a imagem de entrada ficar inteira', () => {
    expect(shouldReveal({ scrollY: 0 })).toBe(false);
  });

  it('não se deixa levar pelo ressalto de uns pixels no topo', () => {
    expect(shouldReveal({ scrollY: REVEAL_AT })).toBe(false);
    expect(shouldReveal({ scrollY: REVEAL_AT + 1 })).toBe(true);
  });

  it('mostra o cabeçalho assim que se desce', () => {
    expect(shouldReveal({ scrollY: 400 })).toBe(true);
  });

  it('volta a escondê-lo ao regressar ao topo', () => {
    expect(shouldReveal({ scrollY: 400 })).toBe(true);
    expect(shouldReveal({ scrollY: 0 })).toBe(false);
  });

  it('mantém-no à vista com o menu, a pesquisa ou o foco do teclado lá dentro', () => {
    expect(shouldReveal({ scrollY: 0, forceVisible: true })).toBe(true);
  });

  it('mantém-no à vista numa página que não dá para deslocar', () => {
    // Sem isto uma página curta — um erro, um carrinho vazio — ficava sem navegação
    // nenhuma, porque nunca haveria deslocamento que o fizesse aparecer.
    expect(shouldReveal({ scrollY: 0, scrollable: false })).toBe(true);
  });

  it('assume os valores por omissão quando não recebe nada', () => {
    expect(shouldReveal()).toBe(false);
  });
});
