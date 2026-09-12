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

export function buildMarqueeTrack(products, copies = MARQUEE_LOOP_COPIES) {
  if (!products.length) return [];
  const track = [];
  for (let c = 0; c < copies; c++) {
    for (const product of products) {
      track.push({ product, copy: c });
    }
  }
  return track;
}
