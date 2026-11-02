import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
export const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  console.error('Defina VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY em app/web/.env');
}

// Guardado antes de o supabase-js consumir o link de recuperação de palavra-passe.
export const IS_PASSWORD_RECOVERY_REDIRECT =
  typeof window !== 'undefined' && /type=recovery/.test(window.location.hash || '');

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

/** Base da API própria (Edge Function "app"), equivalente ao antigo /api/app do PocketBase. */
export const APP_API_URL = `${SUPABASE_URL}/functions/v1/app`;

/** URL pública de um ficheiro guardado no bucket "media" (<tabela>/<id>/<ficheiro>). */
export function mediaUrl(table, recordId, filename) {
  if (!filename) return '';
  return `${SUPABASE_URL}/storage/v1/object/public/media/${table}/${recordId}/${encodeURIComponent(filename)}`;
}
