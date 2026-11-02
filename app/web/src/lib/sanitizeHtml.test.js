import { describe, it, expect } from 'vitest';
import { sanitizeHtml, escapeFilterValue } from '@/lib/sanitizeHtml';

// Cada caso abaixo passava pela lista negra de expressões regulares que existia antes.
describe('sanitizeHtml — bypasses da versão antiga', () => {
  const deveSerInerte = (entrada) => {
    const saida = sanitizeHtml(entrada);
    expect(saida).not.toMatch(/<script/i);
    expect(saida).not.toMatch(/\son\w+\s*=/i);
    expect(saida).not.toMatch(/\/on\w+\s*=/i);
    expect(saida).not.toMatch(/javascript\s*:/i);
    return saida;
  };

  it('barra handlers sem espaço antes do atributo', () => {
    // A regex antiga exigia /\s+on\w+/, por isso a barra passava intacta.
    deveSerInerte('<svg/onload=alert(1)>');
    deveSerInerte('<img/onerror=alert(1) src=x>');
  });

  it('barra handlers normais', () => {
    deveSerInerte('<img src=x onerror="alert(1)">');
    deveSerInerte('<div onmouseover=alert(1)>passa o rato</div>');
  });

  it('barra javascript: com espaços e entidades no meio', () => {
    deveSerInerte('<a href="java\tscript:alert(1)">ligação</a>');
    deveSerInerte('<a href="JaVaScRiPt:alert(1)">ligação</a>');
  });

  it('barra tags que executam ou mudam a base da página', () => {
    expect(sanitizeHtml('<iframe src="https://exemplo.invalid"></iframe>')).not.toMatch(/<iframe/i);
    expect(sanitizeHtml('<base href="https://atacante.invalid/">')).not.toMatch(/<base/i);
    expect(sanitizeHtml('<style>body{display:none}</style>')).not.toMatch(/<style/i);
    expect(sanitizeHtml('<form action="/x"><input name="a"></form>')).not.toMatch(/<(form|input)/i);
  });

  it('barra scripts partidos ao meio', () => {
    deveSerInerte('<scr<script>ipt>alert(1)</scr</script>ipt>');
  });

  it('barra srcdoc e data:text/html', () => {
    expect(sanitizeHtml('<img srcdoc="<script>alert(1)</script>">')).not.toMatch(/srcdoc/i);
    expect(sanitizeHtml('<a href="data:text/html;base64,PHNjcmlwdD4=">x</a>')).not.toMatch(/text\/html/i);
  });
});

describe('sanitizeHtml — o que o editor do painel produz continua a passar', () => {
  it('mantém formatação, listas e tabelas', () => {
    const entrada = '<p><strong>Livro</strong> de <em>Ellen G. White</em></p><ul><li>Capítulo 1</li></ul>'
      + '<table><tbody><tr><td colspan="2">preço</td></tr></tbody></table>';
    expect(sanitizeHtml(entrada)).toBe(entrada);
  });

  it('mantém títulos, citações e código', () => {
    const entrada = '<h3>Resumo</h3><blockquote>Citação</blockquote><pre><code>LIV-101</code></pre>';
    expect(sanitizeHtml(entrada)).toBe(entrada);
  });

  it('mantém imagens https e acrescenta loading=lazy', () => {
    const saida = sanitizeHtml('<img src="https://exemplo.invalid/capa.webp" alt="capa">');
    expect(saida).toMatch(/src="https:\/\/exemplo\.invalid\/capa\.webp"/);
    expect(saida).toMatch(/loading="lazy"/);
  });

  it('mantém ligações https e fecha-as com rel seguro', () => {
    const saida = sanitizeHtml('<a href="https://exemplo.invalid" target="_blank">loja</a>');
    expect(saida).toMatch(/href="https:\/\/exemplo\.invalid"/);
    expect(saida).toMatch(/rel="noopener noreferrer nofollow"/);
  });

  it('aceita mailto e tel', () => {
    expect(sanitizeHtml('<a href="mailto:a@exemplo.invalid">email</a>')).toMatch(/mailto:/);
    expect(sanitizeHtml('<a href="tel:+244900000000">telefone</a>')).toMatch(/tel:/);
  });

  it('devolve string vazia para valores que não são texto', () => {
    expect(sanitizeHtml(null)).toBe('');
    expect(sanitizeHtml(undefined)).toBe('');
    expect(sanitizeHtml(123)).toBe('');
    expect(sanitizeHtml('')).toBe('');
  });
});

describe('escapeFilterValue', () => {
  it('escapa barras e aspas, que fechariam o filtro', () => {
    expect(escapeFilterValue('a"b')).toBe('a\\"b');
    expect(escapeFilterValue('a\\b')).toBe('a\\\\b');
    expect(escapeFilterValue('x" || role="admin')).toBe('x\\" || role=\\"admin');
  });

  it('trata null e undefined como vazio', () => {
    expect(escapeFilterValue(null)).toBe('');
    expect(escapeFilterValue(undefined)).toBe('');
  });
});
