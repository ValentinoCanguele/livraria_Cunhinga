import pb from '@/lib/dataClient';
import { isMissingRoute } from '@/lib/apiCompat';
import { resolveShopBgMode } from '@/lib/shopTheme';
import { APP_API_URL, supabase } from '@/lib/supabaseClient';

const DEFAULT_SETTINGS = {
  site_name: 'Livraria Adventista',
  tagline: 'Literatura que edifica e transforma',
  primary_color: '#0ea5c9',
  logo_url: '',
  favicon_url: '',
  contact_email: 'contacto@livrariaadventista.ao',
  contact_phone: '+244 923 000 000',
  contact_address: 'Luanda, Angola',
  pwa_enabled: true,
  pwa_theme_color: '#0c4a6e',
  shipping_free_threshold: 20000,
  shipping_cost: 1500,
  shipping_express_cost: 3000,
  shop_hero_title: 'Todos os Livros',
  shop_hero_subtitle: 'O catálogo completo da livraria — pesquisa avançada, pré-visualização e compra segura.',
  shop_hero_badge: 'Catálogo Premium',
  shop_default_sort: 'featured',
  shop_per_page: 24,
  shop_show_featured: true,
  shop_show_collections: true,
  shop_show_low_stock: true,
  shop_grid_columns: 4,
  maintenance_mode: false,
  google_oauth_enabled: false,
  header_welcome_logged: 'Bem-vindo de volta, {nome}',
  header_welcome_guest: 'Envio em todo o país · Crie a sua conta para acompanhar encomendas',
  header_cta_text: 'Explorar novidades',
  header_cta_link: '/shop',
  footer_tagline: '',
  footer_copyright: '',
  footer_columns: null,
  show_stores_in_footer: true,
  ui_glass_enabled: true,
  ui_glass_opacity: 0.72,
  shop_bg_mode: 'image',
  shop_bg_image_url: '/images/site/loja-banner.webp',
  shop_bg_video_url: '',
  shop_bg_overlay: 0.55,
  google_maps_embed_key: '',
  assets_version: '',
};

export async function getSiteSettings() {
  try {
    const res = await fetch(`${APP_API_URL}/settings`);
    if (!res.ok) return DEFAULT_SETTINGS;
    const merged = { ...DEFAULT_SETTINGS, ...await res.json() };
    merged.shop_bg_mode = resolveShopBgMode(merged);
    return merged;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

/** Lojas activas (a RLS só mostra lojas activas ao público). */
export async function getPhysicalStores() {
  try {
    const records = await pb.collection('physical_stores').getFullList({ filter: 'active = true', sort: 'sort_order,name' });
    return records.map((r) => ({
      id: r.id,
      name: r.name,
      province: r.province,
      address: r.address,
      phone: r.phone || '',
      email: r.email || '',
      whatsapp: r.whatsapp || '',
      hours: r.hours || '',
      image_url: r.image_url || (r.image ? pb.files.getURL(r, r.image) : ''),
      latitude: r.latitude,
      longitude: r.longitude,
      maps_url: r.maps_url || '',
      pickup_enabled: r.pickup_enabled !== false,
    }));
  } catch {
    return [];
  }
}

export async function getCollections() {
  try {
    const res = await fetch(`${APP_API_URL}/book-collections`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.collections || [];
  } catch {
    return [];
  }
}

export async function getPaymentMethods() {
  try {
    const res = await fetch(`${APP_API_URL}/payment-methods`);
    if (!res.ok) return { methods: [] };
    const data = await res.json();
    const methods = data.methods || [];
    // O link de pagamento lê-se também directamente da base de dados (os métodos activos são
    // de leitura pública), para funcionar mesmo com uma Edge Function publicada mais antiga.
    if (methods.length && methods.some((m) => m.payment_link === undefined)) {
      const { data: links } = await supabase.from('payment_methods').select('code, payment_link').eq('enabled', true);
      const byCode = Object.fromEntries((links || []).map((l) => [l.code, l.payment_link || '']));
      methods.forEach((m) => { if (m.payment_link === undefined) m.payment_link = byCode[m.code] || ''; });
    }
    return { ...data, methods };
  } catch {
    return { methods: [] };
  }
}

export async function trackOrder(orderNumber, email) {
  const res = await fetch(`${APP_API_URL}/track`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderNumber, email }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Encomenda não encontrada');
  return data;
}

export async function getGeoProvinces() {
  const res = await fetch(`${APP_API_URL}/geo/provinces`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.provinces || [];
}

export async function getGeoMunicipalities(provinceId) {
  if (!provinceId) return [];
  const res = await fetch(`${APP_API_URL}/geo/municipalities?province=${encodeURIComponent(provinceId)}`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.municipalities || [];
}

export async function getGeoLocalities(municipalityId) {
  if (!municipalityId) return [];
  const res = await fetch(`${APP_API_URL}/geo/localities?municipality=${encodeURIComponent(municipalityId)}`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.localities || [];
}

export async function confirmDelivery({ orderNumber, email, recipientName, recipientId, signature }) {
  const res = await fetch(`${APP_API_URL}/confirm-delivery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      orderNumber,
      email,
      recipientName,
      recipientId,
      signature,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Não foi possível confirmar a entrega');
  return data;
}

export async function addDeliveryEvent(orderId, event, token) {
  const res = await fetch(`${APP_API_URL}/delivery-event`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: token,
    },
    body: JSON.stringify({ orderId, ...event }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Erro');
  return data;
}

/**
 * Muda o estado do pagamento de uma encomenda.
 *
 * Passa pela API e não pela tabela porque é aí que o aviso ao cliente é enviado: a gravação
 * directa em `orders` mudava o estado sem que ninguém soubesse que o pagamento foi aceite.
 *
 * Enquanto a Edge Function publicada não tiver esta rota, grava na tabela como antes e
 * devolve `via: 'fallback'`, para o painel poder dizer que o estado mudou mas o cliente não
 * foi avisado. Sem isto, o site novo com a função antiga deixava de conseguir sequer
 * confirmar um pagamento — uma funcionalidade a menos em vez de um aviso a mais.
 */
export async function setOrderPaymentStatus(orderId, status) {
  try {
    const res = await pb.send('/admin/orders/payment-status', {
      method: 'POST',
      body: { orderId, status },
    });
    return { ...res, via: 'api' };
  } catch (err) {
    if (!isMissingRoute(err)) throw err;
    await pb.collection('orders').update(orderId, { payment_status: status });
    return { payment_status: status, email_sent: false, via: 'fallback' };
  }
}

export function getSettingsFileUrl(record, field) {
  if (!record?.[field]) return null;
  return pb.files.getURL(record, record[field]);
}
