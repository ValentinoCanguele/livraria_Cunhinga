import pb from '@/lib/dataClient';

export const BOOK_GENRES = [
  'Catálogo Geral',
  'Ellen G. White',
  'Apocalipse & Profecia',
  'Família & Relacionamentos',
  'Saúde & Estilo de Vida',
  'Fé & Doutrina',
  'Pregação & Liderança',
  'Colportagem',
];

export const BOOK_LANGUAGES = ['Português', 'Inglês', 'Francês', 'Espanhol'];

export const emptyBookForm = {
  title: '',
  author: '',
  genre: 'Catálogo Geral',
  price: '',
  stock: '',
  cover: '',
  description: '',
  featured: false,
  isbn: '',
  book_code: '',
  sku: '',
  publisher: 'Livraria Adventista',
  language: 'Português',
  pages: '',
  year: new Date().getFullYear(),
  collection_id: '',
  marketing_hook: '',
  urgency_text: '',
  social_proof: '',
  benefit_bullets: [],
  seo_keywords: '',
  target_audience: '',
  preview_enabled: false,
  author_bio: '',
  author_photo: '',
  sample_pages: [],
  versions: [],
  compras: 0,
  lido: 0,
  baixados: 0,
  vendidos: 0,
};

export function previewBookCode() {
  const seq = Date.now().toString(36).toUpperCase().slice(-5);
  return `LA-${seq}`;
}

export function bookToForm(record) {
  const cover = record.cover || (record.cover_image ? pb.files.getURL(record, record.cover_image) : '');
  return {
    title: record.title || '',
    author: record.author || '',
    genre: record.genre || 'Catálogo Geral',
    price: record.price ?? '',
    stock: record.stock ?? '',
    cover,
    description: record.description || '',
    featured: !!record.featured,
    isbn: record.isbn || '',
    book_code: record.book_code || '',
    sku: record.sku || '',
    publisher: record.publisher || 'Livraria Adventista',
    language: record.language || 'Português',
    pages: record.pages ?? '',
    year: record.year ?? new Date().getFullYear(),
    collection_id: record.collection_id || '',
    marketing_hook: record.marketing_hook || '',
    urgency_text: record.urgency_text || '',
    social_proof: record.social_proof || '',
    benefit_bullets: record.benefit_bullets || [],
    seo_keywords: record.seo_keywords || '',
    target_audience: record.target_audience || '',
    preview_enabled: !!record.preview_enabled,
    author_bio: record.author_bio || '',
    author_photo: record.author_photo || '',
    sample_pages: record.sample_pages || [],
    versions: record.versions || [],
    compras: record.compras ?? 0,
    lido: record.lido ?? 0,
    baixados: record.baixados ?? 0,
    vendidos: record.vendidos ?? 0,
  };
}
