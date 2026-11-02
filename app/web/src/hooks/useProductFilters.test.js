import { describe, expect, it } from 'vitest';
import { buildCatalogSearchParams } from '@/hooks/useProductFilters';

describe('buildCatalogSearchParams', () => {
  it('serializa filtros ativos sem perder opções dinâmicas', () => {
    const activeFilters = {
      categories: ['fantasia', 'romance'],
      collection: 'colecao-1',
      minPrice: 500,
      maxPrice: 2000,
      search: 'jardim secreto',
      author: 'tolkien',
      isbn: '978-1',
      publisher: 'editora x',
      language: 'pt',
      yearFrom: '2020',
      yearTo: '2024',
      featuredOnly: true,
      inStockOnly: true,
      options: {
        acabamento: ['capa-dura', 'capa-suave'],
      },
    };

    const params = buildCatalogSearchParams(activeFilters, 2500);

    expect(params.get('category')).toBe('fantasia,romance');
    expect(params.get('collection')).toBe('colecao-1');
    expect(params.get('search')).toBe('jardim secreto');
    expect(params.get('minPrice')).toBe('500');
    expect(params.get('maxPrice')).toBe('2000');
    expect(params.get('featuredOnly')).toBe('true');
    expect(params.get('inStockOnly')).toBe('true');
    expect(params.getAll('acabamento')).toEqual(['capa-dura', 'capa-suave']);
  });

  it('não inclui maxPrice quando o limite da query já é maior ou igual ao disponível', () => {
    const activeFilters = {
      categories: [],
      collection: '',
      search: '',
      author: '',
      isbn: '',
      publisher: '',
      language: '',
      yearFrom: '',
      yearTo: '',
      featuredOnly: false,
      inStockOnly: false,
      minPrice: 0,
      maxPrice: Infinity,
      options: {},
    };

    const params = buildCatalogSearchParams(activeFilters, 4000);

    expect(params.has('maxPrice')).toBe(false);
    expect(params.has('minPrice')).toBe(false);
  });
});
