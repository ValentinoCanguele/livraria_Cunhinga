import { describe, expect, it } from 'vitest';
import {
  MAX_RECENT,
  addRecentlyViewed,
  clearRecentlyViewed,
  getRecentlyViewed,
  recentExcluding,
  toRecentEntry,
} from '@/lib/recentlyViewed';

function memoria(inicial = {}) {
  const dados = { ...inicial };
  return {
    getItem: (k) => (k in dados ? dados[k] : null),
    setItem: (k, v) => { dados[k] = String(v); },
    removeItem: (k) => { delete dados[k]; },
  };
}

const cheio = {
  getItem: () => null,
  setItem() { throw new Error('QuotaExceededError'); },
  removeItem() {},
};

const livro = (id, extra = {}) => ({
  id,
  title: `Livro ${id}`,
  image: `https://exemplo.ao/${id}.jpg`,
  author: 'Autor',
  variants: [{ price_formatted: 'Kz 5 000,00' }],
  ...extra,
});

describe('toRecentEntry', () => {
  it('guarda só o que o cartão precisa', () => {
    const e = toRecentEntry(livro('a1'));
    expect(e).toMatchObject({
      id: 'a1', title: 'Livro a1', image: 'https://exemplo.ao/a1.jpg',
      price: 'Kz 5 000,00', author: 'Autor',
    });
    expect(typeof e.at).toBe('number');
    // Não arrasta o produto inteiro: o armazenamento do navegador é pequeno, e os dados
    // ficariam velhos — um preço que mudasse apareceria errado para sempre.
    expect(Object.keys(e).sort()).toEqual(['at', 'author', 'id', 'image', 'price', 'title']);
  });

  it('prefere o preço promocional quando existe', () => {
    const e = toRecentEntry(livro('a1', { variants: [{ price_formatted: 'Kz 5 000,00', sale_price_formatted: 'Kz 3 000,00' }] }));
    expect(e.price).toBe('Kz 3 000,00');
  });

  it('recusa o que não tem identificação', () => {
    expect(toRecentEntry(null)).toBeNull();
    expect(toRecentEntry({})).toBeNull();
    expect(toRecentEntry({ title: 'sem id' })).toBeNull();
  });

  it('aguenta campos em falta', () => {
    const e = toRecentEntry({ id: 'a1' });
    expect(e).toMatchObject({ id: 'a1', title: '', image: '', price: '', author: '' });
  });
});

describe('addRecentlyViewed', () => {
  it('põe o mais recente à frente', () => {
    const s = memoria();
    addRecentlyViewed(livro('a1'), { storage: s });
    addRecentlyViewed(livro('a2'), { storage: s });
    expect(getRecentlyViewed({ storage: s }).map((e) => e.id)).toEqual(['a2', 'a1']);
  });

  it('rever um livro move-o em vez de o repetir', () => {
    // Uma lista com o mesmo título cinco vezes não é um histórico, é ruído.
    const s = memoria();
    addRecentlyViewed(livro('a1'), { storage: s });
    addRecentlyViewed(livro('a2'), { storage: s });
    addRecentlyViewed(livro('a1'), { storage: s });
    expect(getRecentlyViewed({ storage: s }).map((e) => e.id)).toEqual(['a1', 'a2']);
  });

  it('guarda no máximo MAX_RECENT', () => {
    const s = memoria();
    for (let i = 0; i < MAX_RECENT + 5; i++) addRecentlyViewed(livro(`a${i}`), { storage: s });
    const lista = getRecentlyViewed({ storage: s });
    expect(lista).toHaveLength(MAX_RECENT);
    // Os mais antigos é que saem.
    expect(lista[0].id).toBe(`a${MAX_RECENT + 4}`);
    expect(lista.some((e) => e.id === 'a0')).toBe(false);
  });

  it('ignora produtos sem identificação', () => {
    const s = memoria();
    addRecentlyViewed(livro('a1'), { storage: s });
    expect(addRecentlyViewed(null, { storage: s }).map((e) => e.id)).toEqual(['a1']);
    expect(addRecentlyViewed({}, { storage: s }).map((e) => e.id)).toEqual(['a1']);
  });

  it('não rebenta com o armazenamento cheio', () => {
    // Perde-se o histórico, não a navegação.
    expect(() => addRecentlyViewed(livro('a1'), { storage: cheio })).not.toThrow();
  });
});

describe('getRecentlyViewed', () => {
  it('devolve lista vazia sem nada guardado', () => {
    expect(getRecentlyViewed({ storage: memoria() })).toEqual([]);
  });

  it('aguenta valores corrompidos', () => {
    // Um valor estranho no armazenamento não pode derrubar a página que o lê.
    expect(getRecentlyViewed({ storage: memoria({ livraria_vistos: 'nao é json' }) })).toEqual([]);
    expect(getRecentlyViewed({ storage: memoria({ livraria_vistos: '{"a":1}' }) })).toEqual([]);
    expect(getRecentlyViewed({ storage: memoria({ livraria_vistos: '[1,2,null,"x"]' }) })).toEqual([]);
  });

  it('descarta entradas sem identificação', () => {
    const s = memoria({ livraria_vistos: '[{"id":"a1"},{"titulo":"sem id"},{"id":5}]' });
    expect(getRecentlyViewed({ storage: s }).map((e) => e.id)).toEqual(['a1']);
  });
});

describe('clearRecentlyViewed', () => {
  it('esquece tudo', () => {
    const s = memoria();
    addRecentlyViewed(livro('a1'), { storage: s });
    expect(clearRecentlyViewed({ storage: s })).toEqual([]);
    expect(getRecentlyViewed({ storage: s })).toEqual([]);
  });
});

describe('recentExcluding', () => {
  it('tira o livro que se está a ver', () => {
    // A ficha de um livro mostrava-o a si própria na fila dos vistos há pouco.
    const lista = [{ id: 'a1' }, { id: 'a2' }, { id: 'a3' }];
    expect(recentExcluding(lista, 'a2').map((e) => e.id)).toEqual(['a1', 'a3']);
  });

  it('compara identificações de tipos diferentes', () => {
    expect(recentExcluding([{ id: '7' }, { id: '8' }], 7).map((e) => e.id)).toEqual(['8']);
  });

  it('devolve tudo quando não há livro actual', () => {
    const lista = [{ id: 'a1' }];
    expect(recentExcluding(lista, null)).toEqual(lista);
    expect(recentExcluding(lista, undefined)).toEqual(lista);
  });

  it('aguenta lista em falta', () => {
    expect(recentExcluding(null, 'a1')).toEqual([]);
    expect(recentExcluding(undefined, 'a1')).toEqual([]);
  });
});
