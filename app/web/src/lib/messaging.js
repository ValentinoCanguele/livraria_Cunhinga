const PB_URL = import.meta.env.VITE_POCKETBASE_URL || 'http://127.0.0.1:8090';

let statusCache = null;
let statusCacheAt = 0;

export async function fetchMessagingStatus(force = false) {
  const now = Date.now();
  if (!force && statusCache && now - statusCacheAt < 60000) return statusCache;
  try {
    const res = await fetch(`${PB_URL}/api/app/messaging/status`);
    statusCache = res.ok ? await res.json() : null;
    statusCacheAt = now;
    return statusCache;
  } catch {
    return null;
  }
}

export function isWhatsAppApiActive(statusOrIntegrations) {
  if (statusOrIntegrations?.whatsapp) {
    const w = statusOrIntegrations.whatsapp;
    return !!(w.enabled && w.configured && w.auto_send !== false);
  }
  const wa = statusOrIntegrations?.whatsapp_business;
  return !!(wa?.enabled && wa?.config?.configured && wa?.config?.auto_send !== false);
}

export async function sendReceiptViaWhatsAppApi({ phone, text, orderNumber, email }) {
  const res = await fetch(`${PB_URL}/api/app/whatsapp/receipt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      phone,
      text,
      order_number: orderNumber || '',
      email: email || '',
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Erro ao enviar recibo');
  return data;
}

export async function testWhatsAppApi(phone, token) {
  const res = await fetch(`${PB_URL}/api/app/admin/whatsapp/test`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ phone }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Teste falhou');
  return data;
}
