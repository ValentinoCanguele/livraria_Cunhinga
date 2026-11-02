import { describe, expect, it } from 'vitest';
import {
  FLAG_DEFAULTS,
  FLAG_NAMES,
  applyFlagsToDocument,
  readFlagOverrides,
  resolveFlags,
} from '@/lib/featureFlags';

/** Armazenamento em memória, para os testes não dependerem do localStorage do ambiente. */
function memoria(inicial = {}) {
  const dados = { ...inicial };
  return {
    getItem: (k) => (k in dados ? dados[k] : null),
    setItem: (k, v) => { dados[k] = String(v); },
    removeItem: (k) => { delete dados[k]; },
    _dados: dados,
  };
}

/** Armazenamento que rebenta — modo privado, cookies bloqueados. */
const indisponivel = {
  getItem() { throw new Error('bloqueado'); },
  setItem() { throw new Error('bloqueado'); },
  removeItem() { throw new Error('bloqueado'); },
};

describe('readFlagOverrides', () => {
  it('sem nada, não há desvios', () => {
    expect(readFlagOverrides({ search: '', storage: memoria() })).toEqual({});
  });

  it('lê um desvio do endereço', () => {
    expect(readFlagOverrides({ search: '?ff=elevacao:0', storage: memoria() }))
      .toEqual({ elevacao: false });
  });

  it('lê vários de uma vez', () => {
    expect(readFlagOverrides({ search: '?ff=elevacao:0,zoomImagem:0', storage: memoria() }))
      .toEqual({ elevacao: false, zoomImagem: false });
  });

  it('aceita as várias formas de dizer sim e não', () => {
    const store = memoria();
    for (const v of ['0', 'false', 'off', 'nao']) {
      expect(readFlagOverrides({ search: `?ff=elevacao:${v}`, storage: store }).elevacao, v).toBe(false);
    }
    for (const v of ['1', 'true', 'on', 'sim']) {
      expect(readFlagOverrides({ search: `?ff=elevacao:${v}`, storage: store }).elevacao, v).toBe(true);
    }
  });

  it('um nome sozinho liga a flag', () => {
    expect(readFlagOverrides({ search: '?ff=elevacao', storage: memoria() }))
      .toEqual({ elevacao: true });
  });

  it('guarda para as páginas seguintes', () => {
    // Quem está a testar não quer repetir o parâmetro em cada clique.
    const store = memoria();
    readFlagOverrides({ search: '?ff=elevacao:0', storage: store });
    expect(readFlagOverrides({ search: '', storage: store })).toEqual({ elevacao: false });
  });

  it('`reset` limpa o que estava guardado', () => {
    const store = memoria();
    readFlagOverrides({ search: '?ff=elevacao:0', storage: store });
    expect(readFlagOverrides({ search: '?ff=reset', storage: store })).toEqual({});
    expect(readFlagOverrides({ search: '', storage: store })).toEqual({});
  });

  it('ignora nomes que não existem', () => {
    // Um valor antigo no armazenamento não pode ressuscitar um efeito que já não existe,
    // nem inventar um que nunca existiu.
    expect(readFlagOverrides({ search: '?ff=inventado:1', storage: memoria() })).toEqual({});
    expect(readFlagOverrides({ search: '', storage: memoria({ livraria_ff: '{"inventado":true}' }) }))
      .toEqual({});
  });

  it('aguenta armazenamento corrompido ou bloqueado', () => {
    expect(readFlagOverrides({ search: '', storage: memoria({ livraria_ff: 'isto não é json' }) }))
      .toEqual({});
    expect(() => readFlagOverrides({ search: '?ff=elevacao:0', storage: indisponivel })).not.toThrow();
    expect(readFlagOverrides({ search: '?ff=elevacao:0', storage: indisponivel }))
      .toEqual({ elevacao: false });
  });
});

describe('resolveFlags', () => {
  it('por omissão vem tudo ligado', () => {
    expect(resolveFlags({ storage: memoria() })).toEqual(FLAG_DEFAULTS);
  });

  it('o endereço manda sobre o que está por omissão', () => {
    const flags = resolveFlags({ search: '?ff=elevacao:0', storage: memoria() });
    expect(flags.elevacao).toBe(false);
    expect(flags.transicoes).toBe(true);
  });

  it('menos movimento desliga o que é movimento', () => {
    const flags = resolveFlags({ storage: memoria(), reducedMotion: true });
    expect(flags.transicoes).toBe(false);
    expect(flags.zoomImagem).toBe(false);
    // A elevação fica: é sombra e profundidade, não movimento. Tirá-la tornava a página
    // mais pobre sem acalmar nada.
    expect(flags.elevacao).toBe(true);
  });

  it('menos movimento ganha a um pedido explícito pelo endereço', () => {
    // Quem configurou o sistema para ter menos movimento não deve apanhar animações por
    // ter aberto um link com um parâmetro.
    const flags = resolveFlags({ search: '?ff=transicoes:1', storage: memoria(), reducedMotion: true });
    expect(flags.transicoes).toBe(false);
  });
});

describe('applyFlagsToDocument', () => {
  it('escreve o estado de cada interruptor no elemento', () => {
    const el = document.createElement('html');
    applyFlagsToDocument({ elevacao: true, transicoes: false, zoomImagem: true }, el);
    expect(el.getAttribute('data-ff-elevacao')).toBe('1');
    expect(el.getAttribute('data-ff-transicoes')).toBe('0');
    // Em minúsculas: os selectores de atributo em CSS distinguem maiúsculas em XHTML, e
    // escrevê-los sempre assim evita um selector que funciona num sítio e noutro não.
    expect(el.getAttribute('data-ff-zoomimagem')).toBe('1');
  });

  it('escreve todos os interruptores conhecidos', () => {
    const el = document.createElement('html');
    applyFlagsToDocument(FLAG_DEFAULTS, el);
    for (const nome of FLAG_NAMES) {
      expect(el.hasAttribute(`data-ff-${nome.toLowerCase()}`), nome).toBe(true);
    }
  });

  it('o que vier em falta fica desligado, não indefinido', () => {
    const el = document.createElement('html');
    applyFlagsToDocument({}, el);
    expect(el.getAttribute('data-ff-elevacao')).toBe('0');
  });

  it('não rebenta sem elemento', () => {
    expect(() => applyFlagsToDocument(FLAG_DEFAULTS, null)).not.toThrow();
  });
});
