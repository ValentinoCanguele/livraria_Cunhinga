import { supabase, mediaUrl } from '@/lib/supabaseClient';

/**
 * Envia uma imagem para o bucket "media" em <pasta>/uploads/ e devolve o URL público.
 * Usado pelos campos de imagem que guardam só um URL (sem coluna de ficheiro no registo).
 * A pasta decide a permissão exigida pelo Storage (ex.: stock_books → manage_catalog).
 */
export async function uploadPublicImage(folder, file) {
  const ext = (file?.name?.split('.').pop() || '').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
  const name = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}.${ext}`;
  const { error } = await supabase.storage.from('media').upload(`${folder}/uploads/${name}`, file, {
    contentType: file.type || undefined,
    upsert: false,
  });
  if (error) {
    const denied = /row-level security|unauthorized|403/i.test(error.message || '');
    throw new Error(denied ? 'Sem permissão para enviar imagens nesta área.' : error.message || 'Falha ao enviar a imagem.');
  }
  return mediaUrl(folder, 'uploads', name);
}

/** true enquanto algum campo ainda tem a pré-visualização local (envio em curso). */
export const isUploadPending = (...values) => values.flat().some((v) => typeof v === 'string' && v.startsWith('blob:'));
