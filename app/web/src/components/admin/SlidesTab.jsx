import React, { useState, useEffect, useCallback } from 'react';
import {
  Loader2, Plus, Pencil, Trash2, BookOpen, Eye, EyeOff, ArrowUp, ArrowDown, Copy, Crown, CalendarClock, AlertTriangle, RefreshCw,
} from 'lucide-react';
import pb from '@/lib/dataClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import RichTextEditor, { SLIDE_TEMPLATES } from '@/components/admin/RichTextEditor';
import ImageField from '@/components/admin/ImageField';
import { useIntegrations } from '@/hooks/useIntegrations';
import { pbErrorMessage, sanitizeUrlField } from '@/lib/mediaSave';
import { isUploadPending } from '@/lib/mediaUpload';
import { effectivePrice, isBookVisible, isSaleActive, toLocalInput, fromLocalInput } from '@/lib/pricing';

const emptySlide = {
  title: '',
  subtitle: '',
  image: '',
  cta_text: 'Explorar',
  cta_link: '/shop',
  sort_order: 0,
  active: true,
  template: 'classic',
  book_id: '',
  body_html: '',
  promo_badge: '',
  promo_price: '',
  book_cover: '',
  book_title: '',
  book_author: '',
  placement: 'home',
  is_primary: false,
  transition: 'fade',
  media_type: 'image',
  video_url: '',
  duration_ms: 6000,
  starts_at: '',
  ends_at: '',
};

const PLACEMENT_LABELS = { home: 'Homepage', shop: 'Loja', both: 'Homepage e loja' };

/** Estado de publicação de um slide, tendo em conta o agendamento. */
function slideStatus(s, now = Date.now()) {
  if (!s.active) return { key: 'off', label: 'Inactivo', className: 'bg-muted text-muted-foreground' };
  if (s.starts_at && new Date(s.starts_at).getTime() > now) {
    return { key: 'scheduled', label: `Agendado: ${new Date(s.starts_at).toLocaleString('pt-AO', { dateStyle: 'short', timeStyle: 'short' })}`, className: 'bg-sky-500/15 text-sky-700 dark:text-sky-400' };
  }
  if (s.ends_at && new Date(s.ends_at).getTime() <= now) {
    return { key: 'ended', label: 'Terminado', className: 'bg-muted text-muted-foreground' };
  }
  return { key: 'live', label: s.ends_at ? `No ar até ${new Date(s.ends_at).toLocaleDateString('pt-AO')}` : 'No ar', className: 'bg-green-500/15 text-green-700 dark:text-green-400' };
}

export default function SlidesTab({ onChange }) {
  const { toast } = useToast();
  const [slides, setSlides] = useState([]);
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptySlide);
  const [saving, setSaving] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState('classic');
  const [loadError, setLoadError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [toDelete, setToDelete] = useState(null);
  const [bookQuery, setBookQuery] = useState('');
  const { driveImageConfig } = useIntegrations();

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [slidesList, booksList] = await Promise.all([
        pb.collection('hero_slides').getFullList({ sort: 'sort_order,created' }),
        pb.collection('stock_books').getFullList({ sort: 'title' }),
      ]);
      setSlides(slidesList);
      setBooks(booksList);
    } catch (err) {
      setLoadError(pbErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const applyBook = (bookId) => {
    const book = books.find((b) => b.id === bookId);
    if (!book) return;
    setForm((f) => ({
      ...f,
      book_id: book.id,
      book_title: book.title,
      book_author: book.author || '',
      book_cover: book.cover || '',
      title: f.title || book.title,
      subtitle: f.subtitle || book.marketing_hook || book.author || '',
      image: f.image || book.cover || '',
      cta_link: `/product/${book.id}`,
      cta_text: f.cta_text || 'Ver Livro',
      promo_price: effectivePrice(book),
      promo_badge: isSaleActive(book) ? 'Promoção' : (book.urgency_text || (book.featured ? 'Destaque' : '')),
      template: f.template === 'classic' ? 'book_promo' : f.template,
    }));
  };

  const openCreate = () => {
    setEditing(null);
    const nextOrder = slides.reduce((max, s) => Math.max(max, Number(s.sort_order) || 0), 0) + 1;
    setForm({ ...emptySlide, sort_order: nextOrder });
    setBookQuery('');
    setPreviewTemplate('classic');
    setShowForm(true);
  };

  const openEdit = (s) => {
    setEditing(s);
    setForm({
      title: s.title || '',
      subtitle: s.subtitle || '',
      image: s.image || '',
      cta_text: s.cta_text || 'Explorar',
      cta_link: s.cta_link || '/shop',
      sort_order: s.sort_order ?? 0,
      active: !!s.active,
      template: s.template || 'classic',
      book_id: s.book_id || '',
      body_html: s.body_html || '',
      promo_badge: s.promo_badge || '',
      promo_price: s.promo_price ?? '',
      book_cover: s.book_cover || '',
      book_title: s.book_title || '',
      book_author: s.book_author || '',
      placement: s.placement || 'home',
      is_primary: !!s.is_primary,
      transition: s.transition || 'fade',
      media_type: s.media_type || 'image',
      video_url: s.video_url || '',
      duration_ms: s.duration_ms ?? 6000,
      starts_at: toLocalInput(s.starts_at),
      ends_at: toLocalInput(s.ends_at),
    });
    setBookQuery('');
    setPreviewTemplate(s.template || 'classic');
    setShowForm(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (isUploadPending(form.image, form.book_cover)) {
      toast({ title: 'A enviar imagem…', description: 'Aguarde que o envio termine e guarde de novo.' });
      return;
    }
    if (form.media_type !== 'video' && !sanitizeUrlField(form.image)) {
      toast({ variant: 'destructive', title: 'Imagem obrigatória', description: 'Adicione uma imagem de fundo ou mude o tipo para vídeo.' });
      return;
    }
    if (form.starts_at && form.ends_at && new Date(form.ends_at) <= new Date(form.starts_at)) {
      toast({ variant: 'destructive', title: 'Datas inválidas', description: 'O fim tem de ser depois do início.' });
      return;
    }
    if (form.cta_link && !/^(\/|https?:\/\/|mailto:|tel:)/i.test(form.cta_link.trim())) {
      toast({ variant: 'destructive', title: 'Link do botão inválido', description: 'Use um caminho do site (ex.: /shop) ou um endereço completo (https://…).' });
      return;
    }
    setSaving(true);
    try {
      const data = {
        ...form,
        title: form.title.trim(),
        cta_link: form.cta_link.trim(),
        starts_at: fromLocalInput(form.starts_at),
        ends_at: fromLocalInput(form.ends_at),
        image: sanitizeUrlField(form.image),
        book_cover: sanitizeUrlField(form.book_cover),
        video_url: form.video_url?.trim() || '',
        sort_order: Number(form.sort_order) || 0,
        active: !!form.active,
        promo_price: form.promo_price !== '' ? Number(form.promo_price) : null,
        is_primary: !!form.is_primary,
        duration_ms: Math.min(Math.max(Number(form.duration_ms) || 6000, 2000), 60000),
      };
      let savedId = editing?.id;
      if (editing) {
        await pb.collection('hero_slides').update(editing.id, data);
        toast({ title: 'Slide actualizado' });
      } else {
        savedId = (await pb.collection('hero_slides').create(data))?.id;
        toast({ title: 'Slide adicionado' });
      }
      // Só um slide principal de cada vez.
      if (data.is_primary && savedId) {
        const others = slides.filter((x) => x.is_primary && x.id !== savedId);
        await Promise.all(others.map((x) => pb.collection('hero_slides').update(x.id, { is_primary: false })));
      }
      setShowForm(false);
      load();
      onChange?.();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erro', description: pbErrorMessage(err) });
    } finally {
      setSaving(false);
    }
  };

  const patch = async (slide, changes, successTitle) => {
    setBusyId(slide.id);
    try {
      await pb.collection('hero_slides').update(slide.id, changes);
      if (changes.is_primary) {
        const others = slides.filter((x) => x.is_primary && x.id !== slide.id);
        await Promise.all(others.map((x) => pb.collection('hero_slides').update(x.id, { is_primary: false })));
      }
      if (successTitle) toast({ title: successTitle });
      await load();
      onChange?.();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Não foi possível alterar', description: pbErrorMessage(err) });
    } finally {
      setBusyId(null);
    }
  };

  // Troca de lugar com o vizinho e renumera (1, 2, 3…), o que também corrige ordens repetidas.
  const move = async (index, delta) => {
    const target = index + delta;
    if (target < 0 || target >= slides.length) return;
    const reordered = [...slides];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    const withOrder = reordered.map((x, i) => ({ ...x, sort_order: i + 1 }));
    const before = new Map(slides.map((x) => [x.id, Number(x.sort_order)]));
    const changed = withOrder.filter((x) => before.get(x.id) !== x.sort_order);
    setSlides(withOrder);
    setBusyId(slides[index].id);
    try {
      await Promise.all(changed.map((x) => pb.collection('hero_slides').update(x.id, { sort_order: x.sort_order })));
      onChange?.();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Não foi possível reordenar', description: pbErrorMessage(err) });
      load();
    } finally {
      setBusyId(null);
    }
  };

  const duplicate = async (slide) => {
    setBusyId(slide.id);
    try {
      const { id: _id, created: _c, updated: _u, collectionId: _ci, collectionName: _cn, expand: _e, ...rest } = slide;
      const nextOrder = slides.reduce((max, x) => Math.max(max, Number(x.sort_order) || 0), 0) + 1;
      await pb.collection('hero_slides').create({
        ...rest, title: `${slide.title} (cópia)`, active: false, is_primary: false, sort_order: nextOrder,
      });
      toast({ title: 'Slide duplicado', description: 'A cópia fica inactiva até a activar.' });
      await load();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Não foi possível duplicar', description: pbErrorMessage(err) });
    } finally {
      setBusyId(null);
    }
  };

  const confirmDelete = async () => {
    const slide = toDelete;
    if (!slide) return;
    setBusyId(slide.id);
    try {
      await pb.collection('hero_slides').delete(slide.id);
      toast({ title: 'Slide eliminado' });
      await load();
      onChange?.();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Não foi possível eliminar', description: pbErrorMessage(err) });
    } finally {
      setBusyId(null);
      setToDelete(null);
    }
  };

  const linkedBook = books.find((b) => b.id === form.book_id);
  const priceMismatch = linkedBook && form.promo_price !== '' && form.promo_price != null
    && Number(form.promo_price) !== effectivePrice(linkedBook);
  const bookOptions = (() => {
    const q = bookQuery.trim().toLowerCase();
    const list = q
      ? books.filter((b) => [b.title, b.author, b.book_code, b.isbn].filter(Boolean).join(' ').toLowerCase().includes(q))
      : books;
    const limited = list.slice(0, 50);
    if (linkedBook && !limited.some((b) => b.id === linkedBook.id)) limited.unshift(linkedBook);
    return limited;
  })();
  const liveCount = slides.filter((x) => slideStatus(x).key === 'live').length;

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-4">
        <div>
          <h2 className="text-2xl font-bold">Slides: homepage e loja</h2>
          <p className="text-sm text-muted-foreground mt-1">
            O slide <strong>principal</strong> aparece sempre primeiro; os outros seguem a ordem da lista. {liveCount} no ar.
          </p>
        </div>
        <Button className="btn-primary shrink-0" onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" /> Novo slide
        </Button>
      </div>

      {loadError && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <span className="text-destructive">Não foi possível carregar os slides: {loadError}</span>
          <Button size="sm" variant="outline" onClick={load}><RefreshCw className="h-4 w-4 mr-1" /> Tentar de novo</Button>
        </div>
      )}

      <div className="grid gap-3">
        {slides.map((s, i) => {
          const status = slideStatus(s);
          const thumb = s.image || s.book_cover;
          return (
            <div key={s.id} className={`flex flex-wrap sm:flex-nowrap gap-3 bg-card border rounded-xl p-3 sm:p-4 items-center ${status.key === 'live' ? '' : 'opacity-75'}`}>
              <div className="flex flex-col">
                <Button variant="ghost" size="icon" className="h-6 w-6" disabled={i === 0 || !!busyId} onClick={() => move(i, -1)} aria-label="Subir">
                  <ArrowUp className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-6 w-6" disabled={i === slides.length - 1 || !!busyId} onClick={() => move(i, 1)} aria-label="Descer">
                  <ArrowDown className="h-3.5 w-3.5" />
                </Button>
              </div>
              {thumb ? (
                <img src={thumb} alt={s.title} className="w-24 h-16 sm:w-28 sm:h-20 object-cover rounded-lg shrink-0 bg-muted" />
              ) : (
                <div className="w-24 h-16 sm:w-28 sm:h-20 rounded-lg shrink-0 bg-muted flex items-center justify-center text-[10px] text-muted-foreground">Sem imagem</div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold truncate">{s.title}</h3>
                  {s.is_primary && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-400 font-medium flex items-center gap-1"><Crown className="h-3 w-3" /> Principal</span>}
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#0ea5c9]/10 text-primary font-medium">
                    {SLIDE_TEMPLATES.find((t) => t.id === (s.template || 'classic'))?.label || 'Clássico'}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground truncate">{s.subtitle}</p>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${status.className}`}>{status.label}</span>
                  <span className="text-[10px] text-muted-foreground">{PLACEMENT_LABELS[s.placement || 'home'] || s.placement}</span>
                  {s.book_id && <span className="text-[10px] text-primary flex items-center gap-1"><BookOpen className="h-3 w-3" /> Livro ligado</span>}
                  {s.book_id && books.some((b) => b.id === s.book_id && !isBookVisible(b)) && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-destructive/10 text-destructive">Livro oculto</span>
                  )}
                  {s.book_id && (() => {
                    const b = books.find((x) => x.id === s.book_id);
                    return b && s.promo_price != null && s.promo_price !== '' && Number(s.promo_price) !== effectivePrice(b)
                      ? <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-400">Preço diferente do livro</span>
                      : null;
                  })()}
                </div>
              </div>
              <div className="flex flex-wrap justify-end gap-0.5">
                <Button
                  variant="ghost" size="icon" disabled={busyId === s.id || s.is_primary}
                  onClick={() => patch(s, { is_primary: true }, 'Slide principal definido')}
                  aria-label="Tornar principal" title="Tornar principal"
                >
                  <Crown className={`h-4 w-4 ${s.is_primary ? 'text-amber-500' : ''}`} />
                </Button>
                <Button
                  variant="ghost" size="icon" disabled={busyId === s.id}
                  onClick={() => patch(s, { active: !s.active }, s.active ? 'Slide desactivado' : 'Slide activado')}
                  aria-label={s.active ? 'Desactivar' : 'Activar'} title={s.active ? 'Desactivar' : 'Activar'}
                >
                  {s.active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </Button>
                <Button variant="ghost" size="icon" disabled={busyId === s.id} onClick={() => duplicate(s)} aria-label="Duplicar" title="Duplicar">
                  <Copy className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => openEdit(s)} aria-label="Editar" title="Editar"><Pencil className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" disabled={busyId === s.id} onClick={() => setToDelete(s)} aria-label="Eliminar" title="Eliminar">
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          );
        })}
        {!loadError && slides.length === 0 && (
          <p className="text-muted-foreground text-center py-10 border border-dashed rounded-xl">Nenhum slide configurado.</p>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-background rounded-2xl w-full max-w-4xl max-h-[92vh] overflow-y-auto shadow-xl">
            <div className="sticky top-0 bg-background border-b px-6 py-4 flex justify-between items-center z-10">
              <h2 className="text-xl font-bold">{editing ? 'Editar slide' : 'Novo slide'}</h2>
              <Button variant="ghost" size="icon" onClick={() => setShowForm(false)} aria-label="Fechar">×</Button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-6">
              <Tabs defaultValue="content">
                <TabsList className="mb-4">
                  <TabsTrigger value="content">Conteúdo</TabsTrigger>
                  <TabsTrigger value="book">Livro Destaque</TabsTrigger>
                  <TabsTrigger value="design">Modelo & Visual</TabsTrigger>
                </TabsList>

                <TabsContent value="content" className="space-y-4">
                  <div className="space-y-2">
                    <Label>Título *</Label>
                    <Input value={form.title} onChange={(e) => set('title', e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Subtítulo</Label>
                    <Input value={form.subtitle} onChange={(e) => set('subtitle', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Texto Premium (editor avançado)</Label>
                    <RichTextEditor value={form.body_html} onChange={(v) => set('body_html', v)} placeholder="Descrição promocional com formatação..." />
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Texto do Botão</Label>
                      <Input value={form.cta_text} onChange={(e) => set('cta_text', e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Link do Botão</Label>
                      <Input value={form.cta_link} onChange={(e) => set('cta_link', e.target.value)} />
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="book" className="space-y-4">
                  <div className="rounded-xl bg-[#0ea5c9]/5 border border-[#0ea5c9]/20 p-4 text-sm">
                    Seleccione um livro para preencher automaticamente capa, título, autor e link do produto.
                  </div>
                  <div className="space-y-2">
                    <Label>Livro em destaque</Label>
                    <Input value={bookQuery} onChange={(e) => setBookQuery(e.target.value)} placeholder="Filtrar por título, autor, código ou ISBN…" />
                    <Select value={form.book_id || '_none'} onValueChange={(v) => { if (v === '_none') set('book_id', ''); else applyBook(v); }}>
                      <SelectTrigger><SelectValue placeholder="Seleccionar livro..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none">Nenhum (slide genérico)</SelectItem>
                        {bookOptions.map((b) => (
                          <SelectItem key={b.id} value={b.id}>{b.title}{b.author ? ` · ${b.author}` : ''}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Badge Promocional</Label>
                      <Input value={form.promo_badge} onChange={(e) => set('promo_badge', e.target.value)} placeholder="Ex: -20% · Destaque" />
                    </div>
                    <div className="space-y-2">
                      <Label>Preço mostrado no slide (Kz)</Label>
                      <Input type="number" min={0} value={form.promo_price} onChange={(e) => set('promo_price', e.target.value)} />
                    </div>
                  </div>
                  {linkedBook && !isBookVisible(linkedBook) && (
                    <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      <span>Este livro está oculto na loja: o botão do slide leva os clientes a uma página que não abre.</span>
                    </div>
                  )}
                  {priceMismatch && (
                    <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      <span>
                        O checkout cobra o preço em vigor do livro (Kz {effectivePrice(linkedBook).toLocaleString('pt-AO')}), não o do slide.
                        Para baixar o preço, crie uma promoção no livro.
                        <button type="button" className="underline ml-1" onClick={() => set('promo_price', effectivePrice(linkedBook))}>Usar o preço do livro</button>
                      </span>
                    </div>
                  )}
                  {form.book_cover && (
                    <div className="flex gap-4 items-start p-3 rounded-xl border bg-muted/20">
                      <img src={form.book_cover} alt="" className="w-20 h-28 object-cover rounded-lg shadow" />
                      <div>
                        <p className="font-semibold">{form.book_title}</p>
                        <p className="text-sm text-muted-foreground">{form.book_author}</p>
                        {form.promo_price && <p className="text-primary font-bold mt-1">Kz {Number(form.promo_price).toLocaleString('pt-AO')}</p>}
                      </div>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="design" className="space-y-4">
                  <div className="space-y-2">
                    <Label>Modelo de Slide</Label>
                    <div className="grid sm:grid-cols-2 gap-3">
                      {SLIDE_TEMPLATES.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => { set('template', t.id); setPreviewTemplate(t.id); }}
                          className={`text-left p-4 rounded-xl border transition-all ${form.template === t.id ? 'ring-2 ring-[#0ea5c9] border-[#0ea5c9]/40 bg-[#0ea5c9]/5' : 'hover:border-[#0ea5c9]/30'}`}
                        >
                          <p className="font-semibold text-sm">{t.label}</p>
                          <p className="text-xs text-muted-foreground mt-1">{t.description}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Localização</Label>
                      <Select value={form.placement} onValueChange={(v) => set('placement', v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="home">Homepage</SelectItem>
                          <SelectItem value="shop">Loja / Shop</SelectItem>
                          <SelectItem value="both">Ambos</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Transição (estilo TV)</Label>
                      <Select value={form.transition} onValueChange={(v) => set('transition', v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="fade">Fade suave</SelectItem>
                          <SelectItem value="slide">Slide lateral</SelectItem>
                          <SelectItem value="wipe">Wipe TV</SelectItem>
                          <SelectItem value="zoom">Zoom</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Tipo de média</Label>
                      <Select value={form.media_type} onValueChange={(v) => set('media_type', v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="image">Imagem</SelectItem>
                          <SelectItem value="video">Vídeo</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Duração (segundos)</Label>
                      <Input
                        type="number" min={2} max={60} step={0.5}
                        value={form.duration_ms === '' ? '' : Number(form.duration_ms) / 1000}
                        onChange={(e) => set('duration_ms', e.target.value === '' ? '' : Math.round(Number(e.target.value) * 1000))}
                      />
                    </div>
                  </div>
                  {form.media_type === 'video' && (
                    <div className="space-y-2">
                      <Label>URL do Vídeo (MP4/WebM)</Label>
                      <Input value={form.video_url} onChange={(e) => set('video_url', e.target.value)} placeholder="https://...mp4" />
                    </div>
                  )}
                  <ImageField
                    label={form.media_type === 'video' ? 'Imagem poster do vídeo' : 'Imagem de fundo do slide'}
                    gallery="slide"
                    value={form.image}
                    onChange={(v) => set('image', v)}
                    aspect="16:9"
                    previewClassName="h-24 w-40"
                    driveConfig={driveImageConfig}
                    hint="16:9 recomendado · 1920×1080px · URL, upload ou Google Drive"
                    uploadFolder="hero_slides"
                  />
                  {form.template === 'book_promo' && (
                    <ImageField
                      label="Capa do livro (promo)"
                      gallery="capa"
                      value={form.book_cover}
                      onChange={(v) => set('book_cover', v)}
                      aspect="3:4"
                      previewClassName="h-28 w-20"
                      driveConfig={driveImageConfig}
                      uploadFolder="hero_slides"
                    />
                  )}
                  <div className="rounded-xl border p-4 space-y-3">
                    <p className="text-sm font-medium flex items-center gap-2"><CalendarClock className="h-4 w-4 text-primary" /> Agendamento (opcional)</p>
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Começa em</Label>
                        <Input type="datetime-local" value={form.starts_at} onChange={(e) => set('starts_at', e.target.value)} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Termina em</Label>
                        <Input type="datetime-local" value={form.ends_at} min={form.starts_at || undefined} onChange={(e) => set('ends_at', e.target.value)} />
                      </div>
                    </div>
                    <p className="text-[11px] text-muted-foreground">Sem datas, o slide fica no ar enquanto estiver activo. Hora de Angola.</p>
                  </div>
                  <div className="flex flex-wrap gap-6">
                    <div className="flex items-center gap-3">
                      <Switch checked={form.active} onCheckedChange={(v) => set('active', v)} />
                      <Label>Activo</Label>
                    </div>
                    <div className="flex items-center gap-3">
                      <Switch checked={form.is_primary} onCheckedChange={(v) => set('is_primary', v)} />
                      <Label>Slide principal (aparece primeiro)</Label>
                    </div>
                  </div>

                  {/* Mini preview */}
                  <div className="rounded-xl border overflow-hidden">
                    <p className="text-xs font-medium text-muted-foreground px-3 py-2 border-b flex items-center gap-1"><Eye className="h-3.5 w-3.5" /> Pré-visualização</p>
                    <div className="relative h-40 bg-gradient-to-r from-[#0c4a6e] to-[#0ea5c9] flex items-center p-4">
                      {previewTemplate === 'book_promo' && form.book_cover && (
                        <img src={form.book_cover} alt="" className="w-16 h-24 object-cover rounded shadow-lg mr-4" />
                      )}
                      <div className={previewTemplate === 'minimal' ? 'text-center w-full text-white' : 'text-white max-w-md'}>
                        {form.promo_badge && <span className="text-[10px] bg-amber-400 text-amber-900 px-2 py-0.5 rounded-full font-bold">{form.promo_badge}</span>}
                        <p className="font-bold text-lg mt-1 line-clamp-1">{form.title || 'Título'}</p>
                        <p className="text-xs text-white/80 line-clamp-1">{form.subtitle}</p>
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>

              <div className="flex gap-3 pt-2 border-t">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setShowForm(false)}>Cancelar</Button>
                <Button type="submit" className="flex-1 btn-primary" disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Guardar Slide
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar o slide "{toDelete?.title}"?</AlertDialogTitle>
            <AlertDialogDescription>
              O slide sai da homepage e da loja e não pode ser recuperado. Para o tirar do ar sem o perder, desactive-o.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            {toDelete?.active && (
              <Button variant="outline" onClick={() => { const x = toDelete; setToDelete(null); patch(x, { active: false }, 'Slide desactivado'); }}>
                Desactivar
              </Button>
            )}
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={confirmDelete}>
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
