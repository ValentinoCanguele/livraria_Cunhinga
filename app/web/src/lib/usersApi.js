/**
 * Gestão de utilizadores e clientes pelo painel.
 * Tudo passa pela Edge Function "app" (rotas /admin/users/*), que tem a service role
 * e aplica as regras de permissão. O browser nunca altera contas directamente.
 */
import pb from '@/lib/dataClient';
import { APP_API_URL } from '@/lib/supabaseClient';

async function call(method, path, { query, body } = {}) {
  const url = new URL(`${APP_API_URL}${path}`);
  Object.entries(query || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
  });
  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${pb.authStore.token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || 'Operação falhou.');
  return data;
}

const origin = () => window.location.origin;

/** Lista paginada. scope: team | customers | all; status: all | active | suspended | guest | unconfirmed | buyers */
export const listUsers = ({ scope = 'all', q = '', status = 'all', page = 1, perPage = 25 } = {}) =>
  call('GET', '/admin/users', { query: { scope, q, status, page, per_page: perPage } });

export const listUserOrders = (email) => call('GET', '/admin/users/orders', { query: { email } });

/** Sem palavra-passe, é gerado um link para a pessoa a definir (enviado por email se o email da loja estiver configurado). */
export const createUser = (data) => call('POST', '/admin/users/create', { body: { ...data, origin: origin() } });

export const updateUser = (id, data) => call('POST', '/admin/users/update', { body: { id, ...data } });

export const setUserSuspended = (id, suspended) => call('POST', '/admin/users/status', { body: { id, suspended } });

export const sendAccessLink = (id) => call('POST', '/admin/users/access-link', { body: { id, origin: origin() } });

export const deleteUser = (id) => call('POST', '/admin/users/delete', { body: { id } });
