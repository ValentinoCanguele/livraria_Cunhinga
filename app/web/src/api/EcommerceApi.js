import pb from '@/lib/pocketbaseClient';

const CURRENCY = { code: 'AOA', symbol: 'Kz' };
const PB_URL = import.meta.env.VITE_POCKETBASE_URL || 'http://127.0.0.1:8090';

function resolveBookCover(book) {
  if (book.cover) return book.cover;
  if (book.cover_image) {
    try {
      return pb.files.getURL(book, book.cover_image);
    } catch {
      return `${PB_URL}/api/files/stock_books/${book.id}/${book.cover_image}`;
    }
  }
  return '';
}

export function formatCurrency(amountInCents, currencyInfo = CURRENCY) {
  const amount = amountInCents / 100;
  const symbol = currencyInfo?.symbol || 'Kz';
  return `${symbol} ${amount.toLocaleString('pt-AO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function bookToProduct(book, collectionsMap = {}) {
  const priceInCents = Math.round((Number(book.price) || 0) * 100);
  const stock = Number(book.stock) || 0;
  const variantId = `${book.id}-default`;
  const collectionId = book.collection_id || '';
  const cover = resolveBookCover(book);

  const variant = {
    id: variantId,
    title: 'Standard',
    price_in_cents: priceInCents,
    sale_price_in_cents: null,
    price_formatted: formatCurrency(priceInCents),
    sale_price_formatted: null,
    currency_info: CURRENCY,
    inventory_quantity: stock,
    manage_inventory: true,
    image_url: cover || null,
  };

  return {
    id: book.id,
    title: book.title,
    subtitle: book.author || '',
    description: book.description || '',
    image: cover || '',
    images: cover ? [{ url: cover }] : [],
    price_in_cents: priceInCents,
    type: { value: book.genre || 'Geral' },
    purchasable: stock > 0,
    ribbon_text: book.urgency_text || (book.featured ? 'Destaque' : stock <= 5 && stock > 0 ? 'Últimas unidades' : null),
    variants: [variant],
    options: [],
    collections: collectionId && collectionsMap[collectionId]
      ? [{ collection_id: collectionId, title: collectionsMap[collectionId] }]
      : [],
    collection_id: collectionId || null,
    collection_title: collectionsMap[collectionId] || null,
    order: book.year ? Number(book.year) * 1000 : 0,
    featured: !!book.featured,
    book_code: book.book_code || null,
    sku: book.sku || book.book_code || null,
    isbn: book.isbn || null,
    publisher: book.publisher || null,
    language: book.language || null,
    pages: book.pages || null,
    year: book.year || null,
    marketing_hook: book.marketing_hook || null,
    social_proof: book.social_proof || null,
    urgency_text: book.urgency_text || null,
    benefit_bullets: book.benefit_bullets || [],
    target_audience: book.target_audience || null,
    seo_keywords: book.seo_keywords || null,
    author_bio: book.author_bio || null,
    author_photo: book.author_photo || null,
    sample_pages: book.sample_pages || [],
    versions: book.versions || [],
    preview_enabled: !!book.preview_enabled,
    compras: Number(book.compras) || 0,
    lido: Number(book.lido) || 0,
    baixados: Number(book.baixados) || 0,
    vendidos: Number(book.vendidos) || 0,
    stock_low: !!book.stock_low || (stock > 0 && stock < 5),
    stock_alert: !!book.stock_alert,
  };
}

const BOOK_SORT = '-featured,title';

let collectionsCache = null;
let collectionsCacheAt = 0;

async function getCollectionsMap() {
  if (collectionsCache && Date.now() - collectionsCacheAt < 60000) return collectionsCache;
  try {
    const records = await pb.collection('book_collections').getFullList({ sort: 'sort_order' });
    collectionsCache = Object.fromEntries(records.map((c) => [c.id, c.title || c.name || '']));
    collectionsCacheAt = Date.now();
    return collectionsCache;
  } catch {
    return {};
  }
}

async function fetchBooks(options = {}) {
  const collectionsMap = await getCollectionsMap();
  const filter = options.featured ? 'featured = true' : '';
  const limit = Number(options.limit);

  let items;
  if (limit > 0) {
    const records = await pb.collection('stock_books').getList(1, limit, {
      sort: BOOK_SORT,
      filter: filter || undefined,
    });
    items = records.items;
  } else {
    items = await pb.collection('stock_books').getFullList({
      sort: BOOK_SORT,
      filter: filter || undefined,
    });
  }

  return { items, collectionsMap, total: items.length };
}

function mapSlideRecord(s) {
  return {
    id: s.id,
    title: s.title,
    subtitle: s.subtitle || '',
    image: s.image,
    cta_text: s.cta_text || 'Explorar',
    cta_link: s.cta_link || '/shop',
    template: s.template || 'classic',
    book_id: s.book_id || '',
    body_html: s.body_html || '',
    promo_badge: s.promo_badge || '',
    promo_price: s.promo_price ?? null,
    book_cover: s.book_cover || '',
    book_title: s.book_title || '',
    book_author: s.book_author || '',
    placement: s.placement || 'home',
    is_primary: !!s.is_primary,
    transition: s.transition || 'fade',
    media_type: s.media_type || 'image',
    video_url: s.video_url || '',
    duration_ms: s.duration_ms ?? null,
    sort_order: s.sort_order ?? 0,
  };
}

function sortSlidesList(slides) {
  return [...slides].sort((a, b) => {
    const ap = a.is_primary ? 1 : 0;
    const bp = b.is_primary ? 1 : 0;
    if (bp !== ap) return bp - ap;
    return (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0);
  });
}

export async function getHeroSlides(placement = 'home') {
  try {
    const records = await pb.collection('hero_slides').getFullList({
      filter: 'active = true',
      sort: 'sort_order',
    });
    const filtered = records
      .map(mapSlideRecord)
      .filter((s) => s.placement === placement || s.placement === 'both' || (!s.placement && placement === 'home'));
    return sortSlidesList(filtered);
  } catch {
    return [];
  }
}

export async function getShopSlides() {
  return getHeroSlides('shop');
}

export async function getProducts(options = {}) {
  const { items, collectionsMap } = await fetchBooks(options);
  return { products: items.map((b) => bookToProduct(b, collectionsMap)), total: items.length };
}

export async function getFeaturedProducts(limit = 8) {
  try {
    const { items, collectionsMap } = await fetchBooks({ limit, featured: true });
    if (items.length > 0) return { products: items.map((b) => bookToProduct(b, collectionsMap)) };
  } catch {
    // fallback
  }
  const { items, collectionsMap } = await fetchBooks({ limit });
  return { products: items.slice(0, limit).map((b) => bookToProduct(b, collectionsMap)) };
}

export async function getProduct(id) {
  const book = await pb.collection('stock_books').getOne(id);
  const collectionsMap = await getCollectionsMap();
  const product = bookToProduct(book, collectionsMap);
  // Variantes adicionais definidas no admin
  const extraVersions = Array.isArray(book.versions) ? book.versions : [];
  if (extraVersions.length > 0) {
    product.variants = extraVersions.map((v, i) => {
      const priceInCents = Math.round((Number(v.price ?? book.price) || 0) * 100);
      return {
        id: `${book.id}-v${i}`,
        title: v.label || v.title || `Edição ${i + 1}`,
        price_in_cents: priceInCents,
        sale_price_in_cents: v.sale_price ? Math.round(Number(v.sale_price) * 100) : null,
        price_formatted: formatCurrency(priceInCents),
        sale_price_formatted: v.sale_price ? formatCurrency(Math.round(Number(v.sale_price) * 100)) : null,
        currency_info: CURRENCY,
        inventory_quantity: Number(v.stock ?? book.stock) || 0,
        manage_inventory: true,
        image_url: v.cover || book.cover || null,
        format: v.format || '',
        isbn: v.isbn || '',
      };
    });
  }
  return product;
}

export async function getCategories() {
  const { items } = await fetchBooks({});
  const seen = new Map();

  items.forEach((book) => {
    const genre = book.genre || 'Geral';
    if (!seen.has(genre.toLowerCase())) {
      seen.set(genre.toLowerCase(), {
        id: genre.toLowerCase().replace(/\s+/g, '-'),
        title: genre,
      });
    }
  });

  return { categories: Array.from(seen.values()) };
}

export async function getBookCollections() {
  try {
    const records = await pb.collection('book_collections').getFullList({ sort: 'sort_order' });
    return records.map((c) => ({
      id: c.id,
      title: c.title || c.name || '',
      slug: c.slug || '',
      description: c.description || '',
      cover: c.cover || '',
    }));
  } catch {
    return [];
  }
}

export async function getProductQuantities({ product_ids = [] }) {
  const variants = [];

  for (const productId of product_ids) {
    try {
      const book = await pb.collection('stock_books').getOne(productId);
      variants.push({
        id: `${book.id}-default`,
        inventory_quantity: Number(book.stock) || 0,
      });
    } catch {
      // ignore
    }
  }

  return { variants };
}

export async function initializeCheckout({
  items, successUrl, customerEmail, customerName,
  phone, address, city, paymentMethod, paymentMethodCode, paymentReference, notes, shippingCost,
  saleChannel, shippingMethod, pickupStore,
  deliveryProvince, deliveryProvinceId, deliveryMunicipality, deliveryMunicipalityId,
  deliveryLocality, deliveryLocalityId, deliveryStreet, deliveryReference, deliveryAddressFull,
  deliveryRelativeName, deliveryRelativePhone, checkoutSignature,
}) {
  const res = await fetch(`${PB_URL}/api/app/checkout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      items, successUrl, customerEmail, customerName,
      phone, address, city,
      paymentMethod: paymentMethodCode || paymentMethod,
      paymentMethodCode: paymentMethodCode || paymentMethod,
      paymentReference,
      notes, shippingCost,
      saleChannel: saleChannel || 'web_purchase',
      shippingMethod: shippingMethod || 'delivery',
      pickupStore: pickupStore || '',
      deliveryProvince, deliveryProvinceId, deliveryMunicipality, deliveryMunicipalityId,
      deliveryLocality, deliveryLocalityId, deliveryStreet, deliveryReference, deliveryAddressFull,
      deliveryRelativeName, deliveryRelativePhone,
      checkoutSignature,
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.message || data.error || 'Erro no checkout');
  return { url: data.url, orderId: data.orderId, total: data.total, orderNumber: data.orderNumber, order_type: data.order_type, email_sent: data.email_sent, whatsapp_sent: data.whatsapp_sent };
}

export async function subscribeNewsletter(email) {
  const res = await fetch(`${PB_URL}/api/app/newsletter`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Erro na subscrição');
  return data;
}

export async function getRelatedProducts(author, excludeId, limit = 4, genre = null) {
  try {
    const collectionsMap = await getCollectionsMap();
    const items = [];
    const seenIds = new Set(excludeId ? [excludeId] : []);

    // 1. Same author first
    if (author?.trim()) {
      const cleanAuthor = author.trim().replace(/["\\]/g, '');
      const filter = excludeId ? `author ~ "${cleanAuthor}" && id != "${excludeId}"` : `author ~ "${cleanAuthor}"`;
      const byAuthor = await pb.collection('stock_books').getList(1, limit, { filter, sort: BOOK_SORT }).catch(() => ({ items: [] }));
      for (const b of byAuthor.items) {
        if (!seenIds.has(b.id)) {
          seenIds.add(b.id);
          items.push(b);
        }
      }
    }

    // 2. Same genre if we need more
    if (items.length < limit && genre?.trim()) {
      const cleanGenre = genre.trim().replace(/["\\]/g, '');
      const filter = excludeId ? `genre = "${cleanGenre}" && id != "${excludeId}"` : `genre = "${cleanGenre}"`;
      const byGenre = await pb.collection('stock_books').getList(1, limit * 2, { filter, sort: BOOK_SORT }).catch(() => ({ items: [] }));
      for (const b of byGenre.items) {
        if (items.length >= limit) break;
        if (!seenIds.has(b.id)) {
          seenIds.add(b.id);
          items.push(b);
        }
      }
    }

    // 3. Fallback to top books
    if (items.length < limit) {
      const filter = excludeId ? `id != "${excludeId}"` : undefined;
      const fallback = await pb.collection('stock_books').getList(1, limit * 2, { filter, sort: '-featured,stock' }).catch(() => ({ items: [] }));
      for (const b of fallback.items) {
        if (items.length >= limit) break;
        if (!seenIds.has(b.id)) {
          seenIds.add(b.id);
          items.push(b);
        }
      }
    }

    return { products: items.map((b) => bookToProduct(b, collectionsMap)) };
  } catch {
    return { products: [] };
  }
}

export async function getLowStockBooks() {
  try {
    const records = await pb.collection('stock_books').getFullList({
      filter: 'stock_alert = true || stock_low = true || stock <= 5',
      sort: 'stock',
    });
    return records;
  } catch {
    return [];
  }
}

export async function clearStockAlert(bookId) {
  await pb.collection('stock_books').update(bookId, { stock_alert: false, stock_low: false });
}

export async function searchProducts(query, limit = 50) {
  const q = query.trim();
  if (!q) return getProducts({ limit });

  const filter = `title ~ "${q}" || author ~ "${q}" || genre ~ "${q}" || book_code ~ "${q}" || isbn ~ "${q}"`;
  const records = await pb.collection('stock_books').getList(1, limit, { filter, sort: BOOK_SORT });
  const collectionsMap = await getCollectionsMap();
  return { products: records.items.map((b) => bookToProduct(b, collectionsMap)) };
}
