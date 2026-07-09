const PREFIX = '244';

/** Apenas dígitos. */
export function digitsOnly(value) {
  return String(value || '').replace(/\D/g, '');
}

/** Extrai os 9 dígitos locais (sem +244 / 0 inicial). */
export function localDigits(value) {
  let d = digitsOnly(value);
  if (d.startsWith(PREFIX)) d = d.slice(3);
  if (d.startsWith('0')) d = d.slice(1);
  return d.slice(0, 9);
}

/** Formata enquanto o utilizador escreve: +244 9XX XXX XXX */
export function formatAngolaPhone(value) {
  const d = localDigits(value);
  if (!d) return '+244 ';
  if (d.length <= 3) return `+244 ${d}`;
  if (d.length <= 6) return `+244 ${d.slice(0, 3)} ${d.slice(3)}`;
  return `+244 ${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
}

/** Normaliza para guardar na BD. */
export function normalizeAngolaPhone(value) {
  const d = localDigits(value);
  if (d.length < 9) return formatAngolaPhone(value).trim();
  return `+244 ${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6, 9)}`;
}

/** Valida número móvel angolano (9 dígitos, começa por 9). */
export function isValidAngolaPhone(value) {
  const d = localDigits(value);
  return d.length === 9 && /^9\d{8}$/.test(d);
}

/** Exibe formatado ou o valor original se inválido/incompleto. */
export function displayAngolaPhone(value) {
  if (!value) return '—';
  const d = localDigits(value);
  if (d.length === 9) return normalizeAngolaPhone(value);
  return String(value).trim() || '—';
}
