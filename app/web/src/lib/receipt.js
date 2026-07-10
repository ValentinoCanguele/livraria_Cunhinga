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
  const img = order.checkoutSignature
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

  lines.push(buildSignatureTextBlock(order));
  lines.push('', 'Obrigado pela sua compra!');
  return lines.join('\n');
}

export function buildReceiptHtml(order) {
  const itemsHtml = (order.items || []).map((item) => {
    const price = Number(item.price) || 0;
    const qty = Number(item.quantity) || 1;
    return `<tr><td>${qty}× ${item.title}</td><td style="text-align:right">${fmtMoney(price * qty)}</td></tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="utf-8"/>
  <title>Recibo ${order.orderNumber || ''}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 600px; margin: 40px auto; padding: 24px; color: #1a1a1a; }
    h1 { color: #0ea5c9; font-size: 1.5rem; margin-bottom: 4px; }
    .meta { color: #666; font-size: 0.9rem; margin-bottom: 24px; }
    table { width: 100%; border-collapse: collapse; margin: 16px 0; }
    td { padding: 8px 0; border-bottom: 1px solid #eee; }
    .total { font-size: 1.25rem; font-weight: bold; color: #0ea5c9; margin-top: 16px; }
    .footer { margin-top: 32px; font-size: 0.85rem; color: #888; }
    .signature-block { margin-top: 40px; padding-top: 24px; border-top: 2px solid #e5e7eb; text-align: center; }
    .signature-label { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.06em; color: #888; margin-bottom: 16px; }
    .signature-img { max-width: 280px; max-height: 120px; display: block; margin: 0 auto 12px; border: 1px solid #ccc; border-radius: 4px; background: #fff; padding: 8px; image-rendering: crisp-edges; filter: contrast(1.1); }
    .signature-placeholder { font-size: 0.85rem; color: #666; margin-bottom: 12px; }
    .signature-name { font-weight: 600; font-size: 1rem; margin: 8px 0 4px; }
    .signature-date { font-size: 0.9rem; color: #666; margin: 0; }
  </style>
</head>
<body>
  <h1>${SITE_NAME}</h1>
  <p class="meta">Recibo · ${order.orderNumber || '—'} · ${fmtDate(order.createdAt)}</p>
  <p><strong>Cliente:</strong> ${order.customerName || '—'}<br/>
  <strong>Email:</strong> ${order.email || '—'}<br/>
  <strong>Telefone:</strong> ${order.phone || '—'}</p>
  ${order.deliveryRelativeName ? `<p><strong>Contacto próximo:</strong> ${escapeHtml(order.deliveryRelativeName)}${order.deliveryRelativePhone ? ` · ${escapeHtml(order.deliveryRelativePhone)}` : ''}</p>` : ''}
  <p><strong>${order.shippingMethod === 'pickup' ? 'Levantamento' : 'Entrega'}:</strong> ${
    order.shippingMethod === 'pickup'
      ? (order.pickupStore || 'Loja física')
      : `${order.address || '—'}${order.city ? `, ${order.city}` : ''}`
  }</p>
  <table>${itemsHtml}</table>
  ${order.subtotal != null ? `<p>Subtotal: ${fmtMoney(order.subtotal)}</p>` : ''}
  ${order.shippingCost != null ? `<p>Envio: ${order.shippingCost > 0 ? fmtMoney(order.shippingCost) : 'Grátis'}</p>` : ''}
  <p class="total">Total: ${fmtMoney(order.total)}</p>
  ${order.paymentMethod ? `<p>Pagamento: ${escapeHtml(order.paymentMethod)}</p>` : ''}
  ${buildSignatureHtmlBlock(order)}
  <p class="footer">Documento gerado automaticamente. Guarde para referência.</p>
</body>
</html>`;
}

export function downloadReceipt(order) {
  const html = buildReceiptHtml(order);
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
