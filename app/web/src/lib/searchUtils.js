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
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function editDistanceAtMostOne(a, b) {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else {
      i++;
      j++;
    }
  }
  return edits + Number(i < a.length || j < b.length) <= 1;
}

function tokenMatches(text, token) {
  if (text.includes(token)) return true;
  const words = text.split(' ');
  return words.some((word) => (
    word.startsWith(token)
    || (token.length >= 5 && word.length >= 5 && editDistanceAtMostOne(word, token))
  ));
}

/** Pesquisa por palavras sem acentos, tolerando prefixos e um erro simples de escrita. */
export function matchesTokenizedSearch(haystack, query) {
  if (!query?.trim()) return true;
  const text = normalizeForSearch(haystack);
  const tokens = normalizeForSearch(query).split(/\s+/).filter(Boolean);
  return tokens.every((token) => tokenMatches(text, token));
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

const SEARCH_FIELDS = [
  { get: (p) => p.title, weight: 100 },
  { get: (p) => p.book_code, weight: 95 },
  { get: (p) => p.isbn, weight: 95 },
  { get: (p) => p.sku, weight: 90 },
  { get: (p) => p.author || p.subtitle, weight: 80 },
  { get: (p) => p.publisher, weight: 55 },
  { get: (p) => p.collection_title, weight: 45 },
  { get: (p) => p.type?.value, weight: 40 },
  { get: (p) => p.language, weight: 30 },
  { get: (p) => p.seo_keywords, weight: 25 },
  { get: (p) => p.description, weight: 10 },
];

/** Pontua correspondências nos campos mais úteis antes dos detalhes menos específicos. */
export function getSearchRelevance(product, query) {
  const normalizedQuery = normalizeForSearch(query);
  if (!normalizedQuery) return 0;
  const tokens = normalizedQuery.split(/\s+/).filter(Boolean);
  const fields = SEARCH_FIELDS.map(({ get, weight }) => ({
    text: normalizeForSearch(get(product) || ''),
    weight,
  })).filter((field) => field.text);

  if (!tokens.every((token) => fields.some(({ text }) => tokenMatches(text, token)))) return 0;

  let score = 0;
  for (const token of tokens) {
    const best = fields.reduce((highest, { text, weight }) => (
      tokenMatches(text, token) ? Math.max(highest, weight) : highest
    ), 0);
    score += best;
  }

  const title = normalizeForSearch(product.title || '');
  if (title.includes(normalizedQuery)) score += 100;
  else if (tokens.every((token) => tokenMatches(title, token))) score += 40;
  return score;
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

  const livros = [];
  const autores = new Map();
  const editoras = new Map();

  for (const p of products || []) {
    if (!p) continue;

    const relevance = getSearchRelevance({
      title: p.title,
      book_code: p.book_code,
      isbn: p.isbn,
      sku: p.sku,
      author: p.author || p.subtitle,
    }, termo);
    if (relevance > 0 && p.id && p.title) {
      livros.push({
        tipo: 'livro',
        texto: String(p.title),
        id: String(p.id),
        autor: String(p.author || p.subtitle || ''),
        relevance,
      });
    }

    const author = String(p.author || p.subtitle || '').trim();
    if (author && matchesTokenizedSearch(author, termo)) {
      const key = normalizeForSearch(author);
      if (!autores.has(key)) autores.set(key, { tipo: 'autor', texto: author, relevance: getSearchRelevance({ title: '', author }, termo) });
    }

    const publisher = String(p.publisher || '').trim();
    if (publisher && matchesTokenizedSearch(publisher, termo)) {
      const key = normalizeForSearch(publisher);
      if (!editoras.has(key)) editoras.set(key, { tipo: 'editora', texto: publisher, relevance: getSearchRelevance({ publisher }, termo) });
    }
  }

  livros.sort((a, b) => b.relevance - a.relevance || a.texto.localeCompare(b.texto));
  const extras = [...autores.values(), ...editoras.values()]
    .sort((a, b) => b.relevance - a.relevance || a.texto.localeCompare(b.texto));
  return [...livros, ...extras].slice(0, limit).map(({ relevance: _relevance, ...suggestion }) => suggestion);
}
