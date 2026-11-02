/**
 * Categorias estratégicas para vitrine — um livro pode aparecer em várias faixas.
 */
export const SHOWCASE_CATEGORIES = [
  {
    id: 'catalogo',
    title: 'Catálogo Geral',
    description: 'O acervo completo da livraria',
    accent: '#0ea5c9',
    minBooks: 1,
    filter: (p) => (p.type?.value || '') === 'Catálogo Geral',
  },
  {
    id: 'colportagem',
    title: 'Colportagem',
    description: 'Títulos para evangelização e saúde',
    accent: '#8b5cf6',
    minBooks: 1,
    filter: (p) => (p.type?.value || '') === 'Colportagem',
  },
  {
    id: 'ellen',
    title: 'Ellen G. White',
    description: 'Obras da autora adventista e biografia',
    accent: '#f59e0b',
    minBooks: 2,
    filter: (p) => /ellen\s*g?\.?\s*white/i.test(`${p.author || ''} ${p.title || ''} ${p.subtitle || ''}`),
  },
  {
    id: 'apocalipse',
    title: 'Apocalipse & Profecia',
    description: 'Daniel, Apocalipse e escatologia',
    accent: '#6366f1',
    minBooks: 3,
    filter: (p) => /apocalipse|profec|daniel|revela|milenar|escatolog|sinais dos tempos/i.test(`${p.title || ''} ${p.subtitle || ''}`),
  },
  {
    id: 'familia',
    title: 'Família & Relacionamentos',
    description: 'Namoro, casamento e educação',
    accent: '#ec4899',
    minBooks: 3,
    filter: (p) => /família|familia|namoro|casamento|relacionamento|sexualidade|lua de mel|criança|crianca|filho|pais|mãe|mae/i.test(`${p.title || ''} ${p.subtitle || ''}`),
  },
  {
    id: 'saude',
    title: 'Saúde & Bem-estar',
    description: 'Corpo, mente e estilo de vida',
    accent: '#10b981',
    minBooks: 3,
    filter: (p) => /saúde|saude|depressão|depressao|vegetarian|alimentação|alimentacao|menopausa|esperança|cura|medicina|estilo de vida|viver melhor/i.test(`${p.title || ''} ${p.subtitle || ''}`),
  },
  {
    id: 'pregacao',
    title: 'Pregação & Liderança',
    description: 'Sermões, liderança e missão',
    accent: '#0c4a6e',
    minBooks: 3,
    filter: (p) => /pregação|pregacao|sermão|sermao|liderança|lideranca|líder|lider|igreja em missão|evangelismo/i.test(`${p.title || ''} ${p.subtitle || ''}`),
  },
  {
    id: 'fe',
    title: 'Fé & Doutrina',
    description: 'Fundamentos e apologética',
    accent: '#14b8a6',
    minBooks: 3,
    filter: (p) => /fé|fe|doutrina|crenças|crencas|justificação|justificacao|sábado|sabado|adventismo|adventista|bíblia|biblia|hermenêutica|hermeneutica|deus|cristo|oração|oracao/i.test(`${p.title || ''} ${p.subtitle || ''}`),
  },
  {
    id: 'stock',
    title: 'Disponíveis Agora',
    description: 'Prontos para envio imediato',
    accent: '#22c55e',
    minBooks: 3,
    filter: (p) => p.purchasable && (p.variants?.[0]?.inventory_quantity ?? 0) > 0,
  },
  {
    id: 'destaques',
    title: 'Destaques',
    description: 'Seleccionados pela equipa',
    accent: '#eab308',
    minBooks: 1,
    filter: (p) => !!p.featured,
  },
];

/** Parâmetros da loja (/shop?...) que mostram cada categoria. */
export const CATEGORY_SHOP_FILTERS = {
  ellen: 'search=Ellen',
  apocalipse: 'search=Apocalipse',
  familia: 'search=Família',
  saude: 'search=Saúde',
  pregacao: 'search=Pregação',
  fe: 'search=Fé',
  stock: 'inStockOnly=true',
  destaques: 'featuredOnly=true',
};

export function buildShowcaseCategories(products) {
  return SHOWCASE_CATEGORIES
    .map((cat) => {
      const books = products
        .filter(cat.filter)
        .sort((a, b) => (a.title || '').localeCompare(b.title || '', 'pt'));
      return { ...cat, books };
    })
    .filter((cat) => cat.books.length >= cat.minBooks);
}

/** Cópias do track para loop infinito sem salto visível */
export const MARQUEE_LOOP_COPIES = 4;

/**
 * Títulos distintos que entram na faixa.
 *
 * A faixa anda devagar e volta ao início ao fim de uma cópia: ninguém chega a ver mais do
 * que uma dúzia de livros diferentes. Dar-lhe a lista toda era construir 360 cartões (90
 * títulos × 4 cópias), com 2520 elementos e 360 imagens — 63% do DOM da página, a competir
 * pela rede no arranque e a custar centenas de milissegundos a desmontar quando alguém
 * aplica um filtro.
 *
 * Os restantes títulos não se perdem: a grelha do mesmo componente mostra-os em "Ver mais".
 */
export const MARQUEE_MAX_ITEMS = 16;

export function buildMarqueeTrack(products, copies = MARQUEE_LOOP_COPIES, maxItems = MARQUEE_MAX_ITEMS) {
  if (!products.length) return [];
  const visiveis = maxItems > 0 ? products.slice(0, maxItems) : products;
  const track = [];
  for (let c = 0; c < copies; c++) {
    for (const product of visiveis) {
      track.push({ product, copy: c });
    }
  }
  return track;
}
