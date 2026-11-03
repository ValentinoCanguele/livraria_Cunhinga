import { describe, expect, it } from 'vitest';
import {
  MAX_SUGGESTIONS,
  buildSearchSuggestions,
  getSearchRelevance,
  matchesTokenizedSearch,
  normalizeForSearch,
} from '@/lib/searchUtils';

const CATALOGO = [
  { id: '1', title: 'Educação e Instrução', author: 'Ellen G. White', publisher: 'Casa Publicadora' },
  { id: '2', title: 'O Grande Conflito', author: 'Ellen G. White', publisher: 'Casa Publicadora' },
  { id: '3', title: 'Profecias de Daniel', author: 'Clifford Goldstein', publisher: 'Pacific Press' },
  { id: '4', title: 'Fé que Transforma', author: 'Morris Venden', publisher: 'Pacific Press' },
];

describe('normalizeForSearch', () => {
  it('tira maiúsculas e acentos', () => {
    expect(normalizeForSearch('Educação')).toBe('educacao');
    expect(normalizeForSearch('Fé')).toBe('fe');
    expect(normalizeForSearch('PROFECÍA')).toBe('profecia');
    expect(normalizeForSearch('João Gonçalves')).toBe('joao goncalves');
    expect(normalizeForSearch('LIV-101 / ISBN 978-1')).toBe('liv 101 isbn 978 1');
  });

  it('aguenta valores em falta', () => {
    expect(normalizeForSearch(null)).toBe('');
    expect(normalizeForSearch(undefined)).toBe('');
    expect(normalizeForSearch(42)).toBe('42');
  });
});

describe('matchesTokenizedSearch', () => {
  it('encontra sem os acentos estarem escritos', () => {
    // Quem escreve no telemóvel raramente põe acentos. Antes desta correcção, procurar
    // "educacao" não devolvia "Educação e Instrução".
    expect(matchesTokenizedSearch('Educação e Instrução', 'educacao')).toBe(true);
    expect(matchesTokenizedSearch('Fé que Transforma', 'fe')).toBe(true);
    expect(matchesTokenizedSearch('Profecias de Daniel', 'profecias')).toBe(true);
  });

  it('encontra com os acentos escritos', () => {
    expect(matchesTokenizedSearch('Educação e Instrução', 'educação')).toBe(true);
  });

  it('exige todas as palavras', () => {
    expect(matchesTokenizedSearch('O Grande Conflito', 'grande conflito')).toBe(true);
    expect(matchesTokenizedSearch('O Grande Conflito', 'grande daniel')).toBe(false);
  });

  it('aceita prefixos e corrige um erro simples em palavras longas', () => {
    expect(matchesTokenizedSearch('O Grande Conflito', 'grand conf')).toBe(true);
    expect(matchesTokenizedSearch('Profecias de Daniel', 'profecia')).toBe(true);
    expect(matchesTokenizedSearch('Profecias de Daniel', 'profeciaz')).toBe(true);
    expect(matchesTokenizedSearch('Fé que Transforma', 'fez')).toBe(false);
  });

  it('sem termo, deixa passar tudo', () => {
    expect(matchesTokenizedSearch('qualquer coisa', '')).toBe(true);
    expect(matchesTokenizedSearch('qualquer coisa', '   ')).toBe(true);
  });
});

describe('buildSearchSuggestions', () => {
  it('cala-se com menos de duas letras', () => {
    // Com uma letra, metade do catálogo corresponde: a lista não ajudaria a decidir nada.
    expect(buildSearchSuggestions(CATALOGO, '')).toEqual([]);
    expect(buildSearchSuggestions(CATALOGO, 'e')).toEqual([]);
  });

  it('sugere títulos primeiro', () => {
    const s = buildSearchSuggestions(CATALOGO, 'profec');
    expect(s[0]).toMatchObject({ tipo: 'livro', texto: 'Profecias de Daniel', id: '3' });
  });

  it('encontra sem acentos', () => {
    const s = buildSearchSuggestions(CATALOGO, 'educacao');
    expect(s.map((x) => x.texto)).toContain('Educação e Instrução');
  });

  it('sugere autores e editoras depois dos títulos', () => {
    const s = buildSearchSuggestions(CATALOGO, 'pacific');
    expect(s.every((x) => x.tipo !== 'livro')).toBe(true);
    expect(s.map((x) => x.texto)).toContain('Pacific Press');
  });

  it('usa subtitle como autor, como vem mapeado no catálogo da loja', () => {
    const s = buildSearchSuggestions([{ id: '5', title: 'Novo livro', subtitle: 'Autor Exemplo' }], 'autor');
    expect(s).toContainEqual({ tipo: 'autor', texto: 'Autor Exemplo' });
  });

  it('ordena sugestões de livro pela relevância do título', () => {
    const s = buildSearchSuggestions([
      { id: '1', title: 'Uma história', description: 'Grande conflito em detalhe' },
      { id: '2', title: 'O Grande Conflito' },
    ], 'grande conflito');
    expect(s[0]).toMatchObject({ tipo: 'livro', id: '2', texto: 'O Grande Conflito' });
  });

  it('não repete o mesmo autor por cada livro dele', () => {
    // "Ellen G. White" assina dois títulos do catálogo; a lista mostra o nome uma vez.
    const s = buildSearchSuggestions(CATALOGO, 'ellen');
    const autores = s.filter((x) => x.tipo === 'autor');
    expect(autores).toHaveLength(1);
    expect(autores[0].texto).toBe('Ellen G. White');
  });

  describe('getSearchRelevance', () => {
    it('prefere título a descrição quando ambos correspondem', () => {
      const titleMatch = getSearchRelevance({ title: 'Educação cristã' }, 'educacao');
      const descriptionMatch = getSearchRelevance({ title: 'Outro livro', description: 'Educação cristã' }, 'educacao');
      expect(titleMatch).toBeGreaterThan(descriptionMatch);
    });

    it('pontua autor, código e correspondência exacta do título', () => {
      expect(getSearchRelevance({ title: 'Livro', subtitle: 'Ellen White' }, 'ellen')).toBeGreaterThan(0);
      expect(getSearchRelevance({ title: 'Livro', book_code: 'LIV-101' }, 'liv 101')).toBeGreaterThan(0);
      expect(getSearchRelevance({ title: 'Grande Conflito' }, 'grande conflito'))
        .toBeGreaterThan(getSearchRelevance({ title: 'O Grande Conflito' }, 'grande'));
    });

    it('não dá relevância a um resultado que falha um dos termos', () => {
      expect(getSearchRelevance({ title: 'O Grande Conflito' }, 'grande daniel')).toBe(0);
    });
  });

  it('respeita o limite', () => {
    const muitos = Array.from({ length: 40 }, (_, i) => ({
      id: String(i), title: `Profecia número ${i}`, author: `Autor ${i}`, publisher: 'Editora',
    }));
    expect(buildSearchSuggestions(muitos, 'profecia')).toHaveLength(MAX_SUGGESTIONS);
    expect(buildSearchSuggestions(muitos, 'profecia', 3)).toHaveLength(3);
  });

  it('devolve vazio quando nada corresponde', () => {
    // Uma sugestão que não dá resultados manda a pessoa a uma página vazia.
    expect(buildSearchSuggestions(CATALOGO, 'astrofisica')).toEqual([]);
  });

  it('aguenta catálogo em falta ou com buracos', () => {
    expect(buildSearchSuggestions(null, 'profecia')).toEqual([]);
    expect(buildSearchSuggestions([null, undefined, {}], 'profecia')).toEqual([]);
    expect(() => buildSearchSuggestions([{ id: '1' }], 'profecia')).not.toThrow();
  });
});
