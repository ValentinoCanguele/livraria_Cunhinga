import { APP_API_URL } from '@/lib/supabaseClient';

export function normalizeLoginEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export function parsePbAuthError(err) {
  const raw = err?.response?.data || err?.data || {};
  const message = raw.message || err?.message || '';
  const lower = String(message).toLowerCase();

  if (lower.includes('failed to fetch') || lower.includes('network') || err?.status === 0) {
    return 'Servidor indisponível. Verifique a ligação à internet.';
  }
  if (message) return message;
  if (err?.status === 400) return 'Email ou palavra-passe incorrectos.';
  return 'Não foi possível autenticar. Tente novamente.';
}

/** Verifica se a API (Supabase Edge Function) responde. */
export async function checkPocketBaseHealth() {
  try {
    const res = await fetch(`${APP_API_URL}/health`, { method: 'GET', signal: AbortSignal.timeout(6000) });
    return res.ok;
  } catch {
    return false;
  }
}
