import React, { useState, useEffect, useCallback } from 'react';
import { Loader2, Save, Palette, Smartphone, Truck, MessageSquare, LayoutTemplate, Store, Mail, Bell, Sparkles, RotateCcw, Image as ImageIcon, Phone, Brush, ShieldCheck } from 'lucide-react';
import pb from '@/lib/dataClient';
import { useToast } from '@/hooks/use-toast';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { useIntegrations } from '@/hooks/useIntegrations';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ImageField, { uploadImageToRecord, removeImageFromRecord, syncUploadedImageUrl } from '@/components/admin/ImageField';
import { sanitizeImageUrlForSave } from '@/lib/imageUrl';
import { pbErrorMessage } from '@/lib/mediaSave';
import { isUploadPending } from '@/lib/mediaUpload';
import PhoneInput from '@/components/PhoneInput';
import { formatAngolaPhone } from '@/lib/angolaPhone';

const empty = {
  site_name: 'Livraria Adventista',
  tagline: '',
  primary_color: '#0ea5c9',
  logo_url: '',
  favicon_url: '',
  login_bg_url: '',
  about_top_image_url: '',
  about_side_image_url: '',
  about_team: [],
  contact_email: '',
  contact_phone: '',
  contact_address: '',
  whatsapp: '',
  facebook: '',
  instagram: '',
  pwa_enabled: true,
  pwa_name: '',
  pwa_short_name: 'LA',
  pwa_theme_color: '#0c4a6e',
  shipping_free_threshold: 20000,
  shipping_cost: 1500,
  maintenance_mode: false,
  google_oauth_enabled: false,
  header_welcome_logged: 'Bem-vindo de volta, {nome}',
  header_welcome_guest: 'Envio em todo o país · Crie a sua conta para acompanhar encomendas',
  header_cta_text: 'Explorar novidades',
  header_cta_link: '/shop',
  footer_tagline: '',
  footer_copyright: '',
  footer_columns: null,
  show_stores_in_footer: true,
  shop_hero_title: 'Todos os Livros',
  shop_hero_subtitle: 'O catálogo completo da livraria — pesquisa avançada, pré-visualização e compra segura.',
  shop_hero_badge: 'Catálogo Premium',
  shop_default_sort: 'featured',
  shop_per_page: 24,
  shop_show_featured: true,
  shop_show_collections: true,
  shop_show_low_stock: true,
  shop_grid_columns: 4,
  shipping_express_cost: 3000,
  order_number_prefix: 'ENC-',
  checkout_notes_max: 2000,
  checkout_rate_per_minute: 15,
  track_rate_per_minute: 20,
  receipt_per_order_per_minute: 3,
  low_stock_threshold: 5,
  book_code_prefix: 'LIV-',
  ui_glass_enabled: true,
  ui_glass_opacity: 0.72,
  shop_bg_mode: 'gradient',
  shop_bg_image_url: '',
  shop_bg_video_url: '',
  shop_bg_overlay: 0.55,
  google_maps_embed_key: '',
  order_email_enabled: false,
  email_provider: 'smtp',
  sendgrid_api_key: '',
  smtp_from_email: '',
  smtp_from_name: '',
  smtp_host: '',
  smtp_port: 587,
  smtp_user: '',
  smtp_password: '',
  push_enabled: false,
  vapid_public_key: '',
  vapid_private_key: '',
  chat_enabled: true,
  chat_provider: 'gemini',
  gemini_api_key: '',
  deepseek_api_key: '',
  chat_model: '',
  chat_welcome: '',
};

const clampInt = (value, min, max, fallback) => {
  const n = Math.round(Number(value));
  return Number.isFinite(n) ? Math.min(Math.max(n, min), max) : fallback;
};

const SETTINGS_SECTIONS = [
  { label: 'Identidade', items: [
    { value: 'brand', label: 'Marca', icon: Palette },
    { value: 'images', label: 'Imagens', icon: ImageIcon },
    { value: 'theme', label: 'Tema visual', icon: Brush },
  ] },
  { label: 'Loja', items: [
    { value: 'shop', label: 'Catálogo e loja', icon: Store },
    { value: 'shipping', label: 'Envio', icon: Truck },
    { value: 'rules', label: 'Regras da loja', icon: ShieldCheck },
  ] },
  { label: 'Comunicação', items: [
    { value: 'contact', label: 'Contacto', icon: Phone },
    { value: 'messaging', label: 'Email, push e chat', icon: Mail },
    { value: 'header', label: 'Barra superior', icon: MessageSquare },
    { value: 'footer', label: 'Rodapé', icon: LayoutTemplate },
  ] },
  { label: 'Aplicação', items: [
    { value: 'pwa', label: 'PWA / telemóvel', icon: Smartphone },
  ] },
];

export default function SettingsTab() {
  const { toast } = useToast();
  const { refresh } = useSiteSettings();
  const { driveImageConfig } = useIntegrations();
  const [recordId, setRecordId] = useState(null);
  const [form, setForm] = useState(empty);
  const [logoFile, setLogoFile] = useState(null);
  const [faviconFile, setFaviconFile] = useState(null);
  const [logoRemoved, setLogoRemoved] = useState(false);
  const [faviconRemoved, setFaviconRemoved] = useState(false);
  const [hadLogoFile, setHadLogoFile] = useState(false);
  const [hadFaviconFile, setHadFaviconFile] = useState(false);
  // As imagens da página Sobre dependem da migração `imagens_sobre`. Enquanto as colunas não
  // existirem, os campos não aparecem e não são gravados: enviá-los faria o PostgREST
  // recusar o registo inteiro e partir o gravar das Configurações.
  const [hasAboutImages, setHasAboutImages] = useState(false);
  const [hasAboutTeam, setHasAboutTeam] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await pb.collection('site_settings').getFullList();
      if (list.length > 0) {
        const r = list[0];
        setRecordId(r.id);
        setHasAboutImages('about_top_image_url' in r);
        setHasAboutTeam('about_team' in r);
        setHadLogoFile(!!r.logo);
        setHadFaviconFile(!!r.favicon);
        setLogoRemoved(false);
        setFaviconRemoved(false);
        setLogoFile(null);
        setFaviconFile(null);
        const logoFromFile = r.logo ? pb.files.getURL(r, r.logo) : '';
        const favFromFile = r.favicon ? pb.files.getURL(r, r.favicon) : '';
        setForm({
          site_name: r.site_name || empty.site_name,
          tagline: r.tagline || '',
          primary_color: r.primary_color || '#0ea5c9',
          logo_url: logoFromFile || sanitizeImageUrlForSave(r.logo_url) || '',
          favicon_url: favFromFile || sanitizeImageUrlForSave(r.favicon_url) || '',
          login_bg_url: r.login_bg_url || '',
          about_top_image_url: r.about_top_image_url || '',
          about_side_image_url: r.about_side_image_url || '',
          about_team: Array.isArray(r.about_team) ? r.about_team : [],
          contact_email: r.contact_email || '',
          contact_phone: r.contact_phone ? formatAngolaPhone(r.contact_phone) : '',
          contact_address: r.contact_address || '',
          whatsapp: r.whatsapp ? formatAngolaPhone(r.whatsapp) : '',
          facebook: r.facebook || '',
          instagram: r.instagram || '',
          pwa_enabled: !!r.pwa_enabled,
          pwa_name: r.pwa_name || '',
          pwa_short_name: r.pwa_short_name || 'LA',
          pwa_theme_color: r.pwa_theme_color || '#0c4a6e',
          shipping_free_threshold: r.shipping_free_threshold ?? 20000,
          shipping_cost: r.shipping_cost ?? 1500,
          maintenance_mode: !!r.maintenance_mode,
          google_oauth_enabled: !!r.google_oauth_enabled,
          header_welcome_logged: r.header_welcome_logged || empty.header_welcome_logged,
          header_welcome_guest: r.header_welcome_guest || empty.header_welcome_guest,
          header_cta_text: r.header_cta_text || empty.header_cta_text,
          header_cta_link: r.header_cta_link || empty.header_cta_link,
          footer_tagline: r.footer_tagline || '',
          footer_copyright: r.footer_copyright || '',
          footer_columns: r.footer_columns || null,
          show_stores_in_footer: r.show_stores_in_footer !== false,
          shop_hero_title: r.shop_hero_title || empty.shop_hero_title,
          shop_hero_subtitle: r.shop_hero_subtitle || empty.shop_hero_subtitle,
          shop_hero_badge: r.shop_hero_badge || empty.shop_hero_badge,
          shop_default_sort: r.shop_default_sort || empty.shop_default_sort,
          shop_per_page: r.shop_per_page ?? empty.shop_per_page,
          shop_show_featured: r.shop_show_featured !== false,
          shop_show_collections: r.shop_show_collections !== false,
          shop_show_low_stock: r.shop_show_low_stock !== false,
          shop_grid_columns: r.shop_grid_columns ?? empty.shop_grid_columns,
          shipping_express_cost: r.shipping_express_cost ?? empty.shipping_express_cost,
          order_number_prefix: r.order_number_prefix ?? empty.order_number_prefix,
          checkout_notes_max: r.checkout_notes_max ?? empty.checkout_notes_max,
          checkout_rate_per_minute: r.checkout_rate_per_minute ?? empty.checkout_rate_per_minute,
          track_rate_per_minute: r.track_rate_per_minute ?? empty.track_rate_per_minute,
          receipt_per_order_per_minute: r.receipt_per_order_per_minute ?? empty.receipt_per_order_per_minute,
          low_stock_threshold: r.low_stock_threshold ?? empty.low_stock_threshold,
          book_code_prefix: r.book_code_prefix ?? empty.book_code_prefix,
          ui_glass_enabled: r.ui_glass_enabled !== false,
          ui_glass_opacity: r.ui_glass_opacity ?? empty.ui_glass_opacity,
          shop_bg_mode: r.shop_bg_mode || empty.shop_bg_mode,
          shop_bg_image_url: r.shop_bg_image_url || '',
          shop_bg_video_url: r.shop_bg_video_url || '',
          shop_bg_overlay: r.shop_bg_overlay ?? empty.shop_bg_overlay,
          google_maps_embed_key: r.google_maps_embed_key || '',
          order_email_enabled: !!r.order_email_enabled,
          email_provider: !r.email_provider || r.email_provider === 'pocketbase' ? 'smtp' : r.email_provider,
          sendgrid_api_key: r.sendgrid_api_key || '',
          smtp_from_email: r.smtp_from_email || '',
          smtp_from_name: r.smtp_from_name || '',
          smtp_host: r.smtp_host || '',
          smtp_port: r.smtp_port ?? 587,
          smtp_user: r.smtp_user || '',
          smtp_password: r.smtp_password || '',
          push_enabled: !!r.push_enabled,
          vapid_public_key: r.vapid_public_key || '',
          vapid_private_key: r.vapid_private_key || '',
          chat_enabled: r.chat_enabled !== false,
          chat_provider: r.chat_provider || 'gemini',
          gemini_api_key: r.gemini_api_key || '',
          deepseek_api_key: r.deepseek_api_key || '',
          chat_model: r.chat_model || '',
          chat_welcome: r.chat_welcome || '',
        });
      }
    } catch {
      // coleção ainda não migrada
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // Equipa da página Sobre
  const teamSet = (index, key, value) => setForm((f) => {
    const team = [...(f.about_team || [])];
    team[index] = { ...team[index], [key]: value };
    return { ...f, about_team: team };
  });
  const teamAdd = () => setForm((f) => ({ ...f, about_team: [...(f.about_team || []), { name: '', role: '', photo_url: '' }] }));
  const teamRemove = (index) => setForm((f) => ({ ...f, about_team: (f.about_team || []).filter((_, i) => i !== index) }));
  const teamMove = (index, dir) => setForm((f) => {
    const team = [...(f.about_team || [])];
    const j = index + dir;
    if (j < 0 || j >= team.length) return f;
    [team[index], team[j]] = [team[j], team[index]];
    return { ...f, about_team: team };
  });

  // Alterações por gravar: compara com o estado carregado do servidor.
  const [baseline, setBaseline] = useState('');
  useEffect(() => {
    if (!loading) setBaseline(JSON.stringify(form));
  }, [loading]); // eslint-disable-line react-hooks/exhaustive-deps
  const dirty = !loading && (baseline !== JSON.stringify(form) || !!logoFile || !!faviconFile || logoRemoved || faviconRemoved);
  const discard = () => {
    setLogoFile(null);
    setFaviconFile(null);
    load();
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (isUploadPending(form.login_bg_url, form.shop_bg_image_url, form.about_top_image_url, form.about_side_image_url)) {
      toast({ title: 'A enviar imagem…', description: 'Aguarde que o envio termine e guarde de novo.' });
      return;
    }
    setSaving(true);
    try {
      const data = {
        ...form,
        logo_url: form.logo_url?.startsWith('blob:') ? '' : sanitizeImageUrlForSave(form.logo_url),
        favicon_url: form.favicon_url?.startsWith('blob:') ? '' : sanitizeImageUrlForSave(form.favicon_url),
        login_bg_url: sanitizeImageUrlForSave(form.login_bg_url),
        ...(hasAboutImages ? {
          about_top_image_url: sanitizeImageUrlForSave(form.about_top_image_url),
          about_side_image_url: sanitizeImageUrlForSave(form.about_side_image_url),
        } : {}),
        ...(hasAboutTeam ? {
          // Sem nome não é ninguém: essas linhas não são gravadas.
          about_team: (form.about_team || [])
            .map((m) => ({
              name: (m.name || '').trim().slice(0, 120),
              role: (m.role || '').trim().slice(0, 120),
              photo_url: sanitizeImageUrlForSave(m.photo_url || ''),
            }))
            .filter((m) => m.name),
        } : {}),
        shop_bg_image_url: sanitizeImageUrlForSave(form.shop_bg_image_url),
        shipping_free_threshold: Number(form.shipping_free_threshold),
        shipping_cost: Number(form.shipping_cost),
        shipping_express_cost: Number(form.shipping_express_cost),
        // Regras da loja: os mesmos limites que a base de dados aceita.
        order_number_prefix: String(form.order_number_prefix || '').toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 8),
        checkout_notes_max: clampInt(form.checkout_notes_max, 0, 5000, 2000),
        checkout_rate_per_minute: clampInt(form.checkout_rate_per_minute, 1, 60, 15),
        track_rate_per_minute: clampInt(form.track_rate_per_minute, 1, 120, 20),
        receipt_per_order_per_minute: clampInt(form.receipt_per_order_per_minute, 1, 10, 3),
        low_stock_threshold: clampInt(form.low_stock_threshold, 0, 1000, 5),
        book_code_prefix: String(form.book_code_prefix || '').toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 8) || 'LIV-',
        shop_per_page: Number(form.shop_per_page) || 24,
        shop_grid_columns: Number(form.shop_grid_columns) || 4,
        ui_glass_opacity: Number(form.ui_glass_opacity) || 0.72,
        // 0 é válido (sem escurecimento); só o campo vazio volta ao valor por omissão.
        shop_bg_overlay: form.shop_bg_overlay === '' || Number.isNaN(Number(form.shop_bg_overlay)) ? 0.55 : Number(form.shop_bg_overlay),
        smtp_port: Number(form.smtp_port) || 587,
        shop_bg_mode: form.shop_bg_mode || 'gradient',
        primary_color: form.primary_color || '#0ea5c9',
        pwa_theme_color: form.pwa_theme_color || '#0c4a6e',
        footer_columns: typeof form.footer_columns === 'string'
          ? (() => { try { return JSON.parse(form.footer_columns); } catch { return null; } })()
          : form.footer_columns,
      };

      let id = recordId;
      if (logoRemoved && id) {
        await removeImageFromRecord('site_settings', id, 'logo', 'logo_url');
        data.logo_url = '';
      }
      if (faviconRemoved && id) {
        await removeImageFromRecord('site_settings', id, 'favicon', 'favicon_url');
        data.favicon_url = '';
      }

      if (id) {
        await pb.collection('site_settings').update(id, data);
      } else {
        const created = await pb.collection('site_settings').create(data);
        id = created.id;
        setRecordId(id);
      }

      if (logoFile && id) {
        await uploadImageToRecord('site_settings', id, 'logo', logoFile);
        await syncUploadedImageUrl('site_settings', id, 'logo', 'logo_url');
      } else if (data.logo_url && !logoRemoved && hadLogoFile && !logoFile) {
        await removeImageFromRecord('site_settings', id, 'logo');
      }

      if (faviconFile && id) {
        await uploadImageToRecord('site_settings', id, 'favicon', faviconFile);
        await syncUploadedImageUrl('site_settings', id, 'favicon', 'favicon_url');
      } else if (data.favicon_url && !faviconRemoved && hadFaviconFile && !faviconFile) {
        await removeImageFromRecord('site_settings', id, 'favicon');
      }

      setLogoFile(null);
      setFaviconFile(null);
      setLogoRemoved(false);
      setFaviconRemoved(false);

      await refresh();
      toast({ title: 'Configurações guardadas' });
      load();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erro', description: pbErrorMessage(err) });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-[#0ea5c9]" /></div>;
  }

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <Tabs defaultValue="brand" orientation="vertical" className="grid lg:grid-cols-[220px_minmax(0,1fr)] gap-6 items-start">
        <aside className="lg:sticky lg:top-24 rounded-xl border border-border bg-background p-2 space-y-3">
          {SETTINGS_SECTIONS.map((group) => (
            <div key={group.label}>
              <p className="px-2 pt-1 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{group.label}</p>
              <TabsList className="flex flex-row flex-wrap lg:flex-col lg:items-stretch h-auto w-full gap-0.5 bg-transparent p-0">
                {group.items.map(({ value, label, icon: Icon }) => (
                  <TabsTrigger
                    key={value}
                    value={value}
                    className="justify-start gap-2 px-2.5 py-2 data-[state=active]:bg-[#0ea5c9]/10 data-[state=active]:text-[#0ea5c9] data-[state=active]:shadow-none"
                  >
                    <Icon className="h-4 w-4" />{label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
          ))}
        </aside>
        <div className="min-w-0 rounded-xl border border-border bg-background p-5 md:p-6">

        <TabsContent value="brand" className="space-y-4 max-w-xl">
          <div className="space-y-2">
            <Label>Nome do Sistema *</Label>
            <Input value={form.site_name} onChange={(e) => set('site_name', e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>Slogan / Tagline</Label>
            <Input value={form.tagline} onChange={(e) => set('tagline', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Cor Principal</Label>
            <div className="flex gap-2">
              <Input type="color" value={form.primary_color} onChange={(e) => set('primary_color', e.target.value)} className="w-14 h-10 p-1" />
              <Input value={form.primary_color} onChange={(e) => set('primary_color', e.target.value)} className="font-mono" />
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-lg border">
            <Switch checked={form.maintenance_mode} onCheckedChange={(v) => set('maintenance_mode', v)} />
            <Label>Modo manutenção (bloqueia checkout)</Label>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-lg border">
            <Switch checked={form.google_oauth_enabled} onCheckedChange={(v) => set('google_oauth_enabled', v)} />
            <div>
              <Label>Login com Google</Label>
              <p className="text-xs text-muted-foreground">Feito pelo Firebase Authentication (adicione o domínio do site em Authorized domains)</p>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="images" className="space-y-6 max-w-2xl">
          <ImageField
            label="Logotipo"
            value={form.logo_url}
            onChange={(v) => { set('logo_url', v); setLogoRemoved(false); }}
            onFileChange={(f) => { setLogoFile(f); if (f) setLogoRemoved(false); }}
            onClear={() => setLogoRemoved(true)}
            aspect="quadrado ou horizontal"
            hint="Logotipo: PNG/SVG com fundo transparente · 200×200px mínimo · Aparece em todo o site (header, login, admin, rodapé)"
            previewClassName="h-20 w-40"
            driveConfig={driveImageConfig}
          />
          <ImageField
            label="Favicon"
            value={form.favicon_url}
            onChange={(v) => { set('favicon_url', v); setFaviconRemoved(false); }}
            onFileChange={(f) => { setFaviconFile(f); if (f) setFaviconRemoved(false); }}
            onClear={() => setFaviconRemoved(true)}
            aspect="1:1"
            maxSizeMB={0.5}
            hint="Favicon: PNG ou ICO · 32×32 ou 64×64px · Ícone do separador do browser e PWA"
            previewClassName="h-12 w-12"
            driveConfig={driveImageConfig}
          />
          <ImageField
            label="Imagem de fundo do Login"
            gallery="login"
            value={form.login_bg_url}
            onChange={(v) => set('login_bg_url', v)}
            aspect="16:9"
            hint="Fundo login: JPG/WebP · 1920×1080px recomendado"
            previewClassName="h-24 w-40"
            driveConfig={driveImageConfig}
            uploadFolder="site_settings"
          />
          {hasAboutImages && (
          <>
          <ImageField
            label="Página Sobre — imagem do topo"
            gallery="sobre-topo"
            value={form.about_top_image_url}
            onChange={(v) => set('about_top_image_url', v)}
            aspect="16:9"
            hint="Topo da página Sobre · 1920×1000px recomendado · vazio = a imagem que vem com o site"
            previewClassName="h-24 w-40"
            driveConfig={driveImageConfig}
            uploadFolder="site_settings"
          />
          <ImageField
            label="Página Sobre — imagem lateral"
            gallery="sobre-lateral"
            value={form.about_side_image_url}
            onChange={(v) => set('about_side_image_url', v)}
            aspect="4:3"
            hint="Lateral da página Sobre · 1200×1000px recomendado · vazio = a imagem que vem com o site"
            previewClassName="h-24 w-32"
            driveConfig={driveImageConfig}
            uploadFolder="site_settings"
          />
          </>
          )}

          {hasAboutTeam && (
            <div className="space-y-3 rounded-xl border p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <Label className="text-base">Equipa na página Sobre</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Nome, função e fotografia de cada pessoa. Sem ninguém na lista, a secção não
                    aparece no site. Linhas sem nome não são gravadas.
                  </p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={teamAdd}>Acrescentar</Button>
              </div>

              {(form.about_team || []).length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">Ainda não há ninguém na lista.</p>
              ) : (
                <div className="space-y-4">
                  {(form.about_team || []).map((member, i) => (
                    <div key={i} className="grid gap-3 sm:grid-cols-[auto,1fr] items-start border-t pt-4 first:border-t-0 first:pt-0">
                      <div className="w-32">
                        <ImageField
                          label="Fotografia"
                          value={member.photo_url || ''}
                          onChange={(v) => teamSet(i, 'photo_url', v)}
                          aspect="1:1"
                          previewClassName="h-20 w-20 rounded-full"
                          showDrive={false}
                          driveConfig={driveImageConfig}
                          uploadFolder="site_settings"
                        />
                      </div>
                      <div className="space-y-2">
                        <div className="grid gap-2 sm:grid-cols-2">
                          <div className="space-y-1">
                            <Label className="text-xs">Nome</Label>
                            <Input
                              value={member.name || ''}
                              onChange={(e) => teamSet(i, 'name', e.target.value)}
                              maxLength={120}
                              placeholder="Nome da pessoa"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Função</Label>
                            <Input
                              value={member.role || ''}
                              onChange={(e) => teamSet(i, 'role', e.target.value)}
                              maxLength={120}
                              placeholder="Ex.: Atendimento ao cliente"
                            />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button type="button" variant="ghost" size="sm" onClick={() => teamMove(i, -1)} disabled={i === 0}>Subir</Button>
                          <Button type="button" variant="ghost" size="sm" onClick={() => teamMove(i, 1)} disabled={i === (form.about_team || []).length - 1}>Descer</Button>
                          <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => teamRemove(i)}>Remover</Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="contact" className="space-y-4 max-w-xl">
          <div className="space-y-2"><Label>Email</Label><Input type="email" value={form.contact_email} onChange={(e) => set('contact_email', e.target.value)} /></div>
          <div className="space-y-2"><Label>Telefone</Label><PhoneInput value={form.contact_phone} onChange={(v) => set('contact_phone', v)} /></div>
          <div className="space-y-2"><Label>Morada</Label><Input value={form.contact_address} onChange={(e) => set('contact_address', e.target.value)} /></div>
          <div className="space-y-2"><Label>WhatsApp</Label><PhoneInput value={form.whatsapp} onChange={(v) => set('whatsapp', v)} /></div>
          <div className="space-y-2"><Label>Facebook URL</Label><Input value={form.facebook} onChange={(e) => set('facebook', e.target.value)} /></div>
          <div className="space-y-2"><Label>Instagram URL</Label><Input value={form.instagram} onChange={(e) => set('instagram', e.target.value)} /></div>
        </TabsContent>

        <TabsContent value="pwa" className="space-y-4 max-w-xl">
          <div className="flex items-center gap-3 p-3 rounded-lg border">
            <Switch checked={form.pwa_enabled} onCheckedChange={(v) => set('pwa_enabled', v)} />
            <Label>Permitir instalação como app (PWA)</Label>
          </div>
          <div className="space-y-2"><Label>Nome da App</Label><Input value={form.pwa_name} onChange={(e) => set('pwa_name', e.target.value)} placeholder={form.site_name} /></div>
          <div className="space-y-2"><Label>Nome Curto (ícone)</Label><Input value={form.pwa_short_name} onChange={(e) => set('pwa_short_name', e.target.value)} maxLength={12} /></div>
          <div className="space-y-2">
            <Label>Cor do Tema Mobile</Label>
            <div className="flex gap-2">
              <Input type="color" value={form.pwa_theme_color} onChange={(e) => set('pwa_theme_color', e.target.value)} className="w-14 h-10 p-1" />
              <Input value={form.pwa_theme_color} onChange={(e) => set('pwa_theme_color', e.target.value)} className="font-mono" />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="messaging" className="space-y-6 max-w-xl">
          <div>
            <h3 className="font-semibold flex items-center gap-2"><Mail className="h-4 w-4 text-[#0ea5c9]" /> Email de confirmação de encomenda</h3>
            <p className="text-xs text-muted-foreground mt-1">Enviado automaticamente após checkout (SendGrid ou SMTP).</p>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-lg border">
            <Switch checked={form.order_email_enabled} onCheckedChange={(v) => set('order_email_enabled', v)} />
            <Label>Activar email automático de confirmação</Label>
          </div>
          <div className="space-y-2">
            <Label>Provedor de email</Label>
            <Select value={form.email_provider || 'smtp'} onValueChange={(v) => set('email_provider', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="sendgrid">SendGrid API</SelectItem>
                <SelectItem value="smtp">SMTP personalizado (Hostinger, Brevo, etc.)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {form.email_provider === 'smtp' && (
            <div className="space-y-3 p-3 rounded-lg border bg-muted/20">
              <p className="text-xs text-muted-foreground">Credenciais SMTP do seu provedor (ex.: smtp.hostinger.com, smtp-relay.brevo.com). Use a porta 465 (SSL): o Supabase bloqueia as portas 25 e 587.</p>
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Servidor SMTP</Label>
                  <Input value={form.smtp_host} onChange={(e) => set('smtp_host', e.target.value)} placeholder="smtp.hostinger.com" />
                </div>
                <div className="space-y-2">
                  <Label>Porta</Label>
                  <Input type="number" value={form.smtp_port} onChange={(e) => set('smtp_port', e.target.value)} placeholder="587" />
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Utilizador SMTP</Label>
                  <Input value={form.smtp_user} onChange={(e) => set('smtp_user', e.target.value)} placeholder="noreply@dominio.ao" />
                </div>
                <div className="space-y-2">
                  <Label>Password SMTP</Label>
                  <Input type="password" value={form.smtp_password} onChange={(e) => set('smtp_password', e.target.value)} />
                </div>
              </div>
            </div>
          )}
          {form.email_provider === 'sendgrid' && (
            <div className="space-y-2">
              <Label>SendGrid API Key</Label>
              <Input type="password" value={form.sendgrid_api_key} onChange={(e) => set('sendgrid_api_key', e.target.value)} placeholder="SG...." className="font-mono text-sm" />
            </div>
          )}
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Email remetente</Label>
              <Input type="email" value={form.smtp_from_email} onChange={(e) => set('smtp_from_email', e.target.value)} placeholder="noreply@livraria.ao" />
            </div>
            <div className="space-y-2">
              <Label>Nome remetente</Label>
              <Input value={form.smtp_from_name} onChange={(e) => set('smtp_from_name', e.target.value)} placeholder="Livraria Adventista" />
            </div>
          </div>

          <div className="border-t pt-6">
            <h3 className="font-semibold flex items-center gap-2"><Bell className="h-4 w-4 text-[#0ea5c9]" /> Notificações Push (PWA)</h3>
            <p className="text-xs text-muted-foreground mt-1">Gere chaves VAPID em <a href="https://vapidkeys.com" target="_blank" rel="noreferrer" className="text-[#0ea5c9] underline">vapidkeys.com</a></p>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-lg border">
            <Switch checked={form.push_enabled} onCheckedChange={(v) => set('push_enabled', v)} />
            <Label>Activar notificações push na PWA</Label>
          </div>
          <div className="space-y-2">
            <Label>Chave pública VAPID</Label>
            <Input value={form.vapid_public_key} onChange={(e) => set('vapid_public_key', e.target.value)} className="font-mono text-xs" />
          </div>
          <div className="space-y-2">
            <Label>Chave privada VAPID (servidor)</Label>
            <Input type="password" value={form.vapid_private_key} onChange={(e) => set('vapid_private_key', e.target.value)} className="font-mono text-xs" />
          </div>

          <div className="border-t pt-6">
            <h3 className="font-semibold flex items-center gap-2"><Sparkles className="h-4 w-4 text-[#0ea5c9]" /> Assistente IA (chat)</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Widget de ajuda fixo no site com sugestões, catálogo e links. Recomendado: <strong>Gemini Flash Lite</strong> (mais barato). Fallback automático para FAQ sem chave.
            </p>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-lg border">
            <Switch checked={form.chat_enabled} onCheckedChange={(v) => set('chat_enabled', v)} />
            <Label>Mostrar assistente no site</Label>
          </div>
          <div className="space-y-2">
            <Label>Provedor de IA</Label>
            <Select value={form.chat_provider || 'gemini'} onValueChange={(v) => set('chat_provider', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="gemini">Google Gemini (recomendado — mais barato)</SelectItem>
                <SelectItem value="deepseek">DeepSeek</SelectItem>
                <SelectItem value="faq">Apenas FAQ local (sem IA)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {form.chat_provider !== 'faq' && (
            <>
              <div className="space-y-2">
                <Label>Chave API Gemini</Label>
                <Input type="password" value={form.gemini_api_key} onChange={(e) => set('gemini_api_key', e.target.value)} placeholder="AIza… ou variável GEMINI_API_KEY" className="font-mono text-xs" />
              </div>
              <div className="space-y-2">
                <Label>Chave API DeepSeek (opcional)</Label>
                <Input type="password" value={form.deepseek_api_key} onChange={(e) => set('deepseek_api_key', e.target.value)} placeholder="sk-… ou variável DEEPSEEK_API_KEY" className="font-mono text-xs" />
              </div>
              <div className="space-y-2">
                <Label>Modelo (opcional)</Label>
                <Input value={form.chat_model} onChange={(e) => set('chat_model', e.target.value)} placeholder="gemini-2.0-flash-lite ou deepseek-chat" className="font-mono text-xs" />
              </div>
            </>
          )}
          <div className="space-y-2">
            <Label>Mensagem de boas-vindas</Label>
            <Textarea rows={2} value={form.chat_welcome} onChange={(e) => set('chat_welcome', e.target.value)} placeholder="Olá! Sou o assistente da livraria…" />
          </div>
        </TabsContent>

        <TabsContent value="shipping" className="space-y-4 max-w-xl">
          <div className="space-y-2">
            <Label>Envio grátis acima de (Kz)</Label>
            <Input type="number" value={form.shipping_free_threshold} onChange={(e) => set('shipping_free_threshold', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Custo de envio padrão (Kz)</Label>
            <Input type="number" value={form.shipping_cost} onChange={(e) => set('shipping_cost', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Custo de envio expresso (Kz)</Label>
            <Input type="number" value={form.shipping_express_cost} onChange={(e) => set('shipping_express_cost', e.target.value)} />
          </div>
        </TabsContent>

        <TabsContent value="rules" className="space-y-5 max-w-xl">
          <p className="text-sm text-muted-foreground">
            Regras aplicadas pelo servidor em cada encomenda. Os métodos de pagamento aceites são os que estiverem activos em <strong>Vendas → Pagamentos</strong>.
          </p>
          <div className="space-y-2">
            <Label>Prefixo do número de encomenda</Label>
            <Input
              value={form.order_number_prefix}
              onChange={(e) => set('order_number_prefix', e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 8))}
              placeholder="ENC-"
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              Até 8 caracteres (letras, números e hífen). Exemplo de número: <span className="font-mono">{form.order_number_prefix || ''}K3F9QA7XP</span>. Só afecta as encomendas novas.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Stock baixo: até quantas unidades</Label>
              <Input type="number" min={0} max={1000} value={form.low_stock_threshold} onChange={(e) => set('low_stock_threshold', e.target.value)} />
              <p className="text-xs text-muted-foreground">
                Livros com {Number(form.low_stock_threshold) || 0} ou menos unidades ficam marcados como "Últimas unidades" e aparecem no alerta do painel. Ao guardar, todos os livros são recalculados.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Prefixo do código de livro (SKU)</Label>
              <Input
                value={form.book_code_prefix}
                onChange={(e) => set('book_code_prefix', e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 8))}
                placeholder="LIV-"
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Usado quando um livro é criado sem código: <span className="font-mono">{form.book_code_prefix || 'LIV-'}101</span>, <span className="font-mono">{form.book_code_prefix || 'LIV-'}102</span>… Os códigos não se podem repetir.
              </p>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Máximo de caracteres nas notas da encomenda</Label>
            <Input type="number" min={0} max={5000} value={form.checkout_notes_max} onChange={(e) => set('checkout_notes_max', e.target.value)} />
            <p className="text-xs text-muted-foreground">0 a 5000. Com 0, as notas do cliente não são guardadas.</p>
          </div>
          <div className="rounded-lg border p-4 space-y-4 bg-muted/20">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Protecção contra abusos (por minuto)</p>
            <div className="grid sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Compras por dispositivo</Label>
                <Input type="number" min={1} max={60} value={form.checkout_rate_per_minute} onChange={(e) => set('checkout_rate_per_minute', e.target.value)} />
                <p className="text-[11px] text-muted-foreground">1 a 60</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Pesquisas de rastreio</Label>
                <Input type="number" min={1} max={120} value={form.track_rate_per_minute} onChange={(e) => set('track_rate_per_minute', e.target.value)} />
                <p className="text-[11px] text-muted-foreground">1 a 120</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Recibos WhatsApp por encomenda</Label>
                <Input type="number" min={1} max={10} value={form.receipt_per_order_per_minute} onChange={(e) => set('receipt_per_order_per_minute', e.target.value)} />
                <p className="text-[11px] text-muted-foreground">1 a 10</p>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="shop" className="space-y-4 max-w-2xl">
          <p className="text-sm text-muted-foreground">
            Personalize a página <strong>/shop</strong> — centro do catálogo. A cor principal (aba Marca) aplica-se automaticamente ao hero e botões.
          </p>
          <div className="space-y-2">
            <Label>Badge do hero</Label>
            <Input value={form.shop_hero_badge} onChange={(e) => set('shop_hero_badge', e.target.value)} placeholder="Catálogo Premium" />
          </div>
          <div className="space-y-2">
            <Label>Título do hero</Label>
            <Input value={form.shop_hero_title} onChange={(e) => set('shop_hero_title', e.target.value)} placeholder="Todos os Livros" />
          </div>
          <div className="space-y-2">
            <Label>Subtítulo do hero</Label>
            <Textarea rows={2} value={form.shop_hero_subtitle} onChange={(e) => set('shop_hero_subtitle', e.target.value)} />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Ordenação por defeito</Label>
              <Select value={form.shop_default_sort} onValueChange={(v) => set('shop_default_sort', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="featured">Destaques</SelectItem>
                  <SelectItem value="title">A – Z</SelectItem>
                  <SelectItem value="price-low">Preço ↑</SelectItem>
                  <SelectItem value="price-high">Preço ↓</SelectItem>
                  <SelectItem value="newest">Mais recentes</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Livros por página</Label>
              <Input type="number" min={12} max={96} value={form.shop_per_page} onChange={(e) => set('shop_per_page', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Colunas da grelha (desktop)</Label>
              <Select value={String(form.shop_grid_columns)} onValueChange={(v) => set('shop_grid_columns', Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">3 colunas</SelectItem>
                  <SelectItem value="4">4 colunas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-3 p-4 rounded-xl border">
            <p className="text-sm font-medium">Secções visíveis na loja</p>
            <div className="flex items-center gap-3">
              <Switch checked={form.shop_show_featured} onCheckedChange={(v) => set('shop_show_featured', v)} />
              <Label>Destaques no topo</Label>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.shop_show_collections} onCheckedChange={(v) => set('shop_show_collections', v)} />
              <Label>Explorar por coleção</Label>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.shop_show_low_stock} onCheckedChange={(v) => set('shop_show_low_stock', v)} />
              <Label>Últimas unidades</Label>
            </div>
          </div>
          <div className="rounded-xl border p-4 text-sm" style={{ background: `linear-gradient(135deg, ${form.pwa_theme_color || '#0c4a6e'}, ${form.primary_color || '#0ea5c9'})` }}>
            <p className="text-white/80 text-xs mb-1">Pré-visualização do hero</p>
            <p className="text-white font-bold text-lg">{form.shop_hero_title || 'Todos os Livros'}</p>
            <p className="text-white/85 text-sm">{form.shop_hero_subtitle || form.tagline}</p>
          </div>
          <div className="space-y-3 p-4 rounded-xl border">
            <p className="text-sm font-medium">Fundo do hero da loja</p>
            <Select value={form.shop_bg_mode} onValueChange={(v) => set('shop_bg_mode', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="gradient">Gradiente (cores da marca)</SelectItem>
                <SelectItem value="image">Imagem (JPG, PNG, SVG)</SelectItem>
                <SelectItem value="video">Vídeo (MP4/WebM)</SelectItem>
                <SelectItem value="slides">Slider da loja (slides com localização «shop»)</SelectItem>
              </SelectContent>
            </Select>
            {(form.shop_bg_mode === 'image' || form.shop_bg_mode === 'video') && (
              <>
                <ImageField
                  label="Imagem de fundo do hero da loja"
                  gallery="loja"
                  value={form.shop_bg_image_url}
                  onChange={(v) => set('shop_bg_image_url', v)}
                  aspect="16:9"
                  previewClassName="h-24 w-40"
                  driveConfig={driveImageConfig}
                  hint="JPG, PNG, WebP ou SVG · 1920×1080 recomendado"
                  uploadFolder="site_settings"
                />
                {form.shop_bg_mode === 'video' && (
                  <div className="space-y-2">
                    <Label>URL do vídeo</Label>
                    <Input value={form.shop_bg_video_url} onChange={(e) => set('shop_bg_video_url', e.target.value)} placeholder="https://...mp4" />
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Opacidade do overlay (0–1)</Label>
                  <Input type="number" step="0.05" min="0" max="1" value={form.shop_bg_overlay} onChange={(e) => set('shop_bg_overlay', e.target.value)} />
                </div>
              </>
            )}
            {form.shop_bg_mode === 'slides' && (
              <p className="text-xs text-muted-foreground">Crie slides em Admin → Slider com localização «Loja» ou «Ambos».</p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="theme" className="space-y-4 max-w-xl">
          <p className="text-sm text-muted-foreground">Opacidade suave estilo macOS — translúcido com blur, sem efeitos extra.</p>
          <div className="flex items-center gap-3 p-3 rounded-lg border">
            <Switch checked={form.ui_glass_enabled} onCheckedChange={(v) => set('ui_glass_enabled', v)} />
            <Label>Activar superfícies opacas (header, rodapé, painéis)</Label>
          </div>
          <div className="space-y-2">
            <Label>Opacidade do vidro (0.5 – 0.95)</Label>
            <Input type="number" step="0.05" min="0.5" max="0.95" value={form.ui_glass_opacity} onChange={(e) => set('ui_glass_opacity', e.target.value)} />
            <p className="text-xs text-muted-foreground">Recomendado: 0.72 (similar ao macOS)</p>
          </div>
          <div className="space-y-2">
            <Label>Google Maps Embed API Key (opcional)</Label>
            <Input value={form.google_maps_embed_key} onChange={(e) => set('google_maps_embed_key', e.target.value)} placeholder="AIza..." className="font-mono text-sm" />
            <p className="text-xs text-muted-foreground">Para mapas embutidos nas lojas físicas. Sem chave, usa links Google Maps.</p>
          </div>
          <div className={`p-4 rounded-xl border glass-surface ${!form.ui_glass_enabled ? 'opacity-60' : ''}`}>
            <p className="text-sm font-medium">Pré-visualização do efeito vidro</p>
            <p className="text-xs text-muted-foreground mt-1">Header e rodapé usam este estilo quando activado.</p>
          </div>
        </TabsContent>

        <TabsContent value="header" className="space-y-4 max-w-xl">
          <p className="text-sm text-muted-foreground">
            Personalize a barra superior do site. Use <code className="text-[#0ea5c9]">{'{nome}'}</code> para inserir o primeiro nome do utilizador.
          </p>
          <div className="space-y-2">
            <Label>Mensagem (utilizador logado)</Label>
            <Input value={form.header_welcome_logged} onChange={(e) => set('header_welcome_logged', e.target.value)} placeholder="Bem-vindo de volta, {nome}" />
          </div>
          <div className="space-y-2">
            <Label>Mensagem (visitante)</Label>
            <Input value={form.header_welcome_guest} onChange={(e) => set('header_welcome_guest', e.target.value)} />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Texto do link CTA</Label>
              <Input value={form.header_cta_text} onChange={(e) => set('header_cta_text', e.target.value)} placeholder="Explorar novidades" />
            </div>
            <div className="space-y-2">
              <Label>Link CTA</Label>
              <Input value={form.header_cta_link} onChange={(e) => set('header_cta_link', e.target.value)} placeholder="/shop" />
            </div>
          </div>
          <div className="rounded-lg border p-3 bg-muted/30 text-sm">
            <p className="text-muted-foreground mb-1">Pré-visualização (logado):</p>
            <p>
              {(form.header_welcome_logged || '').replace('{nome}', 'Maria')}
              {' · '}
              <span className="underline">{form.header_cta_text || 'Explorar'}</span>
            </p>
          </div>
        </TabsContent>

        <TabsContent value="footer" className="space-y-4 max-w-2xl">
          <div className="space-y-2">
            <Label>Tagline do Rodapé</Label>
            <Input value={form.footer_tagline} onChange={(e) => set('footer_tagline', e.target.value)} placeholder="Literatura cristã, educação e inspiração..." />
          </div>
          <div className="space-y-2">
            <Label>Texto de Copyright</Label>
            <Input value={form.footer_copyright} onChange={(e) => set('footer_copyright', e.target.value)} placeholder="© 2026 Livraria Adventista. Todos os direitos reservados." />
          </div>
          <div className="flex items-center gap-3 p-3 rounded-lg border">
            <Switch checked={form.show_stores_in_footer} onCheckedChange={(v) => set('show_stores_in_footer', v)} />
            <Label>Mostrar lojas físicas no rodapé</Label>
          </div>
          <div className="space-y-2">
            <Label>Colunas do Rodapé (JSON)</Label>
            <Textarea
              rows={10}
              value={form.footer_columns ? JSON.stringify(form.footer_columns, null, 2) : ''}
              onChange={(e) => {
                try {
                  const parsed = e.target.value ? JSON.parse(e.target.value) : null;
                  set('footer_columns', parsed);
                } catch {
                  set('footer_columns', e.target.value);
                }
              }}
              placeholder={'[\n  {\n    "title": "Apoio ao Cliente",\n    "links": [{"label": "FAQ", "url": "/faq", "internal": true}]\n  }\n]'}
              className="font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground">Deixe vazio para usar colunas padrão. Cada link: label, url, internal (true para rotas internas).</p>
          </div>
        </TabsContent>

        </div>
      </Tabs>

      <div className={`sticky bottom-4 z-30 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 shadow-lg backdrop-blur transition-colors ${dirty ? 'border-amber-400/60 bg-amber-50/95 dark:bg-amber-950/80' : 'border-border bg-background/95'}`}>
        <p className={`text-sm ${dirty ? 'text-amber-900 dark:text-amber-200 font-medium' : 'text-muted-foreground'}`}>
          {dirty ? 'Há alterações por gravar.' : 'Tudo gravado.'}
        </p>
        <div className="flex gap-2">
          {dirty && (
            <Button type="button" variant="outline" onClick={discard} disabled={saving}>
              <RotateCcw className="mr-2 h-4 w-4" /> Descartar
            </Button>
          )}
          <Button type="submit" className="btn-primary" disabled={saving || !dirty}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Guardar configurações
          </Button>
        </div>
      </div>
    </form>
  );
}
