import React, { useState } from 'react';
import { Loader2, Eye, EyeOff, Star, StarOff, Percent, BadgeX, Download, X } from 'lucide-react';
import pb from '@/lib/dataClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { effectivePrice, fromLocalInput, isBookVisible } from '@/lib/pricing';

/** Actualiza vários livros, 8 de cada vez; devolve quantos falharam. */
async function updateMany(books, patchFor) {
  let failed = 0;
  for (let i = 0; i < books.length; i += 8) {
    const chunk = books.slice(i, i + 8);
    const results = await Promise.allSettled(chunk.map((b) => {
      const patch = patchFor(b);
      return patch ? pb.collection('stock_books').update(b.id, patch) : Promise.resolve();
    }));
    failed += results.filter((r) => r.status === 'rejected').length;
  }
  return failed;
}

function exportCsv(books) {
  const cols = [
    ['book_code', 'Código'], ['title', 'Título'], ['author', 'Autor'], ['genre', 'Género'], ['isbn', 'ISBN'],
    ['price', 'Preço (Kz)'], ['effective', 'Preço em vigor (Kz)'], ['stock', 'Stock'], ['sales_count', 'Vendidos'],
    ['visivel', 'Visível'], ['featured', 'Destaque'],
  ];
  const esc = (v) => {
    const t = v == null ? '' : String(v);
    return /[";\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  const num = (v) => Number(v || 0).toFixed(2).replace('.', ',');
  const lines = [cols.map(([, h]) => h).join(';')];
  books.forEach((b) => {
    const row = {
      ...b,
      price: num(b.price),
      effective: num(effectivePrice(b)),
      visivel: isBookVisible(b) ? 'Sim' : 'Não',
      featured: b.featured ? 'Sim' : 'Não',
    };
    lines.push(cols.map(([k]) => esc(row[k])).join(';'));
  });
  const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `livros-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Barra de acções em massa para os livros seleccionados no catálogo do painel. */
export default function BooksBulkBar({ selected, onClear, onDone }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [promoOpen, setPromoOpen] = useState(false);
  const [percent, setPercent] = useState('10');
  const [endsAt, setEndsAt] = useState('');

  if (!selected.length) return null;

  const run = async (label, patchFor) => {
    setBusy(true);
    try {
      const failed = await updateMany(selected, patchFor);
      toast(failed
        ? { variant: 'destructive', title: `${label}: ${selected.length - failed} de ${selected.length}`, description: `${failed} livro(s) não foram alterados.` }
        : { title: label, description: `${selected.length} livro(s) actualizados.` });
      onDone();
    } finally {
      setBusy(false);
    }
  };

  const applyPromo = async () => {
    const p = Number(percent);
    if (!(p >= 1 && p <= 90)) {
      toast({ variant: 'destructive', title: 'Desconto inválido', description: 'Indique uma percentagem entre 1 e 90.' });
      return;
    }
    const ends = fromLocalInput(endsAt);
    if (ends && new Date(ends) <= new Date()) {
      toast({ variant: 'destructive', title: 'Data inválida', description: 'A promoção tem de terminar no futuro.' });
      return;
    }
    setPromoOpen(false);
    await run(`Promoção de ${p}% aplicada`, (b) => {
      const price = Number(b.price) || 0;
      const sale = Math.round(price * (1 - p / 100) * 100) / 100;
      if (!(price > 0 && sale > 0 && sale < price)) return null;
      return { sale_price: sale, sale_starts_at: null, sale_ends_at: ends };
    });
  };

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-[#0ea5c9]/40 bg-[#0ea5c9]/5 p-3">
      <span className="text-sm font-semibold mr-1">{selected.length} seleccionado(s)</span>
      <Button size="sm" variant="outline" disabled={busy} onClick={() => run('Livros visíveis na loja', () => ({ active: true }))}>
        <Eye className="h-4 w-4 mr-1" />Mostrar
      </Button>
      <Button size="sm" variant="outline" disabled={busy} onClick={() => run('Livros ocultos da loja', () => ({ active: false }))}>
        <EyeOff className="h-4 w-4 mr-1" />Ocultar
      </Button>
      <Button size="sm" variant="outline" disabled={busy} onClick={() => run('Livros destacados', () => ({ featured: true }))}>
        <Star className="h-4 w-4 mr-1" />Destacar
      </Button>
      <Button size="sm" variant="outline" disabled={busy} onClick={() => run('Destaque removido', () => ({ featured: false }))}>
        <StarOff className="h-4 w-4 mr-1" />Tirar destaque
      </Button>
      <Button size="sm" variant="outline" disabled={busy} onClick={() => setPromoOpen(true)}>
        <Percent className="h-4 w-4 mr-1" />Promoção
      </Button>
      <Button size="sm" variant="outline" disabled={busy} onClick={() => run('Promoção removida', () => ({ sale_price: null, sale_starts_at: null, sale_ends_at: null }))}>
        <BadgeX className="h-4 w-4 mr-1" />Tirar promoção
      </Button>
      <Button size="sm" variant="outline" disabled={busy} onClick={() => exportCsv(selected)}>
        <Download className="h-4 w-4 mr-1" />Exportar
      </Button>
      <Button size="sm" variant="ghost" disabled={busy} onClick={onClear}>
        {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <X className="h-4 w-4 mr-1" />}Limpar selecção
      </Button>

      <Dialog open={promoOpen} onOpenChange={setPromoOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Promoção em {selected.length} livro(s)</DialogTitle>
            <DialogDescription>O preço promocional é calculado a partir do preço normal de cada livro. Começa já.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label>Desconto (%)</Label>
              <Input type="number" min={1} max={90} value={percent} onChange={(e) => setPercent(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>Termina em (opcional)</Label>
              <Input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPromoOpen(false)}>Cancelar</Button>
            <Button onClick={applyPromo}>Aplicar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
