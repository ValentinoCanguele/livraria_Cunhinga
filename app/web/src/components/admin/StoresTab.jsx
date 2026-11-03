import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Loader2, Plus, Pencil, Trash2, MapPin, Store, Search, ArrowUp, ArrowDown, Clock, Phone,
  Navigation, LocateFixed, ExternalLink, PackageCheck, AlertTriangle, MessageCircle, Mail,
} from 'lucide-react';
import pb from '@/lib/dataClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import ImageField from '@/components/admin/ImageField';
import { useIntegrations } from '@/hooks/useIntegrations';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { pbErrorMessage, saveRecordWithMedia } from '@/lib/mediaSave';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import PhoneInput from '@/components/PhoneInput';
import { formatAngolaPhone, displayAngolaPhone } from '@/lib/angolaPhone';
import { ANGOLA_PROVINCES_2024, avisoDeCoordenadas } from '@/lib/angolaGeo';
import { distanciaKm } from '@/lib/localizacao';
import { hasCoords, mapsUrl, mapEmbedUrl, parseCoords } from '@/lib/stores';

const ANGOLA_PROVINCES = ANGOLA_PROVINCES_2024;

const emptyStore = {
  name: '',
  province: 'Luanda',
  address: '',
  phone: '',
  whatsapp: '',
  email: '',
  hours: 'Seg–Sex 9h–18h, Sáb 9h–13h',
  image_url: '',
  latitude: '',
  longitude: '',
  maps_url: '',
  sort_order: 0,
  active: true,
  pickup_enabled: true,
};

function FormSection({ title, children }) {
  return (
    <fieldset className="space-y-3 rounded-xl border border-border p-4">
      <legend className="px-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">{title}</legend>
      {children}
    </fieldset>
  );
}

export default function StoresTab() {
  const { toast } = useToast();
  const { settings } = useSiteSettings();
  const { driveImageConfig } = useIntegrations();
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyStore);
  const [imageFile, setImageFile] = useState(null);
  const [imageRemoved, setImageRemoved] = useState(false);
  const [hadImageFile, setHadImageFile] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [toDelete, setToDelete] = useState(null);
  const [query, setQuery] = useState('');
  const [province, setProvince] = useState('all');
  const [status, setStatus] = useState('all');
  const [mapsPaste, setMapsPaste] = useState('');
  const [locating, setLocating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setStores(await pb.collection('physical_stores').getFullList({ sort: 'sort_order,name' }));
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erro ao carregar lojas', description: pbErrorMessage(err) });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const imageOf = (s) => s.image_url || (s.image ? pb.files.getURL(s, s.image) : '');

  const stats = useMemo(() => ({
    total: stores.length,
    active: stores.filter((s) => s.active).length,
    pickup: stores.filter((s) => s.active && s.pickup_enabled !== false).length,
    noGps: stores.filter((s) => !hasCoords(s)).length,
  }), [stores]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return stores.filter((s) => {
      if (province !== 'all' && s.province !== province) return false;
      if (status === 'active' && !s.active) return false;
      if (status === 'inactive' && s.active) return false;
      if (status === 'pickup' && !(s.active && s.pickup_enabled !== false)) return false;
      if (status === 'nogps' && hasCoords(s)) return false;
      if (!q) return true;
      return [s.name, s.address, s.province, s.phone, s.email].filter(Boolean).join(' ').toLowerCase().includes(q);
    });
  }, [stores, query, province, status]);

  const usedProvinces = useMemo(() => ANGOLA_PROVINCES.filter((p) => stores.some((s) => s.province === p)), [stores]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyStore, sort_order: stores.length ? Math.max(...stores.map((s) => Number(s.sort_order) || 0)) + 1 : 0 });
    setImageFile(null);
    setImageRemoved(false);
    setHadImageFile(false);
    setMapsPaste('');
    setShowForm(true);
  };

  const openEdit = (s) => {
    setEditing(s);
    setHadImageFile(!!s.image);
    setImageRemoved(false);
    setImageFile(null);
    setMapsPaste('');
    setForm({
      name: s.name || '',
      province: s.province || 'Luanda',
      address: s.address || '',
      phone: s.phone ? formatAngolaPhone(s.phone) : '',
      whatsapp: s.whatsapp ? formatAngolaPhone(s.whatsapp) : '',
      email: s.email || '',
      hours: s.hours || '',
      image_url: imageOf(s),
      latitude: hasCoords(s) ? s.latitude : '',
      longitude: hasCoords(s) ? s.longitude : '',
      maps_url: s.maps_url || '',
      sort_order: s.sort_order ?? 0,
      active: !!s.active,
      pickup_enabled: s.pickup_enabled !== false,
    });
    setShowForm(true);
  };

  const applyMapsPaste = (text) => {
    setMapsPaste(text);
    const coords = parseCoords(text);
    if (coords) {
      setForm((f) => ({ ...f, ...coords, maps_url: /^https?:\/\//.test(text.trim()) ? text.trim() : f.maps_url }));
    }
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast({ variant: 'destructive', title: 'Localização indisponível neste navegador' });
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setForm((f) => ({ ...f, latitude: coords.latitude.toFixed(6), longitude: coords.longitude.toFixed(6) }));
        setLocating(false);
      },
      () => {
        toast({ variant: 'destructive', title: 'Não foi possível obter a localização', description: 'Autorize o acesso à localização ou cole um link do Google Maps.' });
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  // Confere se as coordenadas caem na província escolhida. Duas das três lojas estavam na
  // província errada e nada aqui o dizia, porque as coordenadas eram válidas — só não eram
  // as daquela loja.
  const avisoGps = useMemo(
    () => avisoDeCoordenadas({ latitude: form.latitude, longitude: form.longitude, province: form.province }, distanciaKm),
    [form.latitude, form.longitude, form.province],
  );

  const handleSave = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    const lat = form.latitude !== '' ? Number(form.latitude) : null;
    const lng = form.longitude !== '' ? Number(form.longitude) : null;
    if ((lat === null) !== (lng === null) || (lat !== null && (Math.abs(lat) > 90 || Math.abs(lng) > 180))) {
      toast({ variant: 'destructive', title: 'Coordenadas GPS inválidas', description: 'Preencha latitude e longitude, ou deixe ambas vazias.' });
      return;
    }
    setSaving(true);
    try {
      await saveRecordWithMedia({
        collection: 'physical_stores',
        recordId: editing?.id,
        data: {
          ...form,
          latitude: lat,
          longitude: lng,
          maps_url: form.maps_url || (lat !== null ? mapsUrl({ latitude: lat, longitude: lng }) : ''),
          sort_order: Number(form.sort_order) || 0,
          active: !!form.active,
          pickup_enabled: !!form.pickup_enabled,
        },
        file: imageFile,
        fileField: 'image',
        urlField: 'image_url',
        removed: imageRemoved,
        hadFile: hadImageFile,
      });
      toast({ title: editing ? 'Loja actualizada' : 'Loja adicionada' });
      setShowForm(false);
      load();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erro', description: pbErrorMessage(err) });
    } finally {
      setSaving(false);
    }
  };

  const quickUpdate = async (s, patch, message) => {
    setBusyId(s.id);
    setStores((list) => list.map((x) => (x.id === s.id ? { ...x, ...patch } : x)));
    try {
      await pb.collection('physical_stores').update(s.id, patch);
      if (message) toast({ title: message });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erro', description: pbErrorMessage(err) });
      load();
    } finally {
      setBusyId(null);
    }
  };

  // Troca a posição com a loja vizinha e renumera a ordem de todas.
  const move = async (s, dir) => {
    const ordered = [...stores];
    const i = ordered.findIndex((x) => x.id === s.id);
    const j = i + dir;
    if (j < 0 || j >= ordered.length) return;
    [ordered[i], ordered[j]] = [ordered[j], ordered[i]];
    const renumbered = ordered.map((x, idx) => ({ ...x, sort_order: idx }));
    setStores(renumbered);
    setBusyId(s.id);
    try {
      await Promise.all(renumbered
        .filter((x, idx) => stores.find((o) => o.id === x.id)?.sort_order !== idx)
        .map((x) => pb.collection('physical_stores').update(x.id, { sort_order: x.sort_order })));
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erro ao reordenar', description: pbErrorMessage(err) });
      load();
    } finally {
      setBusyId(null);
    }
  };

  const confirmDelete = async () => {
    const s = toDelete;
    setToDelete(null);
    try {
      await pb.collection('physical_stores').delete(s.id);
      toast({ title: 'Loja eliminada' });
      load();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erro', description: pbErrorMessage(err) });
    }
  };

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const previewEmbed = mapEmbedUrl(form, settings.google_maps_embed_key);
  const filtersActive = query || province !== 'all' || status !== 'all';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-start gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Store className="h-6 w-6 text-primary" /> Lojas físicas
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Aparecem na página <a href="/lojas" target="_blank" rel="noreferrer" className="text-primary hover:underline">/lojas</a>, no rodapé, no menu e no levantamento do checkout.
          </p>
        </div>
        <Button className="btn-primary shrink-0" onClick={openCreate} type="button">
          <Plus className="h-4 w-4 mr-2" /> Nova loja
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { key: 'all', label: 'Lojas', value: stats.total, icon: Store },
          { key: 'active', label: 'Visíveis no site', value: stats.active, icon: MapPin },
          { key: 'pickup', label: 'Aceitam levantamento', value: stats.pickup, icon: PackageCheck },
          { key: 'nogps', label: 'Sem GPS', value: stats.noGps, icon: AlertTriangle, warn: stats.noGps > 0 },
        ].map(({ key, label, value, icon: Icon, warn }) => (
          <button
            key={key}
            type="button"
            onClick={() => setStatus(status === key ? 'all' : key)}
            className={`text-left rounded-xl border p-4 transition-colors ${status === key ? 'border-[#0ea5c9] bg-[#0ea5c9]/5' : 'border-border bg-card hover:border-[#0ea5c9]/40'}`}
          >
            <Icon className={`h-4 w-4 mb-2 ${warn ? 'text-amber-600' : 'text-primary'}`} />
            <p className="text-2xl font-bold tabular-nums">{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Pesquisar por nome, morada, telefone…" className="pl-9" />
        </div>
        <Select value={province} onValueChange={setProvince}>
          <SelectTrigger className="w-[190px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as províncias</SelectItem>
            {usedProvinces.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
        {filtersActive && (
          <Button type="button" variant="ghost" onClick={() => { setQuery(''); setProvince('all'); setStatus('all'); }}>Limpar filtros</Button>
        )}
      </div>

      {filtered.length > 0 ? (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((s) => {
            const image = imageOf(s);
            const index = stores.findIndex((x) => x.id === s.id);
            return (
              <article key={s.id} className={`bg-card border rounded-xl overflow-hidden flex flex-col ${s.active ? '' : 'opacity-70'}`}>
                <div className="relative h-36 bg-muted">
                  {image ? (
                    <img src={image} alt={s.name} className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground text-xs gap-1">
                      <Store className="h-7 w-7 text-primary/40" /> Sem foto
                    </div>
                  )}
                  <div className="absolute top-2 left-2 flex flex-wrap gap-1">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-black/60 text-white backdrop-blur">{s.province}</span>
                    {!hasCoords(s) && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500 text-white">Sem GPS</span>}
                  </div>
                  <div className="absolute top-2 right-2 flex gap-1">
                    <Button type="button" size="icon" variant="secondary" className="h-7 w-7" disabled={index <= 0 || busyId === s.id} onClick={() => move(s, -1)} aria-label="Subir">
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button type="button" size="icon" variant="secondary" className="h-7 w-7" disabled={index >= stores.length - 1 || busyId === s.id} onClick={() => move(s, 1)} aria-label="Descer">
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="p-4 flex-1 flex flex-col gap-2">
                  <div className="flex justify-between items-start gap-2">
                    <h4 className="font-semibold leading-snug">{s.name}</h4>
                    <div className="flex shrink-0">
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(s)} aria-label="Editar"><Pencil className="h-4 w-4" /></Button>
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => setToDelete(s)} aria-label="Eliminar"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground flex items-start gap-1.5"><MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5" />{s.address}</p>
                  {s.hours && <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" />{s.hours}</p>}
                  {s.phone && <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" />{displayAngolaPhone(s.phone)}</p>}
                  <a href={mapsUrl(s)} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline inline-flex items-center gap-1">
                    <ExternalLink className="h-3 w-3" /> Abrir no mapa
                  </a>
                  <div className="mt-auto pt-3 border-t border-border grid grid-cols-2 gap-2">
                    <label className="flex items-center gap-2 text-xs font-medium">
                      <Switch checked={!!s.active} disabled={busyId === s.id} onCheckedChange={(v) => quickUpdate(s, { active: v }, v ? 'Loja visível no site' : 'Loja escondida do site')} />
                      Visível
                    </label>
                    <label className="flex items-center gap-2 text-xs font-medium">
                      <Switch checked={s.pickup_enabled !== false} disabled={busyId === s.id || !s.active} onCheckedChange={(v) => quickUpdate(s, { pickup_enabled: v }, v ? 'Levantamento activado' : 'Levantamento desactivado')} />
                      Levantamento
                    </label>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="text-muted-foreground text-center py-12 border rounded-xl border-dashed">
          {stores.length ? 'Nenhuma loja corresponde aos filtros.' : 'Nenhuma loja registada. Adicione a primeira loja física.'}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar loja' : 'Nova loja física'}</DialogTitle>
            <DialogDescription>Os dados aparecem na página de lojas, no rodapé e no checkout.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <FormSection title="Identificação">
              <div className="space-y-2">
                <Label>Nome da loja *</Label>
                <Input value={form.name} onChange={(e) => set('name', e.target.value)} required placeholder="Ex.: Livraria Adventista — Huambo" />
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Província *</Label>
                  <Select value={form.province} onValueChange={(v) => set('province', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ANGOLA_PROVINCES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Horário</Label>
                  <Input value={form.hours} onChange={(e) => set('hours', e.target.value)} placeholder="Seg–Sex 9h–18h, Sáb 9h–13h" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Morada *</Label>
                <Input value={form.address} onChange={(e) => set('address', e.target.value)} required placeholder="Rua, bairro, município" />
              </div>
            </FormSection>

            <FormSection title="Contactos">
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> Telefone</Label>
                  <PhoneInput value={form.phone} onChange={(phone) => set('phone', phone)} />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5"><MessageCircle className="h-3.5 w-3.5" /> WhatsApp</Label>
                  <PhoneInput value={form.whatsapp} onChange={(v) => set('whatsapp', v)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> Email</Label>
                <Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
              </div>
            </FormSection>

            <FormSection title="Localização">
              <div className="space-y-2">
                <Label>Colar link do Google Maps ou coordenadas</Label>
                <Input
                  value={mapsPaste}
                  onChange={(e) => applyMapsPaste(e.target.value)}
                  placeholder="https://www.google.com/maps/@-8.9094,13.1840,17z  ou  -8.9094, 13.1840"
                />
                {mapsPaste && (
                  <p className={`text-xs ${parseCoords(mapsPaste) ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {parseCoords(mapsPaste) ? 'Coordenadas extraídas do link.' : 'Não encontrei coordenadas neste texto. Use o link completo (com @latitude,longitude) ou escreva-as.'}
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Latitude</Label>
                  <Input type="number" step="any" value={form.latitude} onChange={(e) => set('latitude', e.target.value)} placeholder="-8.9094" />
                </div>
                <div className="space-y-2">
                  <Label>Longitude</Label>
                  <Input type="number" step="any" value={form.longitude} onChange={(e) => set('longitude', e.target.value)} placeholder="13.1840" />
                </div>
              </div>
              {avisoGps && (
                <p
                  className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200"
                  role="alert"
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  <span>{avisoGps.mensagem}</span>
                </p>
              )}
              <Button type="button" variant="outline" size="sm" onClick={useCurrentLocation} disabled={locating}>
                {locating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <LocateFixed className="h-4 w-4 mr-2" />}
                Usar a minha localização actual
              </Button>
              {previewEmbed ? (
                <div className="rounded-lg overflow-hidden border aspect-[16/9]">
                  <iframe title="Pré-visualização do mapa" src={previewEmbed} className="w-full h-full border-0" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
                </div>
              ) : (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Navigation className="h-3.5 w-3.5" /> Sem coordenadas, o mapa usa a morada (menos preciso).</p>
              )}
            </FormSection>

            <FormSection title="Foto">
              <ImageField
                label="Foto da loja"
                value={form.image_url}
                onChange={(v) => { set('image_url', v); setImageRemoved(false); }}
                onFileChange={(f) => { setImageFile(f); if (f) setImageRemoved(false); }}
                onClear={() => setImageRemoved(true)}
                aspect="16:9"
                driveConfig={driveImageConfig}
              />
            </FormSection>

            <FormSection title="Opções">
              <label className="flex items-center gap-3">
                <Switch checked={form.active} onCheckedChange={(v) => set('active', v)} />
                <span className="text-sm"><span className="font-medium">Visível no site</span><span className="block text-xs text-muted-foreground">Página de lojas, rodapé e menu</span></span>
              </label>
              <label className="flex items-center gap-3">
                <Switch checked={form.pickup_enabled} onCheckedChange={(v) => set('pickup_enabled', v)} />
                <span className="text-sm"><span className="font-medium">Aceita levantamento de encomendas</span><span className="block text-xs text-muted-foreground">Aparece como opção no checkout</span></span>
              </label>
            </FormSection>

            <div className="flex gap-3 pt-1">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button type="submit" className="flex-1 btn-primary" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Guardar loja
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar a loja «{toDelete?.name}»?</AlertDialogTitle>
            <AlertDialogDescription>
              Deixa de aparecer no site e no checkout. As encomendas antigas mantêm o nome da loja. Para a esconder sem apagar, desligue «Visível».
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
