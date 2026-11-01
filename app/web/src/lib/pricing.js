/**
 * Preço em vigor de um livro: o promocional (sale_price) se estiver activo nas datas definidas,
 * senão o preço normal. É a mesma regra de public.effective_price na base de dados, que é a que
 * o checkout cobra; aqui serve só para mostrar.
 */
export function isSaleActive(book, now = Date.now()) {
  const price = Number(book?.price) || 0;
  const sale = Number(book?.sale_price) || 0;
  if (!(sale > 0 && sale < price)) return false;
  const started = !book?.sale_starts_at || new Date(book.sale_starts_at).getTime() <= now;
  const notEnded = !book?.sale_ends_at || new Date(book.sale_ends_at).getTime() > now;
  return started && notEnded;
}

export function effectivePrice(book, now = Date.now()) {
  return isSaleActive(book, now) ? Number(book.sale_price) : Number(book?.price) || 0;
}

/** Promoção definida mas ainda por começar (para o painel). */
export function isSaleScheduled(book, now = Date.now()) {
  const price = Number(book?.price) || 0;
  const sale = Number(book?.sale_price) || 0;
  return sale > 0 && sale < price && !!book?.sale_starts_at && new Date(book.sale_starts_at).getTime() > now;
}

/** Livro visível na loja (os antigos, sem a coluna, contam como visíveis). */
export const isBookVisible = (book) => book?.active !== false;

/** ISO → valor de <input type="datetime-local"> (hora local). */
export function toLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Valor de <input type="datetime-local"> → ISO (ou null se vazio). */
export function fromLocalInput(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
