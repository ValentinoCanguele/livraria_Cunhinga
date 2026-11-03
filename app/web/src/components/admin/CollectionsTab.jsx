import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Loader2, Plus, Pencil, Trash2, BookOpen, Layers, ArrowUp, ArrowDown, Star, Eye, EyeOff, Search, X, ExternalLink, RefreshCw,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import pb from '@/lib/dataClient';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import ImageField from '@/components/admin/ImageField';
import { useIntegrations } from '@/hooks/useIntegrations';
import { pbErrorMessage, saveRecordWithMedia } from '@/lib/mediaSave';
import { isBookVisible } from '@/lib/pricing';

const emptyCollection = {
  title: '',
  slug: '',
  description: '',
  cover: '',
  sort_order: 0,
  active: true,
  featured: false,
  marketing_tagline: '',
  seo_title: '',
  seo_description: '',
};

function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80);
}

const coverOf = (c) => c.cover || (c.cover_image ? pb.files.getURL(c, c.cover_image) : '');

export default function CollectionsTab({ books = [], onBooksChange }) {
  const { toast } = useToast();
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyCollection);
  const [coverFile, setCoverFile] = useState(null);
  const [coverRemoved, setCoverRemoved] = useState(false);
  const [hadCoverFile, setHadCoverFile] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [toDelete, setToDelete] = useState(null);
  const { driveImageConfig } = useIntegrations();
  const [selectedCollection, setSelectedCollection] = useState(null);
  const [bookQuery, setBookQuery] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      setCollections(await pb.collection('book_collections').getFullList({ sort: 'sort_order,title' }));
    } catch (err) {
      setCollections([]);
      setLoadError(pbErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const countByCollection = useMemo(() => {
    const map = new Map();
    books.forEach((b) => { if (b.collection_id) map.set(b.collection_id, (map.get(b.collection_id) || 0) + 1); });
    return map;
  }, [books]);

  const openCreate = () => {
    setEditing(null);
    const nextOrder = collections.reduce((max, c) => Math.max(max, Number(c.sort_order) || 0), 0) + 1;
    setForm({ ...emptyCollection, sort_order: nextOrder });
    setCoverFile(null);
    setCoverRemoved(false);
    setHadCoverFile(false);
    setShowForm(true);
  };

  const openEdit = (c) => {
    setEditing(c);
    setHadCoverFile(!!c.cover_image);
    setCoverRemoved(false);
    setCoverFile(null);
    setForm({
      title: c.title || '',
      slug: c.slug || '',
      description: c.description || '',
      cover: coverOf(c),
      sort_order: c.sort_order ?? 0,
      active: !!c.active,
      featured: !!c.featured,
      marketing_tagline: c.marketing_tagline || '',
      seo_title: c.seo_title || '',
      seo_description: c.seo_description || '',
    });
    setShowForm(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const title = form.title.trim();
    const slug = slugify(form.slug || title);
    if (!title) {
      toast({ variant: 'destructive', title: 'Indique o título da coleção.' });
      return;
    }
    if (!slug) {
      toast({ variant: 'destructive', title: 'Endereço inválido', description: 'O título ou o endereço tem de ter letras ou números.' });
      return;
    }
    if (collections.some((c) => c.slug === slug && c.id !== editing?.id)) {
      toast({ variant: 'destructive', title: 'Endereço repetido', description: `Já existe uma coleção em /colecoes/${slug}.` });
      return;
    }
    setSaving(true);
    try {
      const data = {
        ...form,
        title,
        slug,
        marketing_tagline: form.marketing_tagline.trim(),
        sort_order: Number(form.sort_order) || 0,
        active: !!form.active,
        featured: !!form.featured,
      };
      const id = await saveRecordWithMedia({
        collection: 'book_collections',
        recordId: editing?.id,
        data,
        file: coverFile,
        fileField: 'cover_image',
        urlField: 'cover',
        removed: coverRemoved,
        hadFile: hadCoverFile,
      });
      toast({ title: editing ? 'Coleção actualizada' : 'Coleção criada' });
      setShowForm(false);
      if (!editing && id) setSelectedCollection(id);
      load();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erro ao guardar', description: pbErrorMessage(err) });
    } finally {
      setSaving(false);
    }
  };

  const patch = async (c, changes, successTitle) => {
    setBusyId(c.id);
    setCollections((prev) => prev.map((x) => (x.id === c.id ? { ...x, ...changes } : x)));
    try {
      await pb.collection('book_collections').update(c.id, changes);
      if (successTitle) toast({ title: successTitle });
    } catch (err) {
      setCollections((prev) => prev.map((x) => (x.id === c.id ? c : x)));
      toast({ variant: 'destructive', title: 'Não foi possível alterar', description: pbErrorMessage(err) });
    } finally {
      setBusyId(null);
    }
  };

  // Troca de lugar com o vizinho e renumera (1, 2, 3…), o que também corrige ordens repetidas.
  const move = async (index, delta) => {
    const target = index + delta;
    if (target < 0 || target >= collections.length) return;
    const reordered = [...collections];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    const withOrder = reordered.map((c, i) => ({ ...c, sort_order: i + 1 }));
    const before = new Map(collections.map((c) => [c.id, Number(c.sort_order)]));
    const changed = withOrder.filter((c) => before.get(c.id) !== c.sort_order);
    setCollections(withOrder);
    setBusyId(collections[index].id);
    try {
      await Promise.all(changed.map((c) => pb.collection('book_collections').update(c.id, { sort_order: c.sort_order })));
    } catch (err) {
      toast({ variant: 'destructive', title: 'Não foi possível reordenar', description: pbErrorMessage(err) });
      load();
    } finally {
      setBusyId(null);
    }
  };

  const confirmDelete = async () => {
    const c = toDelete;
    if (!c) return;
    setBusyId(c.id);
    try {
      // Os livros ficam sem coleção, em vez de apontarem para uma que já não existe.
      if (countByCollection.get(c.id)) {
        const { error } = await supabase.from('stock_books').update({ collection_id: '' }).eq('collection_id', c.id);
        if (error) throw error;
      }
      await pb.collection('book_collections').delete(c.id);
      toast({ title: 'Coleção eliminada' });
      if (selectedCollection === c.id) setSelectedCollection(null);
      load();
      onBooksChange?.();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Não foi possível eliminar', description: pbErrorMessage(err) });
    } finally {
      setBusyId(null);
      setToDelete(null);
    }
  };

  const assignBook = async (bookId, collectionId) => {
    try {
      await pb.collection('stock_books').update(bookId, { collection_id: collectionId || '' });
      toast({ title: collectionId ? 'Livro adicionado à coleção' : 'Livro removido da coleção' });
      onBooksChange?.();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erro', description: pbErrorMessage(err) });
    }
  };

  const selected = collections.find((c) => c.id === selectedCollection) || null;
  const collectionBooks = selected ? books.filter((b) => b.collection_id === selected.id) : [];
  const candidates = useMemo(() => {
    if (!selected) return [];
    const q = bookQuery.trim().toLowerCase();
    if (!q) return [];
    return books
      .filter((b) => b.collection_id !== selected.id)
      .filter((b) => [b.title, b.author, b.book_code, b.isbn].filter(Boolean).join(' ').toLowerCase().includes(q))
      .slice(0, 12);
  }, [books, bookQuery, selected]);
  const otherCollectionName = (id) => collections.find((c) => c.id === id)?.title;

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Layers className="h-6 w-6 text-primary" /> Coleções do catálogo
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Agrupe livros em coleções temáticas. A ordem aqui é a ordem na página Coleções.
          </p>
        </div>
        <Button className="btn-primary shrink-0" onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" /> Nova coleção
        </Button>
      </div>

      {loadError && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <span className="text-destructive">Não foi possível carregar as coleções: {loadError}</span>
          <Button size="sm" variant="outline" onClick={load}><RefreshCw className="h-4 w-4 mr-1" /> Tentar de novo</Button>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="space-y-3">
          {collections.map((c, i) => {
            const cover = coverOf(c);
            return (
              <div
                key={c.id}
                className={`flex gap-3 bg-card border rounded-xl p-3 sm:p-4 items-center cursor-pointer transition-colors ${
                  selectedCollection === c.id ? 'ring-2 ring-[#0ea5c9]/40 border-[#0ea5c9]/30' : 'hover:bg-muted/20'
                } ${c.active ? '' : 'opacity-70'}`}
                onClick={() => { setSelectedCollection(c.id); setBookQuery(''); }}
              >
                <div className="flex flex-col" onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="icon" className="h-6 w-6" disabled={i === 0 || !!busyId} onClick={() => move(i, -1)} aria-label="Subir">
                    <ArrowUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6" disabled={i === collections.length - 1 || !!busyId} onClick={() => move(i, 1)} aria-label="Descer">
                    <ArrowDown className="h-3.5 w-3.5" />
                  </Button>
                </div>
                {cover ? (
                  <img src={cover} alt={c.title} className="w-14 h-14 sm:w-16 sm:h-16 object-cover rounded-lg shrink-0" />
                ) : (
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-lg bg-[#0ea5c9]/10 flex items-center justify-center shrink-0">
                    <Layers className="h-6 w-6 text-primary" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold truncate">{c.title}</h3>
                  <p className="text-xs text-muted-foreground truncate">{c.marketing_tagline || `/colecoes/${c.slug || c.id}`}</p>
                  <div className="flex flex-wrap gap-2 mt-1 items-center">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${c.active ? 'bg-green-500/15 text-green-700 dark:text-green-400' : 'bg-muted text-muted-foreground'}`}>
                      {c.active ? 'Visível' : 'Oculta'}
                    </span>
                    {c.featured && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-400">Destaque</span>}
                    {!cover && <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">Sem capa</span>}
                    <span className="text-[10px] text-muted-foreground">{countByCollection.get(c.id) || 0} livros</span>
                  </div>
                </div>
                <div className="flex flex-wrap justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
                  <Button
                    variant="ghost" size="icon" disabled={busyId === c.id}
                    onClick={() => patch(c, { featured: !c.featured }, c.featured ? 'Destaque retirado' : 'Coleção em destaque')}
                    aria-label={c.featured ? 'Retirar destaque' : 'Destacar'}
                  >
                    <Star className={`h-4 w-4 ${c.featured ? 'fill-amber-400 text-amber-500' : ''}`} />
                  </Button>
                  <Button
                    variant="ghost" size="icon" disabled={busyId === c.id}
                    onClick={() => patch(c, { active: !c.active }, c.active ? 'Coleção oculta na loja' : 'Coleção visível na loja')}
                    aria-label={c.active ? 'Ocultar' : 'Mostrar'}
                  >
                    {c.active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => openEdit(c)} aria-label="Editar"><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" disabled={busyId === c.id} onClick={() => setToDelete(c)} aria-label="Eliminar">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            );
          })}
          {!loadError && collections.length === 0 && (
            <p className="text-muted-foreground text-center py-12 border rounded-xl border-dashed">
              Nenhuma coleção. Crie a primeira para organizar o catálogo.
            </p>
          )}
        </div>

        <div className="bg-card border rounded-xl p-5 lg:sticky lg:top-4 self-start">
          {selected ? (
            <>
              <div className="flex items-start justify-between gap-2 mb-4">
                <div className="min-w-0">
                  <h3 className="font-bold truncate">{selected.title}</h3>
                  <p className="text-sm text-muted-foreground">{collectionBooks.length} livro(s) nesta coleção</p>
                </div>
                {selected.active && (
                  <Button asChild size="sm" variant="outline">
                    <Link to={`/colecoes/${selected.slug || selected.id}`} target="_blank"><ExternalLink className="h-3.5 w-3.5 mr-1" /> Ver</Link>
                  </Button>
                )}
              </div>

              <div className="space-y-2 mb-4">
                <Label htmlFor="collection-book-search">Adicionar livro</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="collection-book-search"
                    value={bookQuery}
                    onChange={(e) => setBookQuery(e.target.value)}
                    placeholder="Pesquisar por título, autor, código ou ISBN…"
                    className="pl-9 pr-9"
                  />
                  {bookQuery && (
                    <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setBookQuery('')} aria-label="Limpar">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                {bookQuery.trim() && (
                  <ul className="border rounded-lg divide-y max-h-64 overflow-y-auto">
                    {candidates.map((b) => (
                      <li key={b.id} className="flex items-center justify-between gap-2 p-2 text-sm">
                        <span className="min-w-0">
                          <span className="block truncate">{b.title}</span>
                          <span className="block text-[11px] text-muted-foreground truncate">
                            {b.author}{b.collection_id && otherCollectionName(b.collection_id) ? ` · está em "${otherCollectionName(b.collection_id)}"` : ''}
                          </span>
                        </span>
                        <Button size="sm" variant="outline" className="h-7 text-xs shrink-0" onClick={() => assignBook(b.id, selected.id)}>
                          {b.collection_id ? 'Mover' : 'Adicionar'}
                        </Button>
                      </li>
                    ))}
                    {candidates.length === 0 && <li className="p-3 text-sm text-muted-foreground">Nenhum livro encontrado.</li>}
                  </ul>
                )}
                <p className="text-[11px] text-muted-foreground">Cada livro pertence a uma só coleção; adicionar aqui tira-o da anterior.</p>
              </div>

              {collectionBooks.length > 0 ? (
                <ul className="space-y-2">
                  {collectionBooks.map((b) => (
                    <li key={b.id} className="flex items-center justify-between text-sm p-2 rounded-lg bg-muted/30">
                      <span className="truncate flex items-center gap-2">
                        <BookOpen className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span className="truncate">{b.title}</span>
                        {!isBookVisible(b) && <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">oculto</span>}
                      </span>
                      <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => assignBook(b.id, '')}>
                        Remover
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhum livro atribuído.</p>
              )}
            </>
          ) : (
            <div className="text-center py-16 text-muted-foreground">
              <Layers className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>Seleccione uma coleção para gerir os livros</p>
            </div>
          )}
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => !saving && setShowForm(false)}>
          <div className="bg-background rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold mb-6">{editing ? 'Editar coleção' : 'Nova coleção'}</h2>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-2">
                <Label>Título *</Label>
                <Input value={form.title} onChange={(e) => set('title', e.target.value)} required maxLength={120} />
              </div>
              <div className="space-y-2">
                <Label>Endereço (URL)</Label>
                <Input value={form.slug} onChange={(e) => set('slug', e.target.value)} placeholder={slugify(form.title) || 'minha-colecao'} className="font-mono text-sm" />
                <p className="text-[11px] text-muted-foreground">
                  /colecoes/{slugify(form.slug || form.title) || '…'}
                  {editing && editing.slug && slugify(form.slug || form.title) !== editing.slug ? ' · os links antigos deixam de funcionar' : ''}
                </p>
              </div>
              <div className="space-y-2">
                <Label>Frase de marketing</Label>
                <Input value={form.marketing_tagline} onChange={(e) => set('marketing_tagline', e.target.value)} maxLength={160} placeholder="Ex.: Os essenciais para a sua fé" />
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea rows={3} value={form.description} onChange={(e) => set('description', e.target.value)} maxLength={2000} />
              </div>
              <ImageField
                label="Capa da coleção"
                gallery="slide"
                value={form.cover}
                onChange={(v) => { set('cover', v); setCoverRemoved(false); }}
                onFileChange={(f) => { setCoverFile(f); if (f) setCoverRemoved(false); }}
                onClear={() => setCoverRemoved(true)}
                aspect="16:9"
                driveConfig={driveImageConfig}
              />
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex items-center gap-2">
                  <Switch checked={form.active} onCheckedChange={(v) => set('active', v)} />
                  <Label>Visível na loja</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={form.featured} onCheckedChange={(v) => set('featured', v)} />
                  <Label>Destaque na loja</Label>
                </div>
              </div>
              <div className="space-y-2">
                <Label>SEO: título</Label>
                <Input value={form.seo_title} onChange={(e) => set('seo_title', e.target.value)} maxLength={70} placeholder={form.title} />
                <p className="text-[11px] text-muted-foreground">{form.seo_title.length}/70</p>
              </div>
              <div className="space-y-2">
                <Label>SEO: descrição</Label>
                <Textarea rows={2} value={form.seo_description} onChange={(e) => set('seo_description', e.target.value)} maxLength={160} />
                <p className="text-[11px] text-muted-foreground">{form.seo_description.length}/160</p>
              </div>
              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setShowForm(false)} disabled={saving}>Cancelar</Button>
                <Button type="submit" className="flex-1 btn-primary" disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Guardar
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar a coleção "{toDelete?.title}"?</AlertDialogTitle>
            <AlertDialogDescription>
              {countByCollection.get(toDelete?.id)
                ? `Os ${countByCollection.get(toDelete?.id)} livro(s) desta coleção continuam no catálogo, mas ficam sem coleção. `
                : ''}
              Os links para /colecoes/{toDelete?.slug || toDelete?.id} deixam de funcionar. Para a esconder sem perder nada, use "Ocultar".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            {toDelete?.active && (
              <Button variant="outline" onClick={() => { const c = toDelete; setToDelete(null); patch(c, { active: false }, 'Coleção oculta na loja'); }}>
                Ocultar
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
