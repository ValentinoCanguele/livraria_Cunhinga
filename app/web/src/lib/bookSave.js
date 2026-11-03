import { sanitizeImageUrlForSave } from '@/lib/imageUrl';
import { fromLocalInput } from '@/lib/pricing';

/** Prepara payload de livro para a API compatível — evita blob: e URLs inválidas. */
export function sanitizeBookPayload(data) {
  const out = { ...data };

  out.cover = sanitizeImageUrlForSave(out.cover);
  out.author_photo = sanitizeImageUrlForSave(out.author_photo);

  if (out.collection_id === '_none' || out.collection_id === '') {
    out.collection_id = '';
  }

  if (Array.isArray(out.benefit_bullets)) {
    out.benefit_bullets = out.benefit_bullets.filter(Boolean);
  } else {
    out.benefit_bullets = [];
  }

  if (Array.isArray(out.sample_pages)) {
    out.sample_pages = out.sample_pages
      .map((p) => (typeof p === 'string' ? sanitizeImageUrlForSave(p) : sanitizeImageUrlForSave(p?.url || '')))
      .filter(Boolean);
  } else {
    out.sample_pages = [];
  }

  if (Array.isArray(out.versions)) {
    out.versions = out.versions.map((v) => ({
      ...v,
      price: v.price === '' || v.price == null ? null : Number(v.price),
      stock: v.stock === '' || v.stock == null ? null : Number(v.stock),
    }));
  } else {
    out.versions = [];
  }

  out.price = Number(out.price) || 0;
  out.stock = Number(out.stock) || 0;
  out.pages = Number(out.pages) || 0;
  out.year = Number(out.year) || new Date().getFullYear();
  out.featured = !!out.featured;
  out.active = out.active !== false;
  // Promoção: sem preço promocional, as datas não servem para nada.
  out.sale_price = out.sale_price === '' || out.sale_price == null ? null : Number(out.sale_price);
  if (!(out.sale_price > 0)) out.sale_price = null;
  out.sale_starts_at = out.sale_price ? fromLocalInput(out.sale_starts_at) : null;
  out.sale_ends_at = out.sale_price ? fromLocalInput(out.sale_ends_at) : null;
  out.preview_enabled = !!out.preview_enabled;

  if (!out.description) out.description = '';
  if (!out.author_bio) out.author_bio = '';

  return out;
}
