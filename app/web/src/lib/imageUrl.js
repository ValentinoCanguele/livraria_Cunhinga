/**
 * Normaliza URLs de imagem — inclui links partilhados do Google Drive.
 */
export function extractDriveFileId(url) {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  const patterns = [
    /\/file\/d\/([a-zA-Z0-9_-]+)/,
    /[?&]id=([a-zA-Z0-9_-]+)/,
    /\/d\/([a-zA-Z0-9_-]+)/,
  ];
  for (const re of patterns) {
    const m = trimmed.match(re);
    if (m?.[1]) return m[1];
  }
  return null;
}

export function normalizeImageUrl(url) {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('blob:')) return trimmed;

  const driveId = extractDriveFileId(trimmed);
  if (driveId) {
    return `https://drive.google.com/uc?export=view&id=${driveId}`;
  }

  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith('//')) return `https:${trimmed}`;
  return trimmed;
}

export function isPersistableImageUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const n = normalizeImageUrl(url);
  return /^https?:\/\//i.test(n) && !n.startsWith('blob:');
}

/** URL pronta para guardar na base de dados (sem blob:). */
export function sanitizeImageUrlForSave(url) {
  if (!url || typeof url !== 'string') return '';
  if (url.startsWith('blob:')) return '';
  const normalized = normalizeImageUrl(url);
  return isPersistableImageUrl(normalized) ? normalized : '';
}

export function withCacheBust(url, version) {
  if (!url || !version) return url || '';
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}v=${encodeURIComponent(version)}`;
}
