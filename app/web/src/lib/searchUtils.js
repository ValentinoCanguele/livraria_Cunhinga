/** Pesquisa por palavras — todas as palavras devem aparecer no texto. */
export function matchesTokenizedSearch(haystack, query) {
  if (!query?.trim()) return true;
  const text = (haystack || '').toLowerCase();
  const tokens = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
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
