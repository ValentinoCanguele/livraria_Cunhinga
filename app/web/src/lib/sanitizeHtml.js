/**
 * Sanitização de HTML com lista branca (DOMPurify).
 *
 * A versão anterior era uma lista negra de expressões regulares. Deixava passar,
 * entre outros, `<svg/onload=…>` (o padrão exigia espaço antes do atributo) e
 * `java\tscript:`. Como a sessão do Supabase vive no localStorage, qualquer HTML
 * injectado numa descrição de livro ou num slide chegava a roubar a sessão de um
 * administrador que visitasse a página.
 *
 * O conteúdo vem do editor do painel (equipa), mas quem tem `manage_catalog` não
 * tem de poder executar JavaScript na loja: isto fecha também essa escalada.
 */
import DOMPurify from 'dompurify';

// O que o editor de texto do painel (RichTextEditor) produz, e nada mais.
const ALLOWED_TAGS = [
  'p', 'br', 'hr', 'div', 'span',
  'strong', 'b', 'em', 'i', 'u', 's', 'sub', 'sup', 'mark', 'small',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li', 'blockquote', 'pre', 'code',
  'a', 'img',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption',
];

const ALLOWED_ATTR = ['href', 'target', 'rel', 'title', 'src', 'alt', 'width', 'height', 'class', 'colspan', 'rowspan'];

const CONFIG = {
  ALLOWED_TAGS,
  ALLOWED_ATTR,
  // Só http(s), mailto, tel e imagens embutidas; corta javascript:, data:text/html e afins.
  ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|tel:|data:image\/(?:png|jpe?g|gif|webp|avif);base64,|[^a-z]|[a-z+.-]+(?:[^a-z+.:-]|$))/i,
  FORBID_TAGS: ['style', 'script', 'iframe', 'object', 'embed', 'form', 'input', 'base', 'link', 'meta', 'svg', 'math'],
  FORBID_ATTR: ['style', 'srcdoc', 'formaction', 'xlink:href'],
  ALLOW_DATA_ATTR: false,
  ALLOW_ARIA_ATTR: false,
  USE_PROFILES: { html: true },
};

// Links externos nunca dão acesso ao window da loja nem passam o referrer completo.
let hookInstalled = false;
function installHook() {
  if (hookInstalled || typeof DOMPurify.addHook !== 'function') return;
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName === 'A' && node.getAttribute('href')) {
      node.setAttribute('rel', 'noopener noreferrer nofollow');
      if (node.getAttribute('target')) node.setAttribute('target', '_blank');
    }
    if (node.tagName === 'IMG') node.setAttribute('loading', 'lazy');
  });
  hookInstalled = true;
}

export function sanitizeHtml(html) {
  if (!html || typeof html !== 'string') return '';
  installHook();
  return DOMPurify.sanitize(html, CONFIG);
}

/** Escapa valores para filtros PocketBase (evita injecção em filter strings). */
export function escapeFilterValue(value) {
  if (value == null) return '';
  return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}
