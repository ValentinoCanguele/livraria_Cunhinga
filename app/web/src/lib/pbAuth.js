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
