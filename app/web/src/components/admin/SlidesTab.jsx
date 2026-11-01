import React, { useState, useEffect, useCallback } from 'react';
import { Loader2, Plus, Pencil, Trash2, BookOpen, Eye } from 'lucide-react';
import pb from '@/lib/dataClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import RichTextEditor, { SLIDE_TEMPLATES } from '@/components/admin/RichTextEditor';
import ImageField from '@/components/admin/ImageField';
import { useIntegrations } from '@/hooks/useIntegrations';
import { pbErrorMessage, sanitizeUrlField } from '@/lib/mediaSave';
import { isUploadPending } from '@/lib/mediaUpload';

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
};

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
  const { driveImageConfig } = useIntegrations();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [slidesList, booksList] = await Promise.all([
        pb.collection('hero_slides').getFullList({ sort: 'sort_order' }),
        pb.collection('stock_books').getFullList({ sort: 'title' }),
      ]);
      setSlides(slidesList);
      setBooks(booksList);
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erro', description: err.message });
    } finally {
      setLoading(false);
    }
  }, [toast]);

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
      promo_price: book.price ?? '',
      promo_badge: book.urgency_text || (book.featured ? 'Destaque' : 'Promoção'),
      template: f.template === 'classic' ? 'book_promo' : f.template,
    }));
  };

  const openCreate = () => {
    setEditing(null);
    setForm(emptySlide);
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
    });
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
    setSaving(true);
    try {
      const data = {
        ...form,
        image: sanitizeUrlField(form.image),
        book_cover: sanitizeUrlField(form.book_cover),
        video_url: form.video_url?.trim() || '',
        sort_order: Number(form.sort_order) || 0,
        active: !!form.active,
        promo_price: form.promo_price !== '' ? Number(form.promo_price) : null,
        is_primary: !!form.is_primary,
        duration_ms: Number(form.duration_ms) || 6000,
      };
      if (editing) {
        await pb.collection('hero_slides').update(editing.id, data);
        toast({ title: 'Slide actualizado' });
      } else {
        await pb.collection('hero_slides').create(data);
        toast({ title: 'Slide adicionado' });
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

  const handleDelete = async (s) => {
    if (!confirm(`Eliminar slide "${s.title}"?`)) return;
    await pb.collection('hero_slides').delete(s.id);
    toast({ title: 'Slide eliminado' });
    load();
    onChange?.();
  };

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-[#0ea5c9]" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start gap-4">
        <div>
          <h2 className="text-2xl font-bold">Slides — Homepage & Loja</h2>
          <p className="text-sm text-muted-foreground mt-1">
            O slide <strong>principal</strong> inicia sempre primeiro. Transições estilo TV.
          </p>
        </div>
        <Button className="btn-primary shrink-0" onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" /> Novo Slide
        </Button>
      </div>

      <div className="grid gap-4">
        {slides.map((s) => (
          <div key={s.id} className="flex gap-4 bg-card border rounded-xl p-4 items-center">
            <img src={s.image || s.book_cover} alt={s.title} className="w-28 h-20 object-cover rounded-lg shrink-0 bg-muted" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold truncate">{s.title}</h3>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#0ea5c9]/10 text-[#0ea5c9] font-medium">
                  {SLIDE_TEMPLATES.find((t) => t.id === (s.template || 'classic'))?.label || 'Clássico'}
                </span>
              </div>
              <p className="text-sm text-muted-foreground truncate">{s.subtitle}</p>
              {s.book_id && <p className="text-xs text-[#0ea5c9] mt-0.5 flex items-center gap-1"><BookOpen className="h-3 w-3" /> Livro ligado</p>}
              <span className={`text-xs ${s.active ? 'text-green-600' : 'text-muted-foreground'}`}>{s.active ? 'Ativo' : 'Inativo'}</span>
            </div>
            <Button variant="ghost" size="icon" onClick={() => openEdit(s)}><Pencil className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" onClick={() => handleDelete(s)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
          </div>
        ))}
        {slides.length === 0 && <p className="text-muted-foreground text-center py-8">Nenhum slide configurado.</p>}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-background rounded-2xl w-full max-w-4xl max-h-[92vh] overflow-y-auto shadow-xl">
            <div className="sticky top-0 bg-background border-b px-6 py-4 flex justify-between items-center z-10">
              <h2 className="text-xl font-bold">{editing ? 'Editar Slide' : 'Novo Slide Premium'}</h2>
              <Button variant="ghost" size="icon" onClick={() => setShowForm(false)}>×</Button>
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
                    <Label>Livro em Destaque</Label>
                    <Select value={form.book_id || '_none'} onValueChange={(v) => { if (v === '_none') set('book_id', ''); else applyBook(v); }}>
                      <SelectTrigger><SelectValue placeholder="Seleccionar livro..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none">Nenhum (slide genérico)</SelectItem>
                        {books.map((b) => (
                          <SelectItem key={b.id} value={b.id}>{b.title} — {b.author}</SelectItem>
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
                      <Label>Preço Promocional (Kz)</Label>
                      <Input type="number" value={form.promo_price} onChange={(e) => set('promo_price', e.target.value)} />
                    </div>
                  </div>
                  {form.book_cover && (
                    <div className="flex gap-4 items-start p-3 rounded-xl border bg-muted/20">
                      <img src={form.book_cover} alt="" className="w-20 h-28 object-cover rounded-lg shadow" />
                      <div>
                        <p className="font-semibold">{form.book_title}</p>
                        <p className="text-sm text-muted-foreground">{form.book_author}</p>
                        {form.promo_price && <p className="text-[#0ea5c9] font-bold mt-1">Kz {Number(form.promo_price).toLocaleString('pt-AO')}</p>}
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
                      <Label>Duração (ms)</Label>
                      <Input type="number" value={form.duration_ms} onChange={(e) => set('duration_ms', e.target.value)} min={3000} step={500} />
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
                      value={form.book_cover}
                      onChange={(v) => set('book_cover', v)}
                      aspect="3:4"
                      previewClassName="h-28 w-20"
                      driveConfig={driveImageConfig}
                      uploadFolder="hero_slides"
                    />
                  )}
                  <div className="space-y-2">
                    <Label>Ordem</Label>
                    <Input type="number" value={form.sort_order} onChange={(e) => set('sort_order', e.target.value)} />
                  </div>
                  <div className="flex flex-wrap gap-6">
                    <div className="flex items-center gap-3">
                      <Switch checked={form.active} onCheckedChange={(v) => set('active', v)} />
                      <Label>Activo</Label>
                    </div>
                    <div className="flex items-center gap-3">
                      <Switch checked={form.is_primary} onCheckedChange={(v) => set('is_primary', v)} />
                      <Label>Slide principal (inicia primeiro)</Label>
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
    </div>
  );
}
