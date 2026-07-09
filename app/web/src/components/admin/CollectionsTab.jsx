import React, { useState, useEffect, useCallback } from 'react';
import { Loader2, Plus, Pencil, Trash2, BookOpen, Layers } from 'lucide-react';
import pb from '@/lib/pocketbaseClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import ImageField from '@/components/admin/ImageField';
import { useIntegrations } from '@/hooks/useIntegrations';
import { pbErrorMessage, saveRecordWithMedia } from '@/lib/mediaSave';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export default function CollectionsTab({ books = [], onBooksChange }) {
  const { toast } = useToast();
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyCollection);
  const [coverFile, setCoverFile] = useState(null);
  const [coverRemoved, setCoverRemoved] = useState(false);
  const [hadCoverFile, setHadCoverFile] = useState(false);
  const [saving, setSaving] = useState(false);
  const { driveImageConfig } = useIntegrations();
  const [selectedCollection, setSelectedCollection] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await pb.collection('book_collections').getFullList({ sort: 'sort_order' });
      setCollections(list);
    } catch (err) {
      if (!err.message?.includes('404')) {
        toast({ variant: 'destructive', title: 'Erro', description: err.message });
      }
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const openCreate = () => {
    setEditing(null);
    setForm(emptyCollection);
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
      cover: c.cover || (c.cover_image ? pb.files.getURL(c, c.cover_image) : ''),
      sort_order: c.sort_order ?? 0,
      active: !!c.active,
      featured: !!c.featured,
      marketing_tagline: c.marketing_tagline || '',
      seo_title: c.seo_title || '',
      seo_description: c.seo_description || '',
    });
    setCoverFile(null);
    setShowForm(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const data = {
        ...form,
        slug: form.slug || slugify(form.title),
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
      load();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erro', description: pbErrorMessage(err) });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (c) => {
    if (!confirm(`Eliminar coleção "${c.title}"?`)) return;
    try {
      await pb.collection('book_collections').delete(c.id);
      toast({ title: 'Coleção eliminada' });
      if (selectedCollection === c.id) setSelectedCollection(null);
      load();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erro', description: err.message });
    }
  };

  const assignBook = async (bookId, collectionId) => {
    try {
      await pb.collection('stock_books').update(bookId, { collection_id: collectionId || '' });
      toast({ title: collectionId ? 'Livro adicionado à coleção' : 'Livro removido da coleção' });
      onBooksChange?.();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erro', description: err.message });
    }
  };

  const collectionBooks = selectedCollection
    ? books.filter((b) => b.collection_id === selectedCollection)
    : [];

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-[#0ea5c9]" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Layers className="h-6 w-6 text-[#0ea5c9]" /> Coleções do Catálogo
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Agrupe livros em coleções temáticas para marketing e navegação na loja.
          </p>
        </div>
        <Button className="btn-primary shrink-0" onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" /> Nova Coleção
        </Button>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="space-y-3">
          {collections.map((c) => (
            <div
              key={c.id}
              className={`flex gap-4 bg-card border rounded-xl p-4 items-center cursor-pointer transition-colors ${
                selectedCollection === c.id ? 'ring-2 ring-[#0ea5c9]/40 border-[#0ea5c9]/30' : 'hover:bg-muted/20'
              }`}
              onClick={() => setSelectedCollection(c.id)}
            >
              {c.cover || c.cover_image ? (
                <img
                  src={c.cover || pb.files.getURL(c, c.cover_image)}
                  alt={c.title}
                  className="w-16 h-16 object-cover rounded-lg shrink-0"
                />
              ) : (
                <div className="w-16 h-16 rounded-lg bg-[#0ea5c9]/10 flex items-center justify-center shrink-0">
                  <Layers className="h-6 w-6 text-[#0ea5c9]" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold truncate">{c.title}</h3>
                <p className="text-xs text-muted-foreground truncate">{c.marketing_tagline || c.slug}</p>
                <div className="flex gap-2 mt-1">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${c.active ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'}`}>
                    {c.active ? 'Activa' : 'Inactiva'}
                  </span>
                  {c.featured && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">Destaque</span>}
                  <span className="text-[10px] text-muted-foreground">
                    {books.filter((b) => b.collection_id === c.id).length} livros
                  </span>
                </div>
              </div>
              <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="icon" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(c)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            </div>
          ))}
          {collections.length === 0 && (
            <p className="text-muted-foreground text-center py-12 border rounded-xl border-dashed">
              Nenhuma coleção. Crie a primeira para organizar o catálogo.
            </p>
          )}
        </div>

        <div className="bg-card border rounded-xl p-5">
          {selectedCollection ? (
            <>
              <h3 className="font-bold mb-1">{collections.find((c) => c.id === selectedCollection)?.title}</h3>
              <p className="text-sm text-muted-foreground mb-4">Livros nesta coleção</p>
              {collectionBooks.length > 0 ? (
                <ul className="space-y-2 mb-4">
                  {collectionBooks.map((b) => (
                    <li key={b.id} className="flex items-center justify-between text-sm p-2 rounded-lg bg-muted/30">
                      <span className="truncate flex items-center gap-2">
                        <BookOpen className="h-3.5 w-3.5 text-[#0ea5c9]" />
                        {b.title}
                      </span>
                      <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => assignBook(b.id, '')}>
                        Remover
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground mb-4">Nenhum livro atribuído.</p>
              )}
              <div className="space-y-2">
                <Label>Adicionar livro à coleção</Label>
                <Select onValueChange={(bookId) => assignBook(bookId, selectedCollection)}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar livro..." /></SelectTrigger>
                  <SelectContent>
                    {books
                      .filter((b) => b.collection_id !== selectedCollection)
                      .map((b) => (
                        <SelectItem key={b.id} value={b.id}>{b.title}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
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
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-background rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 shadow-xl">
            <h2 className="text-xl font-bold mb-6">{editing ? 'Editar Coleção' : 'Nova Coleção'}</h2>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-2">
                <Label>Título *</Label>
                <Input value={form.title} onChange={(e) => set('title', e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Slug (URL)</Label>
                <Input value={form.slug} onChange={(e) => set('slug', e.target.value)} placeholder={slugify(form.title) || 'minha-colecao'} className="font-mono text-sm" />
              </div>
              <div className="space-y-2">
                <Label>Tagline de Marketing</Label>
                <Input value={form.marketing_tagline} onChange={(e) => set('marketing_tagline', e.target.value)} placeholder="Ex: Os essenciais para a sua fé" />
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea rows={3} value={form.description} onChange={(e) => set('description', e.target.value)} />
              </div>
              <ImageField
                label="Capa da Coleção"
                value={form.cover}
                onChange={(v) => { set('cover', v); setCoverRemoved(false); }}
                onFileChange={(f) => { setCoverFile(f); if (f) setCoverRemoved(false); }}
                onClear={() => setCoverRemoved(true)}
                aspect="16:9"
                driveConfig={driveImageConfig}
              />
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Ordem</Label>
                  <Input type="number" value={form.sort_order} onChange={(e) => set('sort_order', e.target.value)} />
                </div>
                <div className="flex flex-col gap-3 pt-6">
                  <div className="flex items-center gap-2">
                    <Switch checked={form.active} onCheckedChange={(v) => set('active', v)} />
                    <Label>Activa</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={form.featured} onCheckedChange={(v) => set('featured', v)} />
                    <Label>Destaque na loja</Label>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label>SEO — Título</Label>
                <Input value={form.seo_title} onChange={(e) => set('seo_title', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>SEO — Descrição</Label>
                <Textarea rows={2} value={form.seo_description} onChange={(e) => set('seo_description', e.target.value)} />
              </div>
              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setShowForm(false)}>Cancelar</Button>
                <Button type="submit" className="flex-1 btn-primary" disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Guardar
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
