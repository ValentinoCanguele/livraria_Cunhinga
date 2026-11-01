/**
 * Gestão de utilizadores e clientes pelo painel.
 * - Listar, ver encomendas, editar, suspender e apagar: funções da base de dados (RPC users_admin_*),
 *   que verificam as permissões lá dentro. Funcionam mesmo com uma Edge Function antiga.
 * - Criar contas e gerar links de acesso: Edge Function "app" (precisam da API de administração do Auth).
 * Enquanto a migração das RPC não estiver aplicada, as chamadas caem para a Edge Function.
 */
import pb from '@/lib/dataClient';
import { APP_API_URL, supabase } from '@/lib/supabaseClient';

const EDGE_OUTDATED = 'A Edge Function publicada ainda não tem esta funcionalidade. Publique-a com: npx supabase functions deploy app --project-ref bggqkjjqbjhbjsckzopj --no-verify-jwt';

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
  if (res.status === 404 && /rota não encontrada/i.test(data.message || '')) throw new Error(EDGE_OUTDATED);
  if (!res.ok) throw new Error(data.message || 'Operação falhou.');
  return data;
}

/** Função da base de dados ainda não existe (migração por aplicar)? */
const rpcMissing = (error) => error && (error.code === 'PGRST202' || /could not find the function/i.test(error.message || ''));

/** Chama a RPC; se ainda não existir, usa a alternativa (Edge Function). */
async function rpcOr(fn, args, fallback) {
  const { data, error } = await supabase.rpc(fn, args);
  if (rpcMissing(error)) return fallback();
  if (error) throw new Error(error.message || 'Operação falhou.');
  return data;
}

const origin = () => window.location.origin;

/** Lista paginada. scope: team | customers | all; status: all | active | suspended | guest | unconfirmed | buyers */
export async function listUsers({ scope = 'all', q = '', status = 'all', page = 1, perPage = 25 } = {}) {
  const data = await rpcOr(
    'users_admin_list',
    { p_scope: scope, p_search: q, p_status: status, p_limit: perPage, p_offset: (page - 1) * perPage },
    () => call('GET', '/admin/users', { query: { scope, q, status, page, per_page: perPage } }),
  );
  return { ...data, page, per_page: perPage };
}

/** Todas as linhas do filtro actual (em páginas de 100), para exportar. */
export async function listAllUsers({ scope = 'all', q = '', status = 'all' } = {}) {
  const items = [];
  for (let page = 1; page <= 50; page += 1) {
    const res = await listUsers({ scope, q, status, page, perPage: 100 });
    items.push(...(res.items || []));
    if (items.length >= (res.total || 0) || !(res.items || []).length) break;
  }
  return items;
}

export async function listUserOrders(email) {
  const data = await rpcOr('users_admin_orders', { p_email: email }, () => call('GET', '/admin/users/orders', { query: { email } }));
  return Array.isArray(data) ? { items: data } : data;
}

/** Sem palavra-passe, é gerado um link para a pessoa a definir (enviado por email se o email da loja estiver configurado). */
export const createUser = (data) => call('POST', '/admin/users/create', { body: { ...data, origin: origin() } });

/** Mudar o email precisa da Edge Function; o resto vai pela base de dados. */
export async function updateUser(id, data) {
  if (data.email !== undefined) return call('POST', '/admin/users/update', { body: { id, ...data } });
  return rpcOr(
    'users_admin_update',
    {
      p_id: id,
      p_name: data.name ?? null,
      p_phone: data.phone ?? null,
      p_role: data.role ?? null,
      p_permissions: data.permissions ?? null,
    },
    () => call('POST', '/admin/users/update', { body: { id, ...data } }),
  );
}

export const setUserSuspended = (id, suspended) =>
  rpcOr('users_admin_set_suspended', { p_id: id, p_suspended: suspended }, () => call('POST', '/admin/users/status', { body: { id, suspended } }));

/**
 * Link para definir a palavra-passe. Pela Edge Function (devolve o link para partilhar);
 * se a publicada ainda não tiver a rota, pede ao Supabase Auth que envie o email de recuperação.
 */
export async function sendAccessLink(id, email) {
  try {
    return await call('POST', '/admin/users/access-link', { body: { id, origin: origin() } });
  } catch (err) {
    if (err.message !== EDGE_OUTDATED || !email) throw err;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${origin()}/reset-password` });
    if (error) throw new Error(error.message);
    return { link: '', emailSent: true, viaAuth: true };
  }
}

export const deleteUser = (id) =>
  rpcOr('users_admin_delete', { p_id: id }, () => call('POST', '/admin/users/delete', { body: { id } }));
