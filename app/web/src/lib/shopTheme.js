export function hexToRgb(hex) {
  const h = (hex || '#0ea5c9').replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function applyShopTheme(settings = {}) {
  const primary = settings.primary_color || '#0ea5c9';
  const dark = settings.pwa_theme_color || '#0c4a6e';
  const { r, g, b } = hexToRgb(primary);
  const root = document.documentElement;
  root.style.setProperty('--brand-primary', primary);
  root.style.setProperty('--brand-primary-rgb', `${r}, ${g}, ${b}`);
  root.style.setProperty('--brand-dark', dark);

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
