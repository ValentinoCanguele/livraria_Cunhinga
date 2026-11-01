import React, { useEffect, useState } from 'react';
import { Loader2, ArrowDownRight, ArrowUpRight, History } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

const REASONS = {
  inicial: { label: 'Stock inicial', className: 'bg-slate-500/10 text-slate-700 dark:text-slate-300' },
  venda: { label: 'Venda', className: 'bg-sky-500/10 text-sky-700 dark:text-sky-300' },
  cancelamento: { label: 'Cancelamento', className: 'bg-amber-500/10 text-amber-700 dark:text-amber-300' },
  ajuste: { label: 'Ajuste manual', className: 'bg-purple-500/10 text-purple-700 dark:text-purple-300' },
};

const formatDateTime = (value) => {
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? '—'
    : `${d.toLocaleDateString('pt-AO')} ${d.toLocaleTimeString('pt-AO', { hour: '2-digit', minute: '2-digit' })}`;
};

/**
 * Histórico de movimentos de stock de um livro (tabela stock_movements, escrita por trigger
 * na base de dados: stock inicial, vendas, cancelamentos e ajustes manuais com o autor).
 */
export default function StockHistory({ bookId }) {
  const [rows, setRows] = useState([]);
  const [names, setNames] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!bookId) return undefined;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const { data, error: err } = await supabase
          .from('stock_movements')
          .select('id, delta, stock_before, stock_after, reason, reference, actor, created')
          .eq('book_id', bookId)
          .order('created', { ascending: false })
          .limit(50);
        if (err) throw err;
        const actors = [...new Set((data || []).map((r) => r.actor).filter(Boolean))];
        let map = {};
        if (actors.length) {
          const { data: people } = await supabase.from('profiles').select('id, name, email').in('id', actors);
          map = Object.fromEntries((people || []).map((p) => [p.id, p.name || p.email]));
        }
        if (!cancelled) { setRows(data || []); setNames(map); }
      } catch (e) {
        if (!cancelled) setError(e.message || 'Não foi possível carregar o histórico.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [bookId]);

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
        <History className="h-3.5 w-3.5" /> Histórico de stock
      </p>
      {loading ? (
        <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Ainda não há movimentos registados para este livro.</p>
      ) : (
        <ul className="divide-y rounded-lg border max-h-72 overflow-y-auto">
          {rows.map((r) => {
            const reason = REASONS[r.reason] || REASONS.ajuste;
            const up = r.delta > 0;
            return (
              <li key={r.id} className="p-2.5 flex items-center justify-between gap-3 text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  {up
                    ? <ArrowUpRight className="h-4 w-4 text-emerald-600 shrink-0" />
                    : <ArrowDownRight className="h-4 w-4 text-red-600 shrink-0" />}
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${reason.className}`}>{reason.label}</span>
                      {r.reference && <span className="font-mono text-xs text-muted-foreground">{r.reference}</span>}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {formatDateTime(r.created)}{r.actor && names[r.actor] ? ` · ${names[r.actor]}` : ''}
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className={`font-semibold tabular-nums ${up ? 'text-emerald-600' : 'text-red-600'}`}>{up ? '+' : ''}{r.delta}</p>
                  <p className="text-[11px] text-muted-foreground tabular-nums">{r.stock_before} → {r.stock_after}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
