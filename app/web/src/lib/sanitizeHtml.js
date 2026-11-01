import DOMPurify from 'dompurify';

/**
 * Sanitização de HTML com DOMPurify (descrições de livros, slides, biografias, registo de emails).
 * Remove scripts, handlers inline (onerror, onload…) e URLs javascript:, incluindo variantes
 * ofuscadas que as antigas expressões regulares deixavam passar (ex.: <img/src=x/onerror=…>).
 */
export function sanitizeHtml(html) {
  if (!html || typeof html !== 'string') return '';
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['style', 'form', 'input', 'button', 'textarea', 'select'],
  });
}

/** Escapa valores para filtros PocketBase (evita injecção em filter strings). */
export function escapeFilterValue(value) {
  if (value == null) return '';
  return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}
