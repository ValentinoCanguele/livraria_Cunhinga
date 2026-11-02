import { describe, expect, it } from 'vitest';
import {
  MAX_SUGGESTIONS,
  buildSearchSuggestions,
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

  it('não repete o mesmo autor por cada livro dele', () => {
    // "Ellen G. White" assina dois títulos do catálogo; a lista mostra o nome uma vez.
    const s = buildSearchSuggestions(CATALOGO, 'ellen');
    const autores = s.filter((x) => x.tipo === 'autor');
    expect(autores).toHaveLength(1);
    expect(autores[0].texto).toBe('Ellen G. White');
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
