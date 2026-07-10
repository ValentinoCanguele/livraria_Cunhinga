const PB_URL = import.meta.env.VITE_POCKETBASE_URL || 'http://127.0.0.1:8090';

export function normalizeLoginEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export function parsePbAuthError(err) {
  const raw = err?.response?.data || err?.data || {};
  const message = raw.message || err?.message || '';
  const lower = String(message).toLowerCase();

  if (lower.includes('failed to fetch') || lower.includes('network') || err?.status === 0) {
    return 'Servidor indisponível. Verifique se o PocketBase está a correr (porta 8090).';
  }
  if (lower.includes('invalid login') || lower.includes('invalid credentials') || err?.status === 400) {
    return 'Email ou palavra-passe incorrectos.';
  }
  if (lower.includes('verified') && lower.includes('not')) {
    return 'Confirme o seu email antes de entrar.';
  }
  if (message) return message;
  return 'Não foi possível autenticar. Tente novamente.';
}

export async function checkPocketBaseHealth() {
  try {
    const res = await fetch(`${PB_URL}/api/health`, { method: 'GET', signal: AbortSignal.timeout(4000) });
    return res.ok;
  } catch {
    return false;
  }
}
