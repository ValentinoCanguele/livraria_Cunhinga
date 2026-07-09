export function buildWhatsAppUrl(phone, message) {
  const digits = (phone || '').replace(/\D/g, '');
  const num = digits.startsWith('244') ? digits : `244${digits.replace(/^0/, '')}`;
  return `https://wa.me/${num}?text=${encodeURIComponent(message)}`;
}

export function buildBookShareMessage(product, siteUrl = typeof window !== 'undefined' ? window.location.origin : '') {
  const price = product.variants?.[0]?.price_formatted || '';
  return [
    `📚 *${product.title}*`,
    product.subtitle ? `por ${product.subtitle}` : '',
    product.marketing_hook || '',
    price ? `💰 ${price}` : '',
    '',
    'Ver na Livraria Adventista:',
    `${siteUrl}/product/${product.id}`,
  ].filter(Boolean).join('\n');
}

export function buildWhatsAppOrderMessage({ cartItems, form, totalFormatted, orderNumber }) {
  const lines = [
    '🛒 *Novo Pedido — Livraria Adventista*',
    orderNumber ? `Nº: ${orderNumber}` : '',
    '',
    `👤 ${form.name}`,
    `📧 ${form.email}`,
    `📱 ${form.phone}`,
    `📍 ${form.address}${form.city ? `, ${form.city}` : ''}`,
    '',
    '*Livros:*',
  ];
  cartItems.forEach((item) => {
    const price = item.variant.sale_price_formatted || item.variant.price_formatted;
    lines.push(`• ${item.quantity}× ${item.product.title} — ${price}`);
  });
  lines.push('', `*Total: ${totalFormatted}*`);
  if (form.paymentMethod) lines.push(`Pagamento: ${form.paymentMethod}`);
  if (form.notes) lines.push(`Notas: ${form.notes}`);
  return lines.filter((l) => l !== '').join('\n');
}

export function shareBookOnWhatsApp(product, whatsappPhone) {
  const msg = buildBookShareMessage(product);
  window.open(buildWhatsAppUrl(whatsappPhone, msg), '_blank', 'noopener,noreferrer');
}

export function openWhatsAppOrder(whatsappPhone, payload) {
  window.open(buildWhatsAppUrl(whatsappPhone, buildWhatsAppOrderMessage(payload)), '_blank', 'noopener,noreferrer');
}
