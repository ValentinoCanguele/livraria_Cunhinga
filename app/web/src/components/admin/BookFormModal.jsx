import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  X, Loader2, BookOpen, Hash, Barcode, ImageIcon, Sparkles, Copy, Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BOOK_GENRES, BOOK_LANGUAGES, emptyBookForm, previewBookCode, bookToForm } from '@/lib/bookConstants';
import pb from '@/lib/dataClient';
import { Megaphone, User, BookMarked, Layers, TrendingUp } from 'lucide-react';
import RichTextEditor from '@/components/admin/RichTextEditor';
import ImageField from '@/components/admin/ImageField';
import { useIntegrations } from '@/hooks/useIntegrations';

const PLACEHOLDER_COVER = 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=400&q=80';

export default function BookFormModal({ open, onClose, onSave, editing, template, saving }) {
  const [form, setForm] = useState(emptyBookForm);
  const [copied, setCopied] = useState(false);
  const [autoCode] = useState(() => previewBookCode());
  const [collections, setCollections] = useState([]);
  const { driveImageConfig } = useIntegrations();

  useEffect(() => {
    if (open) {
      pb.collection('book_collections').getFullList({ sort: 'title' })
        .then(setCollections)
        .catch(() => setCollections([]));
      if (editing) setForm(bookToForm(editing));
      // Duplicar: copia tudo menos os códigos únicos; o ID e as métricas são novos.
      else if (template) setForm({ ...bookToForm(template), title: `${template.title} (cópia)`, book_code: autoCode, sku: '' });
      else setForm({ ...emptyBookForm, book_code: autoCode });
    }
  }, [open, editing, template, autoCode]);

  if (!open) return null;

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      ...form,
      price: Number(form.price) || 0,
      stock: Number(form.stock) || 0,
      pages: Number(form.pages) || 0,
      year: Number(form.year) || new Date().getFullYear(),
      featured: !!form.featured,
      book_code: form.book_code || autoCode,
      sku: form.sku || form.book_code || autoCode,
      benefit_bullets: Array.isArray(form.benefit_bullets)
        ? form.benefit_bullets
        : (form.benefit_bullets || '').split('\n').map((s) => s.trim()).filter(Boolean),
      sample_pages: Array.isArray(form.sample_pages) ? form.sample_pages : [],
      versions: Array.isArray(form.versions) ? form.versions : [],
      preview_enabled: !!form.preview_enabled,
    });
  };

  const copyId = () => {
    const id = editing?.id || form.book_code || autoCode;
    navigator.clipboard.writeText(id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="bg-background rounded-2xl w-full max-w-4xl max-h-[92vh] overflow-hidden shadow-2xl border border-border flex flex-col"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-[#0ea5c9]/10 to-transparent">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-[#0ea5c9]/15 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-[#0ea5c9]" />
            </div>
            <div>
              <h2 className="text-xl font-bold">{editing ? 'Editar Livro' : template ? 'Duplicar Livro' : 'Adicionar Livro Premium'}</h2>
              <p className="text-sm text-muted-foreground">Catálogo profissional com ID e código único</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="h-5 w-5" /></Button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="grid lg:grid-cols-5 gap-0">
            {/* Preview lateral */}
            <div className="lg:col-span-2 bg-muted/30 p-6 border-b lg:border-b-0 lg:border-r border-border">
              <div className="sticky top-0 space-y-4">
                <div className="aspect-[3/4] rounded-xl overflow-hidden bg-muted border shadow-inner">
                  <img
                    src={form.cover || PLACEHOLDER_COVER}
                    alt="Preview"
                    className="w-full h-full object-cover"
                    onError={(e) => { e.target.src = PLACEHOLDER_COVER; }}
                  />
                </div>
                <div className="space-y-2">
                  <h3 className="font-bold text-lg line-clamp-2">{form.title || 'Título do livro'}</h3>
                  <p className="text-sm text-muted-foreground">{form.author || 'Autor'}</p>
                  {form.price && (
                    <p className="text-[#0ea5c9] font-bold text-xl">
                      Kz {Number(form.price).toLocaleString('pt-AO', { minimumFractionDigits: 2 })}
                    </p>
                  )}
                </div>

                <div className="rounded-xl bg-card border p-4 space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground flex items-center gap-1.5"><Hash className="h-3.5 w-3.5" /> Código</span>
                    <code className="font-mono text-[#0ea5c9] font-semibold">{form.book_code || autoCode}</code>
                  </div>
                  {editing && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">ID Sistema</span>
                      <button type="button" onClick={copyId} className="flex items-center gap-1 font-mono text-xs hover:text-[#0ea5c9]">
                        {editing.id.slice(0, 12)}…
                        {copied ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
                      </button>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground flex items-center gap-1.5"><Barcode className="h-3.5 w-3.5" /> SKU</span>
                    <code className="font-mono text-xs">{form.sku || form.book_code || autoCode}</code>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Stock</span>
                    <span className={Number(form.stock) <= 5 ? 'text-red-600 font-medium' : ''}>{form.stock || 0} un.</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Formulário */}
            <div className="lg:col-span-3 p-6">
              <Tabs defaultValue="info" className="w-full">
                <TabsList className="flex flex-wrap gap-1 mb-6 h-auto bg-muted p-1 rounded-lg w-full">
                  <TabsTrigger value="info" className="flex-1 min-w-[70px]"><BookOpen className="h-4 w-4 mr-1 hidden sm:inline" />Info</TabsTrigger>
                  <TabsTrigger value="codes" className="flex-1 min-w-[70px]"><Hash className="h-4 w-4 mr-1 hidden sm:inline" />Códigos</TabsTrigger>
                  <TabsTrigger value="marketing" className="flex-1 min-w-[70px]"><Megaphone className="h-4 w-4 mr-1 hidden sm:inline" />Marketing</TabsTrigger>
                  <TabsTrigger value="author" className="flex-1 min-w-[70px]"><User className="h-4 w-4 mr-1 hidden sm:inline" />Autor</TabsTrigger>
                  <TabsTrigger value="stats" className="flex-1 min-w-[70px]"><TrendingUp className="h-4 w-4 mr-1 hidden sm:inline" />Métricas</TabsTrigger>
                  <TabsTrigger value="preview" className="flex-1 min-w-[70px]"><BookMarked className="h-4 w-4 mr-1 hidden sm:inline" />Preview</TabsTrigger>
                  <TabsTrigger value="versions" className="flex-1 min-w-[70px]"><Layers className="h-4 w-4 mr-1 hidden sm:inline" />Versões</TabsTrigger>
                  <TabsTrigger value="media" className="flex-1 min-w-[70px]"><ImageIcon className="h-4 w-4 mr-1 hidden sm:inline" />Mídia</TabsTrigger>
                </TabsList>

                <TabsContent value="info" className="space-y-4 mt-0">
                  <div className="space-y-2">
                    <Label>Título *</Label>
                    <Input value={form.title} onChange={(e) => set('title', e.target.value)} required placeholder="Ex: Caminho a Cristo" />
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Autor</Label>
                      <Input value={form.author} onChange={(e) => set('author', e.target.value)} placeholder="Ex: Ellen G. White" />
                    </div>
                    <div className="space-y-2">
                      <Label>Género</Label>
                      <Select value={form.genre} onValueChange={(v) => set('genre', v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {BOOK_GENRES.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Editora</Label>
                      <Input value={form.publisher} onChange={(e) => set('publisher', e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Idioma</Label>
                      <Select value={form.language} onValueChange={(v) => set('language', v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {BOOK_LANGUAGES.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Preço (Kz) *</Label>
                      <Input type="number" min="0" step="0.01" value={form.price} onChange={(e) => set('price', e.target.value)} required />
                    </div>
                    <div className="space-y-2">
                      <Label>Stock *</Label>
                      <Input type="number" min="0" value={form.stock} onChange={(e) => set('stock', e.target.value)} required />
                    </div>
                    <div className="space-y-2">
                      <Label>Ano</Label>
                      <Input type="number" value={form.year} onChange={(e) => set('year', e.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Páginas</Label>
                    <Input type="number" min="0" value={form.pages} onChange={(e) => set('pages', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Descrição</Label>
                    <RichTextEditor value={form.description} onChange={(v) => set('description', v)} placeholder="Sinopse do livro..." />
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-[#0ea5c9]/5 border border-[#0ea5c9]/20">
                    <Switch checked={form.featured} onCheckedChange={(v) => set('featured', v)} />
                    <Label className="cursor-pointer">Destacar na homepage</Label>
                  </div>
                </TabsContent>

                <TabsContent value="codes" className="space-y-4 mt-0">
                  <div className="rounded-xl bg-muted/50 border p-4 text-sm text-muted-foreground mb-2">
                    Cada livro recebe um código único da Livraria Adventista. O ID do sistema é gerado automaticamente ao guardar.
                  </div>
                  <div className="space-y-2">
                    <Label>Código do Livro (LA-XXXXX)</Label>
                    <Input
                      value={form.book_code}
                      onChange={(e) => set('book_code', e.target.value.toUpperCase())}
                      placeholder={autoCode}
                      className="font-mono"
                    />
                    {!editing && (
                      <p className="text-xs text-muted-foreground">Deixe vazio para gerar automaticamente: <code className="text-[#0ea5c9]">{autoCode}</code></p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>SKU / Código de Barras</Label>
                    <Input value={form.sku} onChange={(e) => set('sku', e.target.value)} placeholder="Igual ao código ou ISBN" className="font-mono" />
                  </div>
                  <div className="space-y-2">
                    <Label>ISBN</Label>
                    <Input value={form.isbn} onChange={(e) => set('isbn', e.target.value)} placeholder="978-..." className="font-mono" />
                  </div>
                </TabsContent>

                <TabsContent value="marketing" className="space-y-4 mt-0">
                  <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900">
                    Campos de psicologia de vendas — aumentam conversão na página do produto e na loja.
                  </div>
                  <div className="space-y-2">
                    <Label>Coleção</Label>
                    <Select value={form.collection_id || '_none'} onValueChange={(v) => set('collection_id', v === '_none' ? '' : v)}>
                      <SelectTrigger><SelectValue placeholder="Sem coleção" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none">Sem coleção</SelectItem>
                        {collections.map((c) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Gancho de Marketing</Label>
                    <Input value={form.marketing_hook} onChange={(e) => set('marketing_hook', e.target.value)} placeholder="Ex: O livro que mudou milhões de vidas" />
                  </div>
                  <div className="space-y-2">
                    <Label>Prova Social</Label>
                    <Input value={form.social_proof} onChange={(e) => set('social_proof', e.target.value)} placeholder="Ex: Mais de 10.000 leitores em Angola" />
                  </div>
                  <div className="space-y-2">
                    <Label>Texto de Urgência</Label>
                    <Input value={form.urgency_text} onChange={(e) => set('urgency_text', e.target.value)} placeholder="Ex: Últimas 5 unidades em stock" />
                  </div>
                  <div className="space-y-2">
                    <Label>Público-Alvo</Label>
                    <Input value={form.target_audience} onChange={(e) => set('target_audience', e.target.value)} placeholder="Ex: Jovens, famílias, líderes de estudo bíblico" />
                  </div>
                  <div className="space-y-2">
                    <Label>Benefícios (um por linha)</Label>
                    <Textarea
                      rows={4}
                      value={Array.isArray(form.benefit_bullets) ? form.benefit_bullets.join('\n') : form.benefit_bullets}
                      onChange={(e) => set('benefit_bullets', e.target.value)}
                      placeholder="Fortalece a fé diária&#10;Ideal para estudo em família&#10;Edição premium com capa dura"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Palavras-chave SEO</Label>
                    <Input value={form.seo_keywords} onChange={(e) => set('seo_keywords', e.target.value)} placeholder="devocional, adventista, espiritualidade" />
                  </div>
                </TabsContent>

                <TabsContent value="author" className="space-y-4 mt-0">
                  <ImageField
                    label="Foto do Autor"
                    value={form.author_photo}
                    onChange={(v) => set('author_photo', v)}
                    aspect="1:1"
                    previewClassName="h-20 w-20"
                    driveConfig={driveImageConfig}
                  />
                  <div className="space-y-2">
                    <Label>Biografia do Autor</Label>
                    <RichTextEditor value={form.author_bio} onChange={(v) => set('author_bio', v)} placeholder="História, obra e legado do autor..." />
                  </div>
                </TabsContent>

                <TabsContent value="preview" className="space-y-4 mt-0">
                  <div className="flex items-center gap-3 p-3 rounded-lg border">
                    <Switch checked={form.preview_enabled} onCheckedChange={(v) => set('preview_enabled', v)} />
                    <Label>Permitir pré-visualização na loja</Label>
                  </div>
                  <div className="space-y-2">
                    <Label>Páginas Introdutórias (uma URL de imagem por linha)</Label>
                    <Textarea
                      rows={6}
                      value={(form.sample_pages || []).map((p) => (typeof p === 'string' ? p : p.url || '')).join('\n')}
                      onChange={(e) => set('sample_pages', e.target.value.split('\n').map((s) => s.trim()).filter(Boolean))}
                      placeholder="https://exemplo.com/pagina1.jpg&#10;https://exemplo.com/pagina2.jpg"
                      className="font-mono text-xs"
                    />
                    <p className="text-xs text-muted-foreground">Imagens das primeiras páginas para o leitor explorar antes de comprar.</p>
                  </div>
                </TabsContent>

                <TabsContent value="versions" className="space-y-4 mt-0">
                  <p className="text-sm text-muted-foreground">Defina edições alternativas (capa dura, pocket, ebook, etc.)</p>
                  {(form.versions || []).map((v, i) => (
                    <div key={i} className="p-3 rounded-xl border space-y-2 bg-muted/20">
                      <div className="grid sm:grid-cols-2 gap-2">
                        <Input placeholder="Nome da edição" value={v.label || ''} onChange={(e) => {
                          const versions = [...(form.versions || [])];
                          versions[i] = { ...versions[i], label: e.target.value };
                          set('versions', versions);
                        }} />
                        <Input placeholder="Formato (Capa dura, Pocket...)" value={v.format || ''} onChange={(e) => {
                          const versions = [...(form.versions || [])];
                          versions[i] = { ...versions[i], format: e.target.value };
                          set('versions', versions);
                        }} />
                      </div>
                      <div className="grid sm:grid-cols-3 gap-2">
                        <Input type="number" placeholder="Preço Kz" value={v.price ?? ''} onChange={(e) => {
                          const versions = [...(form.versions || [])];
                          versions[i] = { ...versions[i], price: e.target.value };
                          set('versions', versions);
                        }} />
                        <Input type="number" placeholder="Stock" value={v.stock ?? ''} onChange={(e) => {
                          const versions = [...(form.versions || [])];
                          versions[i] = { ...versions[i], stock: e.target.value };
                          set('versions', versions);
                        }} />
                        <Input placeholder="ISBN" value={v.isbn || ''} onChange={(e) => {
                          const versions = [...(form.versions || [])];
                          versions[i] = { ...versions[i], isbn: e.target.value };
                          set('versions', versions);
                        }} className="font-mono text-sm" />
                      </div>
                      <Button type="button" variant="ghost" size="sm" className="text-destructive h-7" onClick={() => {
                        set('versions', (form.versions || []).filter((_, j) => j !== i));
                      }}>Remover edição</Button>
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" onClick={() => set('versions', [...(form.versions || []), { label: '', format: '', price: '', stock: '', isbn: '' }])}>
                    + Adicionar Versão / Edição
                  </Button>
                </TabsContent>

                <TabsContent value="media" className="space-y-4 mt-0">
                  <ImageField
                    label="Capa do Livro"
                    value={form.cover}
                    onChange={(v) => set('cover', v)}
                    aspect="3:4"
                    hint="Capa: 400×600px ou superior · URL, upload ou Google Drive"
                    previewClassName="h-32 w-24"
                    driveConfig={driveImageConfig}
                  />
                </TabsContent>

                <TabsContent value="stats" className="space-y-4 mt-0">
                  <div className="rounded-xl bg-gradient-to-r from-[#0ea5c9]/10 to-[#0ea5c9]/5 border border-[#0ea5c9]/20 p-4 text-sm text-foreground">
                    <h4 className="font-semibold text-[#0ea5c9] mb-1">Métricas reais</h4>
                    <p className="text-muted-foreground">Contadas automaticamente: vendas quando uma encomenda é registada e visualizações quando alguém abre a página do livro.</p>
                  </div>
                  {editing ? (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="rounded-xl border p-4">
                        <p className="text-xs text-muted-foreground">Unidades vendidas</p>
                        <p className="text-2xl font-bold">{Number(editing.sales_count) || 0}</p>
                      </div>
                      <div className="rounded-xl border p-4">
                        <p className="text-xs text-muted-foreground">Visualizações</p>
                        <p className="text-2xl font-bold">{Number(editing.views_count) || 0}</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">As métricas aparecem depois de publicar o livro.</p>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          </div>

          <div className="sticky bottom-0 flex gap-3 px-6 py-4 border-t bg-background/95 backdrop-blur">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
            <Button type="submit" className="flex-1 btn-primary py-6 text-base" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editing ? 'Guardar Alterações' : 'Publicar Livro'}
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
