/**
 * Adaptador do Painel de Vendas (pacote painel-vendas-huambo) para o Supabase.
 * createPainelApi() devolve a interface que a página do pacote pedia a window.claude.use('db' | 'user' | 'downloads'):
 *   anos/{ano}                → public.vendas_anos (da loja escolhida)
 *   historico/registo, notas/ → public.painel_vendas_docs (<id da loja>/<caminho>)
 *   config/admin              → não usado: a edição exige sessão de administrador da livraria (RLS no servidor)
 * Antes da migração painel_vendas_por_loja não há loja_id: o painel mostra os dados que existem (Loja do Huambo).
 */
import { supabase } from '@/lib/supabaseClient';

const subs = {};
const fire = (key) => (subs[key] || []).forEach((fn) => fn());
const listen = (key, fn) => {
  (subs[key] ||= []).push(fn);
  fn();
  return () => { subs[key] = subs[key].filter((f) => f !== fn); };
};

const snap = (id, data) => ({ id: String(id), exists: !!data, data: () => data, metadata: {} });

function yearRowToDoc(row) {
  return {
    ano: row.ano,
    meses: row.meses,
    observacoes: row.observacoes,
    mes_em_curso: row.mes_em_curso,
    meta_anual: row.meta_anual == null ? null : Number(row.meta_anual),
    criterio: row.criterio,
    fonte: row.fonte || '',
    actualizado: row.actualizado,
  };
}

function rejectWrite(error) {
  const err = new Error(error?.message || 'Sem permissão para gravar.');
  err.code = 'invalid_argument';
  throw err;
}

/** true quando vendas_anos já tem loja_id (migração painel_vendas_por_loja aplicada). */
export async function detectMultiStore() {
  const { error } = await supabase.from('vendas_anos').select('loja_id').limit(1);
  return !error;
}

/** Lojas físicas (a equipa vê também as inactivas). */
export async function listStores() {
  const { data } = await supabase.from('physical_stores').select('id, name, province, active').order('sort_order').order('name');
  return data || [];
}

const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
const cents = (v) => Math.round((Number(v) || 0) * 100);
// Luanda está em UTC+1 todo o ano: o mês de uma encomenda conta pela hora local.
const LUANDA_OFFSET_MS = 3600 * 1000;

/**
 * Vendas registadas no sistema (encomendas) de uma loja, por mês, em Kz sem portes.
 * Conta para a loja: levantamentos nessa loja e entregas ao domicílio na província da loja.
 * Exclui encomendas canceladas; com paidOnly, só as que têm o pagamento confirmado.
 */
async function fetchSystemSales(store, ano, { paidOnly = true } = {}) {
  const from = new Date(Date.UTC(ano, 0, 1) - LUANDA_OFFSET_MS).toISOString();
  const to = new Date(Date.UTC(ano + 1, 0, 1) - LUANDA_OFFSET_MS).toISOString();
  const rows = [];
  for (let page = 0; ; page++) {
    const { data, error } = await supabase.from('orders')
      .select('created, total, shipping_cost, status, delivery_status, payment_status, shipping_method, pickup_store, delivery_province')
      .gte('created', from).lt('created', to)
      .order('created')
      .range(page * 1000, page * 1000 + 999);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  const months = Array(12).fill(0);
  const counts = Array(12).fill(0);
  for (const o of rows) {
    if (o.status === 'cancelled' || o.delivery_status === 'cancelled') continue;
    if (paidOnly && o.payment_status !== 'paid') continue;
    const pickup = o.shipping_method === 'pickup' || !!o.pickup_store;
    const mine = pickup ? norm(o.pickup_store) === norm(store.name) : norm(o.delivery_province) === norm(store.province);
    if (!mine) continue;
    const m = new Date(new Date(o.created).getTime() + LUANDA_OFFSET_MS).getUTCMonth();
    months[m] += Math.max(0, cents(o.total) - cents(o.shipping_cost));
    counts[m] += 1;
  }
  return { months: months.map((c) => c / 100), counts, orders: rows.length };
}

function makeDb(lojaId) {
  const multi = !!lojaId;
  const key = (k) => `${lojaId || '-'}:${k}`;
  const docPath = (path) => (multi ? `${lojaId}/${path}` : path);
  const anos = () => {
    let q = supabase.from('vendas_anos').select('*');
    if (multi) q = q.eq('loja_id', lojaId);
    return q;
  };
  return {
    collection(name) {
      return {
        onSnapshot(next, onError) {
          if (name !== 'anos') { next({ docs: [], metadata: { fromCache: false } }); return () => {}; }
          return listen(key('anos'), async () => {
            const { data, error } = await anos().order('ano');
            if (error) { onError?.(error); return; }
            next({ docs: (data || []).map((r) => snap(r.ano, yearRowToDoc(r))), metadata: { fromCache: false } });
          });
        },
      };
    },
    doc(path) {
      const [col, id] = path.split('/');
      const read = async () => {
        if (col === 'anos') {
          const { data } = await anos().eq('ano', Number(id)).maybeSingle();
          return snap(id, data ? yearRowToDoc(data) : null);
        }
        if (col === 'config') return snap(id, null);
        const { data } = await supabase.from('painel_vendas_docs').select('data').eq('path', docPath(path)).maybeSingle();
        return snap(id, data?.data || null);
      };
      return {
        get: read,
        onSnapshot(next, onError) {
          return listen(key(path), () => read().then(next).catch((e) => onError?.(e)));
        },
        async set(value) {
          if (col === 'config') rejectWrite();
          let error;
          if (col === 'anos') {
            const row = {
              ano: Number(value.ano ?? id),
              meses: value.meses,
              observacoes: value.observacoes,
              mes_em_curso: value.mes_em_curso ?? null,
              meta_anual: value.meta_anual ?? null,
              criterio: value.criterio || 'media',
              fonte: value.fonte || '',
              actualizado: value.actualizado || new Date().toISOString(),
            };
            if (multi) row.loja_id = lojaId;
            ({ error } = await supabase.from('vendas_anos').upsert(row, { onConflict: multi ? 'loja_id,ano' : 'ano' }));
          } else {
            ({ error } = await supabase.from('painel_vendas_docs').upsert({ path: docPath(path), data: value, actualizado: new Date().toISOString() }));
          }
          if (error) rejectWrite(error);
          fire(key(path));
          fire(key(col));
        },
        async delete() {
          if (col !== 'anos') rejectWrite();
          let q = supabase.from('vendas_anos').delete().eq('ano', Number(id));
          if (multi) q = q.eq('loja_id', lojaId);
          const { error } = await q;
          if (error) rejectWrite(error);
          fire(key(path));
          fire(key(col));
        },
      };
    },
  };
}

const TYPES = {
  csv: 'text/csv;charset=utf-8',
  json: 'application/json',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  png: 'image/png',
  webm: 'video/webm',
  mp4: 'video/mp4',
};

const downloads = {
  async save({ filename, data }) {
    const ext = filename.split('.').pop();
    const blob = data instanceof Blob ? data : new Blob([data], { type: TYPES[ext] || 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: filename });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    return { status: 'saved' };
  },
};

/**
 * Interface do painel para a sessão actual.
 * profile = { id, role } do utilizador com sessão (useAuth);
 * opts = { lojaId (só com a migração aplicada), store: { id, name, province } | null, canReadOrders }.
 */
export function createPainelApi(profile, opts = {}) {
  const isAdmin = profile?.role === 'admin';
  const { lojaId = null, store = null, canReadOrders = false } = opts;
  const user = {
    id: async () => profile?.id || null,
    isOwner: async () => false,
    canEdit: async () => isAdmin,
    can: async () => isAdmin,
    async profiles(ids) {
      const { data } = await supabase.from('profiles').select('id, name, email').in('id', ids);
      return Object.fromEntries((data || []).map((p) => [p.id, { name: p.name || p.email }]));
    },
  };
  const sales = store && canReadOrders
    ? { available: true, storeName: store.name, fetch: (ano, o) => fetchSystemSales(store, ano, o) }
    : { available: false, reason: !store ? 'Esta loja ainda não existe no separador Lojas.' : 'Precisa da permissão de encomendas para ver as vendas do sistema.' };
  return { db: makeDb(lojaId), user, downloads, store, sales };
}
