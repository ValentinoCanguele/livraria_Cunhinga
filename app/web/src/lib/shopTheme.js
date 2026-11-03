export function hexToRgb(hex) {
  const h = (hex || '#1b365d').replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function hexToHsl(hex) {
  let hStr = (hex || '#1b365d').replace('#', '');
  if (hStr.length === 3) {
    hStr = hStr.split('').map((c) => c + c).join('');
  }
  let r = parseInt(hStr.substring(0, 2), 16) / 255;
  let g = parseInt(hStr.substring(2, 4), 16) / 255;
  let b = parseInt(hStr.substring(4, 6), 16) / 255;

  let max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;

  if (max === min) {
    h = s = 0;
  } else {
    let d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }

  h = Math.round(h * 360);
  s = Math.round(s * 100);
  l = Math.round(l * 100);

  return `${h} ${s}% ${l}%`;
}

/** Luminância relativa, como a WCAG a define. */
export function relativeLuminance({ r, g, b }) {
  const canal = (v) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
}

/** Razão de contraste entre duas cores. 1 é igual, 21 é preto sobre branco. */
export function contrastRatio(a, b) {
  const l1 = relativeLuminance(a);
  const l2 = relativeLuminance(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

const BRANCO = { r: 255, g: 255, b: 255 };

const toHex = ({ r, g, b }) =>
  `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;

/**
 * Alvo de contraste, com folga sobre os 4,5 da WCAG.
 *
 * Os 4,5 são o mínimo contra branco puro, mas nem todos os fundos da loja o são: a faixa de
 * livros assenta sobre um cinzento muito claro, e aí a mesma cor media 4,41 — falhava por
 * nove centésimas. A folga cobre esses fundos levemente tingidos sem escurecer a cor ao
 * ponto de ela deixar de parecer a cor da marca.
 */
const CONTRASTE_ALVO = 4.8;

/**
 * A mesma cor, escurecida só o suficiente para se ler sobre branco.
 *
 * A cor da marca desta loja (`#0ea5c9`) dá uma razão de 2,9 sobre branco — abaixo dos 4,5
 * que a WCAG pede para texto normal. Era a cor dos **preços**, que numa loja é o que mais
 * precisa de se ler, e do texto branco dentro dos botões e etiquetas que a usam como fundo.
 *
 * Escurece-se proporcionalmente, mantendo o tom: o azul continua o mesmo azul, só mais
 * fundo. Calcular em vez de fixar um valor faz com que isto continue certo se alguém mudar
 * a cor da marca no painel — que é precisamente o que o painel permite fazer.
 *
 * Devolve a cor original quando ela já passa.
 */
export function ensureContrastOnWhite(hex, minimo = CONTRASTE_ALVO) {
  const original = hexToRgb(hex);
  if (contrastRatio(original, BRANCO) >= minimo) return toHex(original);
  for (let p = 98; p >= 20; p -= 2) {
    const tentativa = {
      r: original.r * (p / 100),
      g: original.g * (p / 100),
      b: original.b * (p / 100),
    };
    if (contrastRatio(tentativa, BRANCO) >= minimo) return toHex(tentativa);
  }
  // Uma cor que nem a 20% chega é quase preta; aí o preto resolve e lê-se sempre.
  return '#000000';
}

export function applyShopTheme(settings = {}) {
  const primary = settings.primary_color || '#1b365d';
  const dark = settings.pwa_theme_color || '#0c4a6e';
  const { r, g, b } = hexToRgb(primary);
  const root = document.documentElement;
  root.style.setProperty('--brand-primary', primary);
  root.style.setProperty('--brand-primary-rgb', `${r}, ${g}, ${b}`);
  // A cor viva da marca fica para decoração: barras, bordas, fundos de áreas grandes.
  root.style.setProperty('--brand-primary-hsl', hexToHsl(primary));
  root.style.setProperty('--brand-accent-hsl', hexToHsl(settings.accent_color || primary));
  root.style.setProperty('--brand-dark', dark);

  // `--brand-ink` é a variante legível, e é o `index.css` que decide onde ela entra: no tema
  // claro vai para `--primary`, no escuro fica a cor viva. Escrito aqui por `style`, ganhava
  // a qualquer regra do tema escuro e deixava texto escuro sobre fundo escuro no dia em que
  // alguém o activasse.
  const ink = ensureContrastOnWhite(primary);
  root.style.setProperty('--brand-ink', ink);
  root.style.setProperty('--brand-ink-hsl', hexToHsl(ink));

  const glassOn = settings.ui_glass_enabled !== false;
  const opacity = Number(settings.ui_glass_opacity) || 0.72;
  root.style.setProperty('--glass-enabled', glassOn ? '1' : '0');
  root.style.setProperty('--glass-opacity', String(Math.min(0.95, Math.max(0.5, opacity))));
  root.style.setProperty('--glass-blur', glassOn ? '20px' : '0px');

  // Tema claro por defeito — evita ecrã em branco sem variáveis CSS
  root.classList.remove('dark');
  root.style.colorScheme = 'light';
}

/** Garante modo de fundo válido; volta a gradiente se media em falta. */
export function resolveShopBgMode(settings = {}) {
  const mode = settings.shop_bg_mode || 'gradient';
  if (mode === 'image' && !settings.shop_bg_image_url) return 'gradient';
  if (mode === 'video' && !settings.shop_bg_video_url) return 'gradient';
  if (!['gradient', 'image', 'video', 'slides'].includes(mode)) return 'gradient';
  return mode;
}

export const shopDefaults = {
  shop_hero_title: 'Todos os Livros',
  shop_hero_subtitle: 'O catálogo completo da livraria — pesquisa avançada, pré-visualização e compra segura.',
  shop_hero_badge: 'Catálogo Premium',
  shop_default_sort: 'featured',
  shop_per_page: 24,
  shop_show_featured: true,
  shop_show_collections: true,
  shop_show_low_stock: true,
  shop_grid_columns: 4,
};
