import { APP_API_URL } from '@/lib/supabaseClient';

const DEFAULT_INTEGRATIONS = {
  google_oauth: { enabled: true },
  google_maps: { enabled: true },
  google_contacts: { enabled: false },
  google_drive: { enabled: false, config: {} },
  newsletter: { enabled: true },
  pwa: { enabled: true },
  delivery_tracking: { enabled: true },
};

let cache = null;
let cacheAt = 0;

export async function fetchIntegrations() {
  if (cache && Date.now() - cacheAt < 30000) return cache;
  try {
    const res = await fetch(`${APP_API_URL}/integrations`);
    if (!res.ok) return DEFAULT_INTEGRATIONS;
    const data = await res.json();
    cache = { ...DEFAULT_INTEGRATIONS, ...data.integrations };
    cacheAt = Date.now();
    return cache;
  } catch {
    return DEFAULT_INTEGRATIONS;
  }
}

export function isIntegrationEnabled(integrations, code) {
  return integrations?.[code]?.enabled !== false;
}

export function getIntegrationConfig(integrations, code) {
  return integrations?.[code]?.config || {};
}

export function buildGoogleMapsEmbedUrl(lat, lng, apiKey) {
  if (!lat || !lng) return '';
  if (apiKey) {
    return `https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(apiKey)}&q=${lat},${lng}&zoom=15`;
  }
  return `https://maps.google.com/maps?q=${lat},${lng}&z=15&output=embed`;
}

export function buildGoogleContactsUrl(email) {
  if (!email) return 'https://contacts.google.com/';
  return `https://contacts.google.com/search/${encodeURIComponent(email)}`;
}
