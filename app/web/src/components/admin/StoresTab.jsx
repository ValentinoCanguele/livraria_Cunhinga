import React, { useState, useEffect, useCallback } from 'react';
import { Loader2, Plus, Pencil, Trash2, MapPin, Store } from 'lucide-react';
import pb from '@/lib/pocketbaseClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import ImageField from '@/components/admin/ImageField';
import { useIntegrations } from '@/hooks/useIntegrations';
import { pbErrorMessage, saveRecordWithMedia } from '@/lib/mediaSave';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import PhoneInput from '@/components/PhoneInput';
import { formatAngolaPhone, displayAngolaPhone } from '@/lib/angolaPhone';
import { ANGOLA_PROVINCES_2024 } from '@/lib/angolaGeo';

const ANGOLA_PROVINCES = ANGOLA_PROVINCES_2024;

const emptyStore = {
  name: '',
  province: 'Luanda',
  address: '',
  phone: '',
  email: '',
  hours: 'Seg–Sex 9h–18h, Sáb 9h–13h',
  image_url: '',
  latitude: '',
  longitude: '',
  maps_url: '',
  sort_order: 0,
  active: true,
};

export default function StoresTab() {
  const { toast } = useToast();
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyStore);
  const [imageFile, setImageFile] = useState(null);
  const [imageRemoved, setImageRemoved] = useState(false);
  const [hadImageFile, setHadImageFile] = useState(false);
  const [saving, setSaving] = useState(false);
  const { driveImageConfig } = useIntegrations();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await pb.collection('physical_stores').getFullList({ sort: 'sort_order' });
      setStores(list);
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
    setForm(emptyStore);
    setImageFile(null);
    setImageRemoved(false);
    setHadImageFile(false);
    setShowForm(true);
  };

  const openEdit = (s) => {
    setEditing(s);
    setHadImageFile(!!s.image);
    setImageRemoved(false);
    setImageFile(null);
    setForm({
      name: s.name || '',
      province: s.province || 'Luanda',
      address: s.address || '',
      phone: s.phone ? formatAngolaPhone(s.phone) : '',
      email: s.email || '',
      hours: s.hours || '',
      image_url: s.image_url || (s.image ? pb.files.getURL(s, s.image) : ''),
      latitude: s.latitude ?? '',
      longitude: s.longitude ?? '',
      maps_url: s.maps_url || '',
      sort_order: s.sort_order ?? 0,
      active: !!s.active,
    });
    setImageFile(null);
    setShowForm(true);
  };

  const buildMapsUrl = (lat, lng) => {
    if (!lat || !lng) return '';
    return `https://www.google.com/maps?q=${lat},${lng}&z=15`;
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const lat = form.latitude !== '' ? Number(form.latitude) : null;
      const lng = form.longitude !== '' ? Number(form.longitude) : null;
      const data = {
        ...form,
        latitude: lat,
        longitude: lng,
        maps_url: form.maps_url || buildMapsUrl(lat, lng),
        sort_order: Number(form.sort_order) || 0,
        active: !!form.active,
      };
      await saveRecordWithMedia({
        collection: 'physical_stores',
        recordId: editing?.id,
        data,
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

  const handleDelete = async (s) => {
    if (!confirm(`Eliminar loja "${s.name}"?`)) return;
    try {
      await pb.collection('physical_stores').delete(s.id);
      toast({ title: 'Loja eliminada' });
      load();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erro', description: err.message });
    }
  };

  const grouped = ANGOLA_PROVINCES.reduce((acc, prov) => {
    const list = stores.filter((s) => s.province === prov);
    if (list.length) acc[prov] = list;
    return acc;
  }, {});

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-[#0ea5c9]" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Store className="h-6 w-6 text-[#0ea5c9]" /> Lojas Físicas
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Gerir pontos de venda por província — aparecem no rodapé com mapa GPS.
          </p>
        </div>
        <Button className="btn-primary shrink-0" onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" /> Nova Loja
        </Button>
      </div>

      {Object.keys(grouped).length > 0 ? (
        Object.entries(grouped).map(([province, list]) => (
          <div key={province}>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">{province}</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              {list.map((s) => (
                <div key={s.id} className="bg-card border rounded-xl overflow-hidden">
                  {(s.image_url || s.image) && (
                    <img
                      src={s.image_url || pb.files.getURL(s, s.image)}
                      alt={s.name}
                      className="w-full h-32 object-cover"
                    />
                  )}
                  <div className="p-4">
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <h4 className="font-semibold">{s.name}</h4>
                        <p className="text-sm text-muted-foreground flex items-start gap-1 mt-1">
                          <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                          {s.address}
                        </p>
                        {s.phone && <p className="text-xs text-muted-foreground mt-1">{displayAngolaPhone(s.phone)}</p>}
                        {s.latitude && s.longitude && (
                          <a
                            href={s.maps_url || buildMapsUrl(s.latitude, s.longitude)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-[#0ea5c9] hover:underline mt-1 inline-block"
                          >
                            Ver no mapa ({s.latitude}, {s.longitude})
                          </a>
                        )}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(s)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(s)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    </div>
                    <span className={`inline-block mt-2 text-[10px] px-1.5 py-0.5 rounded ${s.active ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'}`}>
                      {s.active ? 'Activa' : 'Inactiva'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      ) : (
        <p className="text-muted-foreground text-center py-12 border rounded-xl border-dashed">
          Nenhuma loja registada. Adicione a primeira loja física.
        </p>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-background rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 shadow-xl">
            <h2 className="text-xl font-bold mb-6">{editing ? 'Editar Loja' : 'Nova Loja Física'}</h2>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-2">
                <Label>Nome da Loja *</Label>
                <Input value={form.name} onChange={(e) => set('name', e.target.value)} required placeholder="Ex: Livraria Adventista — Talatona" />
              </div>
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
                <Label>Morada *</Label>
                <Input value={form.address} onChange={(e) => set('address', e.target.value)} required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <PhoneInput value={form.phone} onChange={(phone) => set('phone', phone)} />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Horário</Label>
                <Input value={form.hours} onChange={(e) => set('hours', e.target.value)} />
              </div>
              <ImageField
                label="Foto da Loja"
                value={form.image_url}
                onChange={(v) => { set('image_url', v); setImageRemoved(false); }}
                onFileChange={(f) => { setImageFile(f); if (f) setImageRemoved(false); }}
                onClear={() => setImageRemoved(true)}
                aspect="16:9"
                driveConfig={driveImageConfig}
              />
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Latitude (GPS)</Label>
                  <Input type="number" step="any" value={form.latitude} onChange={(e) => set('latitude', e.target.value)} placeholder="-8.9094" />
                </div>
                <div className="space-y-2">
                  <Label>Longitude (GPS)</Label>
                  <Input type="number" step="any" value={form.longitude} onChange={(e) => set('longitude', e.target.value)} placeholder="13.1840" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Link Google Maps (opcional)</Label>
                <Input value={form.maps_url} onChange={(e) => set('maps_url', e.target.value)} placeholder="Gerado automaticamente com GPS" />
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={form.active} onCheckedChange={(v) => set('active', v)} />
                <Label>Visível no rodapé</Label>
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
