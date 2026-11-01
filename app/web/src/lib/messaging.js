
import { APP_API_URL } from '@/lib/supabaseClient';

let statusCache = null;
let statusCacheAt = 0;

export async function fetchMessagingStatus(force = false) {
  const now = Date.now();
  if (!force && statusCache && now - statusCacheAt < 60000) return statusCache;
  try {
    const res = await fetch(`${APP_API_URL}/messaging/status`);
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
  const res = await fetch(`${APP_API_URL}/whatsapp/receipt`, {
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
  const res = await fetch(`${APP_API_URL}/admin/whatsapp/test`, {
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

export async function testEmailApi(to, token) {
  const res = await fetch(`${APP_API_URL}/admin/email/test`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ to }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Teste falhou');
  return data;
}
