/**
 * Sanitização básica de HTML — remove scripts, iframes e handlers inline.
 * Conteúdo vem do admin (editor); esta camada protege visitantes contra XSS.
 */
export function sanitizeHtml(html) {
  if (!html || typeof html !== 'string') return '';
  let out = html;
  out = out.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  out = out.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');
  out = out.replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '');
  out = out.replace(/<embed\b[^>]*>/gi, '');
  out = out.replace(/\s+on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  out = out.replace(/javascript:/gi, '');
  out = out.replace(/data:\s*text\/html/gi, '');
  return out;
}

/** Escapa valores para filtros PocketBase (evita injecção em filter strings). */
export function escapeFilterValue(value) {
  if (value == null) return '';
  return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}
