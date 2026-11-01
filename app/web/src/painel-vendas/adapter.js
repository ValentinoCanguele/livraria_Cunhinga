/**
 * Adaptador do Painel de Vendas (pacote painel-vendas-huambo) para o Supabase.
 * createPainelApi() devolve a interface que a página do pacote pedia a window.claude.use('db' | 'user' | 'downloads'):
 *   anos/{ano}                → public.vendas_anos
 *   historico/registo, notas/ → public.painel_vendas_docs
 *   config/admin              → não usado: a edição exige sessão de administrador da livraria (RLS no servidor)
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

const db = {
  collection(name) {
    return {
      onSnapshot(next, onError) {
        if (name !== 'anos') { next({ docs: [], metadata: { fromCache: false } }); return () => {}; }
        return listen('anos', async () => {
          const { data, error } = await supabase.from('vendas_anos').select('*').order('ano');
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
        const { data } = await supabase.from('vendas_anos').select('*').eq('ano', Number(id)).maybeSingle();
        return snap(id, data ? yearRowToDoc(data) : null);
      }
      if (col === 'config') return snap(id, null);
      const { data } = await supabase.from('painel_vendas_docs').select('data').eq('path', path).maybeSingle();
      return snap(id, data?.data || null);
    };
    return {
      get: read,
      onSnapshot(next, onError) {
        return listen(path, () => read().then(next).catch((e) => onError?.(e)));
      },
      async set(value) {
        if (col === 'config') rejectWrite();
        let error;
        if (col === 'anos') {
          ({ error } = await supabase.from('vendas_anos').upsert({
            ano: Number(value.ano ?? id),
            meses: value.meses,
            observacoes: value.observacoes,
            mes_em_curso: value.mes_em_curso ?? null,
            meta_anual: value.meta_anual ?? null,
            criterio: value.criterio || 'media',
            fonte: value.fonte || '',
            actualizado: value.actualizado || new Date().toISOString(),
          }));
        } else {
          ({ error } = await supabase.from('painel_vendas_docs').upsert({ path, data: value, actualizado: new Date().toISOString() }));
        }
        if (error) rejectWrite(error);
        fire(path);
        fire(col);
      },
      async delete() {
        if (col !== 'anos') rejectWrite();
        const { error } = await supabase.from('vendas_anos').delete().eq('ano', Number(id));
        if (error) rejectWrite(error);
        fire(path);
        fire(col);
      },
    };
  },
};

const downloads = {
  async save({ filename, data }) {
    const url = URL.createObjectURL(new Blob([data], { type: 'text/csv;charset=utf-8' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: filename });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return { status: 'saved' };
  },
};

/** Interface do painel para a sessão actual; `profile` = { id, role } do utilizador com sessão (useAuth). */
export function createPainelApi(profile) {
  const isAdmin = profile?.role === 'admin';
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
  return { db, user, downloads };
}
