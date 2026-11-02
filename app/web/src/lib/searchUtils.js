/**
 * Texto comparável: sem maiúsculas e sem acentos.
 *
 * Num catálogo português isto não é um extra. Quem escreve no telemóvel raramente põe
 * acentos, e sem esta normalização "educacao" não encontrava "Educação", "fe" não encontrava
 * "Fé" e "profecia" não encontrava "Profecía". A decomposição separa a letra do acento, e o
 * intervalo `\u0300-\u036f` apanha os sinais soltos que ficam.
 */
export function normalizeForSearch(value) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/** Pesquisa por palavras — todas as palavras devem aparecer no texto. */
export function matchesTokenizedSearch(haystack, query) {
  if (!query?.trim()) return true;
  const text = normalizeForSearch(haystack);
  const tokens = normalizeForSearch(query).trim().split(/\s+/).filter(Boolean);
  return tokens.every((t) => text.includes(t));
}

export function buildProductSearchHaystack(product) {
  return [
    product.title,
    product.subtitle,
    product.description,
    product.book_code,
    product.isbn,
    product.sku,
    product.seo_keywords,
    product.publisher,
    product.collection_title,
    product.language,
    product.type?.value,
  ].filter(Boolean).join(' ');
}

/** Quantas sugestões mostrar. Mais do que isto tapa a página em vez de ajudar. */
export const MAX_SUGGESTIONS = 6;

const MIN_QUERY = 2;

/**
 * Sugestões para o que está a ser escrito na pesquisa.
 *
 * Só do catálogo que está carregado — nada é inventado nem pedido ao servidor. Uma sugestão
 * que não dá resultados é pior do que nenhuma: manda a pessoa a uma página vazia e ensina-a
 * a desconfiar da caixa de pesquisa.
 *
 * Os títulos vêm primeiro porque é o que se procura quase sempre; autores e editoras a
 * seguir, para quem anda à procura de tudo o que há de alguém.
 */
export function buildSearchSuggestions(products, query, limit = MAX_SUGGESTIONS) {
  const termo = normalizeForSearch(query).trim();
  if (termo.length < MIN_QUERY) return [];

  const vistos = new Set();
  const titulos = [];
  const autores = [];
  const editoras = [];

  for (const p of products || []) {
    if (!p) continue;

    if (titulos.length < limit && normalizeForSearch(p.title).includes(termo)) {
      const chave = `livro:${p.id}`;
      if (!vistos.has(chave)) {
        vistos.add(chave);
        titulos.push({ tipo: 'livro', texto: String(p.title || ''), id: String(p.id), autor: String(p.author || '') });
      }
    }

    // Autores e editoras aparecem repetidos no catálogo: conta o nome, não o livro.
    if (p.author && normalizeForSearch(p.author).includes(termo)) {
      const chave = `autor:${normalizeForSearch(p.author)}`;
      if (!vistos.has(chave)) {
        vistos.add(chave);
        autores.push({ tipo: 'autor', texto: String(p.author) });
      }
    }

    if (p.publisher && normalizeForSearch(p.publisher).includes(termo)) {
      const chave = `editora:${normalizeForSearch(p.publisher)}`;
      if (!vistos.has(chave)) {
        vistos.add(chave);
        editoras.push({ tipo: 'editora', texto: String(p.publisher) });
      }
    }
  }

  return [...titulos, ...autores, ...editoras].slice(0, limit);
}
