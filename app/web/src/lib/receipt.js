import { buildWhatsAppUrl } from '@/lib/whatsapp';
import { fetchMessagingStatus, sendReceiptViaWhatsAppApi, isWhatsAppApiActive } from '@/lib/messaging';

const SITE_NAME = 'Livraria Adventista';

function fmtMoney(value) {
  const n = Number(value) || 0;
  return `Kz ${n.toLocaleString('pt-AO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(iso) {
  if (!iso) return new Date().toLocaleString('pt-AO');
  return new Date(iso).toLocaleString('pt-AO');
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getSignerName(order) {
  return (order.signerName || order.customerName || '—').trim();
}

function getSignatureDate(order) {
  return fmtDate(order.signatureSignedAt || order.createdAt);
}

function buildSignatureTextBlock(order) {
  if (!order.checkoutSignature && !order.signerName && !order.customerName) return '';
  return [
    '',
    '── Assinatura ──',
    `Assinante: ${getSignerName(order)}`,
    `Data: ${getSignatureDate(order)}`,
    order.checkoutSignature ? 'Assinatura anexada ao recibo (P&B).' : '',
  ].filter(Boolean).join('\n');
}

function buildSignatureHtmlBlock(order) {
  if (!order.checkoutSignature && !getSignerName(order)) return '';
  const name = escapeHtml(getSignerName(order));
  const date = escapeHtml(getSignatureDate(order));
  const img = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(order.checkoutSignature || '')
    ? `<img src="${order.checkoutSignature}" alt="Assinatura" class="signature-img"/>`
    : '<div class="signature-placeholder">Assinatura registada</div>';

  return `
  <div class="signature-block">
    <p class="signature-label">Assinatura do comprador</p>
    ${img}
    <p class="signature-name">${name}</p>
    <p class="signature-date">${date}</p>
  </div>`;
}

export function buildReceiptText(order) {
  const lines = [
    `🧾 *RECIBO — ${SITE_NAME}*`,
    '',
    `Nº: ${order.orderNumber || order.orderId || '—'}`,
    `Data: ${fmtDate(order.createdAt)}`,
    `Tipo: ${order.orderType === 'whatsapp' ? 'Encomenda WhatsApp' : 'Compra Online'}`,
    '',
    `Cliente: ${order.customerName || '—'}`,
    `Email: ${order.email || '—'}`,
    `Telefone: ${order.phone || '—'}`,
  ];

  if (order.deliveryRelativeName) {
    lines.push(`Contacto próximo: ${order.deliveryRelativeName}${order.deliveryRelativePhone ? ` (${order.deliveryRelativePhone})` : ''}`);
  }

  if (order.shippingMethod === 'pickup') {
    lines.push(`Entrega: Levantamento — ${order.pickupStore || 'Loja'}`);
  } else {
    lines.push(`Morada: ${order.address || '—'}${order.city ? `, ${order.city}` : ''}`);
    lines.push(`Envio: ${order.shippingLabel || 'Entrega ao domicílio'}`);
  }

  lines.push('', '*Itens:*');
  (order.items || []).forEach((item) => {
    const price = Number(item.price) || 0;
    const qty = Number(item.quantity) || 1;
    lines.push(`• ${qty}× ${item.title} — ${fmtMoney(price * qty)}`);
  });

  lines.push('');
  if (order.subtotal != null) lines.push(`Subtotal: ${fmtMoney(order.subtotal)}`);
  if (order.shippingCost != null) lines.push(`Envio: ${order.shippingCost > 0 ? fmtMoney(order.shippingCost) : 'Grátis'}`);
  lines.push(`*Total: ${fmtMoney(order.total)}*`);
  if (order.paymentMethod) lines.push(`Pagamento: ${order.paymentMethod}`);
  if (order.paymentReference) lines.push(`Referência: ${order.paymentReference}`);
  if (order.paymentLink) lines.push(`Link de pagamento: ${order.paymentLink}`);

  lines.push(buildSignatureTextBlock(order));
  lines.push('', 'Obrigado pela sua compra!');
  return lines.join('\n');
}

/**
 * Recibo em HTML (para guardar, imprimir ou "Guardar como PDF").
 * brand: { name, logo, phone, email, address } da loja (opcional). Todo o texto é escapado.
 */
export function buildReceiptHtml(order, brand = {}) {
  const e = escapeHtml;
  const siteName = brand.name || SITE_NAME;
  const itemsHtml = (order.items || []).map((item) => {
    const price = Number(item.price) || 0;
    const qty = Number(item.quantity) || 1;
    const list = Number(item.list_price) || 0;
    const old = list > price ? `<span class="old">${fmtMoney(list * qty)}</span>` : '';
    const code = item.book_code ? ` <span class="code">${e(item.book_code)}</span>` : '';
    return `<tr><td>${qty}× ${e(item.title)}${code}</td><td class="num">${old}${fmtMoney(price * qty)}</td></tr>`;
  }).join('');
  const paymentStatus = {
    paid: 'Pago', awaiting_confirmation: 'A aguardar confirmação', pending: 'Pendente', failed: 'Falhou',
  }[order.paymentStatus] || '';
  const contact = [brand.phone, brand.email, brand.address].filter(Boolean).map(e).join(' · ');
  const logo = /^(https:\/\/|data:image\/)/.test(brand.logo || '') ? `<img src="${e(brand.logo)}" alt="" class="logo"/>` : '';
  const delivery = order.shippingMethod === 'pickup'
    ? `<strong>Levantamento:</strong> ${e(order.pickupStore || 'Loja física')}`
    : `<strong>Entrega:</strong> ${e(order.address || '—')}${order.city ? `, ${e(order.city)}` : ''}`;

  return `<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Recibo ${e(order.orderNumber || '')}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 640px; margin: 32px auto; padding: 24px; color: #1a1a1a; }
    header { display: flex; align-items: center; gap: 14px; border-bottom: 3px solid #0ea5c9; padding-bottom: 14px; margin-bottom: 18px; }
    .logo { height: 52px; width: auto; }
    h1 { color: #0ea5c9; font-size: 1.4rem; margin: 0; }
    .contact { color: #666; font-size: 0.8rem; margin: 2px 0 0; }
    .meta { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 8px; color: #444; font-size: 0.9rem; margin-bottom: 16px; }
    .meta strong { color: #1a1a1a; }
    table { width: 100%; border-collapse: collapse; margin: 16px 0; }
    td { padding: 8px 0; border-bottom: 1px solid #eee; vertical-align: top; }
    td.num { text-align: right; white-space: nowrap; }
    .old { display: block; font-size: 0.75rem; color: #999; text-decoration: line-through; }
    .code { font-family: ui-monospace, monospace; font-size: 0.75rem; color: #888; }
    .totals p { margin: 4px 0; text-align: right; }
    .total { font-size: 1.25rem; font-weight: bold; color: #0ea5c9; }
    .payment { margin-top: 16px; padding: 12px; border-radius: 8px; background: #f5fbfd; border: 1px solid #d6eef5; font-size: 0.9rem; }
    .payment a { color: #0ea5c9; font-weight: 600; }
    .footer { margin-top: 32px; font-size: 0.8rem; color: #888; text-align: center; }
    .print { display: inline-block; margin-top: 20px; padding: 10px 18px; border: 0; border-radius: 8px; background: #0ea5c9; color: #fff; font-size: 0.95rem; cursor: pointer; }
    .signature-block { margin-top: 36px; padding-top: 20px; border-top: 2px solid #e5e7eb; text-align: center; }
    .signature-label { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.06em; color: #888; margin-bottom: 16px; }
    .signature-img { max-width: 280px; max-height: 120px; display: block; margin: 0 auto 12px; border: 1px solid #ccc; border-radius: 4px; background: #fff; padding: 8px; image-rendering: crisp-edges; filter: contrast(1.1); }
    .signature-placeholder { font-size: 0.85rem; color: #666; margin-bottom: 12px; }
    .signature-name { font-weight: 600; font-size: 1rem; margin: 8px 0 4px; }
    .signature-date { font-size: 0.9rem; color: #666; margin: 0; }
    @media print { .print { display: none; } body { margin: 0; } }
  </style>
</head>
<body>
  <header>
    ${logo}
    <div>
      <h1>${e(siteName)}</h1>
      ${contact ? `<p class="contact">${contact}</p>` : ''}
    </div>
  </header>
  <div class="meta">
    <span>Recibo <strong>${e(order.orderNumber || '—')}</strong></span>
    <span>${e(fmtDate(order.createdAt))}</span>
  </div>
  <p><strong>Cliente:</strong> ${e(order.customerName || '—')}<br/>
  <strong>Email:</strong> ${e(order.email || '—')}<br/>
  <strong>Telefone:</strong> ${e(order.phone || '—')}</p>
  ${order.deliveryRelativeName ? `<p><strong>Contacto próximo:</strong> ${e(order.deliveryRelativeName)}${order.deliveryRelativePhone ? ` · ${e(order.deliveryRelativePhone)}` : ''}</p>` : ''}
  <p>${delivery}</p>
  <table>${itemsHtml}</table>
  <div class="totals">
    ${order.subtotal != null ? `<p>Subtotal: ${fmtMoney(order.subtotal)}</p>` : ''}
    ${order.shippingCost != null ? `<p>Envio: ${order.shippingCost > 0 ? fmtMoney(order.shippingCost) : 'Grátis'}</p>` : ''}
    <p class="total">Total: ${fmtMoney(order.total)}</p>
  </div>
  ${order.paymentMethod || order.paymentReference || paymentStatus ? `<div class="payment">
    ${order.paymentMethod ? `<div><strong>Pagamento:</strong> ${e(order.paymentMethod)}${paymentStatus ? ` — ${e(paymentStatus)}` : ''}</div>` : ''}
    ${order.paymentReference ? `<div><strong>Referência:</strong> ${e(order.paymentReference)}</div>` : ''}
    ${/^https:\/\//.test(order.paymentLink || '') && order.paymentStatus !== 'paid' ? `<div><a href="${e(order.paymentLink)}">Pagar pelo link</a></div>` : ''}
  </div>` : ''}
  ${buildSignatureHtmlBlock(order)}
  <p class="footer">Documento gerado automaticamente. Guarde para referência.<br/>
    <button class="print" onclick="window.print()">Imprimir / guardar como PDF</button>
  </p>
</body>
</html>`;
}

export function downloadReceipt(order, brand = {}) {
  const html = buildReceiptHtml(order, brand);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `recibo-${order.orderNumber || order.orderId || 'compra'}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Dados da loja para o cabeçalho do recibo, a partir das configurações públicas. */
export function receiptBrand(settings = {}) {
  return {
    name: settings.site_name || SITE_NAME,
    logo: settings.logo_url || '',
    phone: settings.contact_phone || '',
    email: settings.contact_email || '',
    address: settings.contact_address || '',
  };
}

/** Converte uma encomenda da base de dados no formato do recibo (para emitir no painel). */
export function receiptFromOrder(o) {
  const items = Array.isArray(o.items) ? o.items : [];
  const subtotal = items.reduce((sum, it) => sum + (Number(it.price) || 0) * (Number(it.quantity) || 1), 0);
  return {
    orderId: o.id,
    orderNumber: o.order_number || o.id,
    createdAt: o.created,
    customerName: o.customer_name,
    signerName: o.customer_name,
    email: o.customer_email,
    phone: o.phone,
    address: o.delivery_address_full || o.address,
    city: o.delivery_address_full ? '' : o.city,
    deliveryRelativeName: o.delivery_relative_name || '',
    deliveryRelativePhone: o.delivery_relative_phone || '',
    shippingMethod: o.shipping_method,
    pickupStore: o.pickup_store,
    items,
    subtotal,
    shippingCost: Number(o.shipping_cost) || 0,
    total: Number(o.total) || 0,
    paymentMethod: o.payment_method_name || o.payment_method_code || o.payment_method || '',
    paymentReference: o.payment_reference || '',
    paymentStatus: o.payment_status || '',
    checkoutSignature: o.checkout_signature_data || '',
    signatureSignedAt: o.checkout_signature_at || o.created,
  };
}

export async function sendReceiptViaWhatsApp(order, phone) {
  const text = buildReceiptText(order);
  const targetPhone = order.phone || phone;
  try {
    const status = await fetchMessagingStatus();
    if (isWhatsAppApiActive(status) && targetPhone) {
      const result = await sendReceiptViaWhatsAppApi({
        phone: targetPhone,
        text,
        orderNumber: order.orderNumber || order.orderId,
        email: order.email,
      });
      if (result.sent) return { mode: 'api' };
    }
  } catch {
    /* fallback manual */
  }
  const url = targetPhone
    ? buildWhatsAppUrl(targetPhone, text)
    : `https://wa.me/?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
  return { mode: 'manual' };
}

export const LAST_ORDER_KEY = 'livraria_last_order';

export function saveLastOrder(order) {
  try {
    sessionStorage.setItem(LAST_ORDER_KEY, JSON.stringify(order));
  } catch { /* ignore */ }
}

export function loadLastOrder() {
  try {
    const raw = sessionStorage.getItem(LAST_ORDER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
