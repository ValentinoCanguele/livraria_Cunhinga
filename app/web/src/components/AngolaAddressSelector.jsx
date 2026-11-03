import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, MapPin, Phone, Users } from 'lucide-react';
import { getGeoMunicipalities, getGeoProvinces, getGeoLocalities } from '@/api/PlatformApi';
import geoFallback from '@/data/angola-geo-2024.json';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import PhoneInput from '@/components/PhoneInput';
import { isValidAngolaPhone, normalizeAngolaPhone } from '@/lib/angolaPhone';

const emptyAddress = {
  provinceId: '',
  provinceName: '',
  municipalityId: '',
  municipalityName: '',
  localityId: '',
  localityName: '',
  localityCustom: '',
  street: '',
  reference: '',
  phone: '',
  relativeName: '',
  relativePhone: '',
};

function useGeoList(loader, deps = []) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await loader();
      setItems(data || []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => { load(); }, [load]);

  return { items, loading, reload: load };
}

function fallbackProvinces() {
  return (geoFallback.provinces || []).map((p) => ({
    id: p.slug,
    name: p.name,
    slug: p.slug,
    capital: p.capital,
    sort_order: p.sort_order,
  }));
}

function fallbackMunicipalities(provinceSlug) {
  const prov = (geoFallback.provinces || []).find((p) => p.slug === provinceSlug || p.name === provinceSlug);
  if (!prov) return [];
  return (prov.municipalities || []).map((m) => ({
    id: `${prov.slug}-${m.slug}`,
    name: m.name,
    slug: m.slug,
    sort_order: m.sort_order,
  }));
}

function fallbackLocalities(provinceSlug, municipalitySlug) {
  const prov = (geoFallback.provinces || []).find((p) => p.slug === provinceSlug);
  const muni = prov?.municipalities?.find((m) => m.slug === municipalitySlug || m.name === municipalitySlug);
  return (muni?.localities || []).map((l, i) => ({
    id: `${muni.slug}-${i}`,
    name: l.name,
    type: l.type || 'bairro',
    sort_order: l.sort_order,
  }));
}

export function validateAngolaAddress(value, { requireDelivery = true } = {}) {
  if (!requireDelivery) return null;
  if (!value.provinceName) return 'Seleccione a província de entrega.';
  if (!value.municipalityName) return 'Seleccione o município de entrega.';
  const locality = (value.localityName || value.localityCustom || '').trim();
  if (!locality) return 'Indique o bairro, comuna ou localidade.';
  if (!(value.street || '').trim()) return 'Indique a rua, avenida ou morada completa.';
  if (!(value.reference || '').trim()) return 'Indique um ponto de referência para a entrega.';
  const phone = (value.phone || '').trim();
  if (!phone) return 'Indique o telefone de contacto para a entrega.';
  if (!isValidAngolaPhone(phone)) return 'Telefone inválido — use +244 9XX XXX XXX.';
  const relName = (value.relativeName || '').trim();
  const relPhone = (value.relativePhone || '').trim();
  if (relName && !relPhone) return 'Indique o telefone do parente ou contacto próximo.';
  if (relPhone && !isValidAngolaPhone(relPhone)) return 'Telefone do contacto próximo inválido.';
  return null;
}

export function angolaAddressToPayload(value) {
  const locality = (value.localityName || value.localityCustom || '').trim();
  const parts = [value.street, locality, value.municipalityName, value.provinceName].filter(Boolean);
  const full = parts.join(', ') + (value.reference ? ` — Ref: ${value.reference}` : '') + ', Angola';
  return {
    deliveryProvinceId: value.provinceId,
    deliveryProvince: value.provinceName,
    deliveryMunicipalityId: value.municipalityId,
    deliveryMunicipality: value.municipalityName,
    deliveryLocalityId: value.localityId,
    deliveryLocality: locality,
    deliveryStreet: (value.street || '').trim(),
    deliveryReference: (value.reference || '').trim(),
    deliveryAddressFull: full,
    address: full,
    city: value.municipalityName || value.provinceName,
    phone: normalizeAngolaPhone(value.phone || ''),
    deliveryRelativeName: (value.relativeName || '').trim(),
    deliveryRelativePhone: value.relativePhone ? normalizeAngolaPhone(value.relativePhone) : '',
  };
}

export default function AngolaAddressSelector({ value, onChange, disabled = false }) {
  const v = { ...emptyAddress, ...value };

  const { items: provinces, loading: loadingProvinces } = useGeoList(async () => {
    const list = await getGeoProvinces();
    return list.length ? list : fallbackProvinces();
  });

  const { items: municipalities, loading: loadingMunis } = useGeoList(async () => {
    if (!v.provinceId) return [];
    try {
      const list = await getGeoMunicipalities(v.provinceId);
      if (list.length) return list;
    } catch {}
    const prov = provinces.find((p) => p.id === v.provinceId);
    return fallbackMunicipalities(prov?.slug || v.provinceId);
  }, [v.provinceId, provinces]);

  const { items: localities, loading: loadingLocs } = useGeoList(async () => {
    if (!v.municipalityId) return [];
    try {
      const list = await getGeoLocalities(v.municipalityId);
      if (list.length) return list;
    } catch {}
    const prov = provinces.find((p) => p.id === v.provinceId);
    const muni = municipalities.find((m) => m.id === v.municipalityId);
    return fallbackLocalities(prov?.slug, muni?.slug || muni?.name);
  }, [v.municipalityId, v.provinceId, provinces, municipalities]);

  const set = (patch) => onChange({ ...v, ...patch });

  const onProvince = (id) => {
    const p = provinces.find((x) => x.id === id);
    set({
      provinceId: id,
      provinceName: p?.name || '',
      municipalityId: '',
      municipalityName: '',
      localityId: '',
      localityName: '',
      localityCustom: '',
    });
  };

  const onMunicipality = (id) => {
    const m = municipalities.find((x) => x.id === id);
    set({
      municipalityId: id,
      municipalityName: m?.name || '',
      localityId: '',
      localityName: '',
      localityCustom: '',
    });
  };

  const onLocality = (id) => {
    if (id === '__custom__') {
      set({ localityId: '', localityName: '', localityCustom: v.localityCustom });
      return;
    }
    const l = localities.find((x) => x.id === id);
    set({ localityId: id, localityName: l?.name || '', localityCustom: '' });
  };

  const showCustomLocality = localities.length === 0 || v.localityCustom || (!v.localityId && v.localityName === '');

  return (
    <div className="space-y-3 rounded-lg border border-[#0ea5c9]/20 bg-[#0ea5c9]/5 p-3">
      <div className="flex items-center gap-2 text-sm font-medium text-primary">
        <MapPin className="h-4 w-4" />
        Local de entrega em Angola
        <span className="text-[10px] font-normal text-muted-foreground ml-auto">Censo 2024 · 21 províncias</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Província *</Label>
          <Select value={v.provinceId || ''} onValueChange={onProvince} disabled={disabled || loadingProvinces}>
            <SelectTrigger>
              <SelectValue placeholder={loadingProvinces ? 'A carregar...' : 'Seleccione a província'} />
            </SelectTrigger>
            <SelectContent>
              {provinces.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Município *</Label>
          <Select
            value={v.municipalityId || ''}
            onValueChange={onMunicipality}
            disabled={disabled || !v.provinceId || loadingMunis}
          >
            <SelectTrigger>
              <SelectValue placeholder={!v.provinceId ? 'Escolha a província primeiro' : loadingMunis ? 'A carregar...' : 'Seleccione o município'} />
            </SelectTrigger>
            <SelectContent>
              {municipalities.map((m) => (
                <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label>Bairro / Comuna / Localidade *</Label>
          {localities.length > 0 && (
            <Select
              value={v.localityId || (v.localityCustom ? '__custom__' : '')}
              onValueChange={onLocality}
              disabled={disabled || !v.municipalityId || loadingLocs}
            >
              <SelectTrigger>
                <SelectValue placeholder={loadingLocs ? 'A carregar...' : 'Seleccione ou escreva abaixo'} />
              </SelectTrigger>
              <SelectContent>
                {localities.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.name}
                    {l.type ? <span className="text-muted-foreground text-xs ml-1">({l.type})</span> : null}
                  </SelectItem>
                ))}
                <SelectItem value="__custom__">Outra localidade (especificar)</SelectItem>
              </SelectContent>
            </Select>
          )}
          {(showCustomLocality || localities.length === 0) && (
            <Input
              value={v.localityCustom || v.localityName}
              onChange={(e) => set({ localityCustom: e.target.value, localityName: '', localityId: '' })}
              placeholder="Ex.: Bairro Operário, Comuna X, aldeia..."
              disabled={disabled || !v.municipalityId}
            />
          )}
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label>Rua / Avenida / Morada *</Label>
          <Textarea
            rows={2}
            value={v.street}
            onChange={(e) => set({ street: e.target.value })}
            placeholder="Rua, número, edifício, andar..."
            disabled={disabled}
          />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label>Ponto de referência *</Label>
          <Input
            value={v.reference}
            onChange={(e) => set({ reference: e.target.value })}
            placeholder="Ex.: junto ao mercado, escola, poste, casa cor..."
            disabled={disabled}
          />
          <p className="text-[11px] text-muted-foreground">
            Obrigatório para entregas ao domicílio — facilita a localização do estafeta em todo o território nacional.
          </p>
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label className="flex items-center gap-1.5">
            <Phone className="h-3.5 w-3.5 text-primary" />
            Telefone de contacto *
          </Label>
          <PhoneInput
            value={v.phone}
            onChange={(phone) => set({ phone })}
            disabled={disabled}
          />
          <p className="text-[11px] text-muted-foreground">
            Número para o estafeta ligar no momento da entrega.
          </p>
        </div>

        <div className="space-y-2 sm:col-span-2 rounded-lg border border-dashed border-muted-foreground/20 p-3 bg-background/50">
          <Label className="flex items-center gap-1.5 text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            Parente ou contacto próximo (opcional)
          </Label>
          <div className="grid sm:grid-cols-2 gap-3">
            <Input
              value={v.relativeName}
              onChange={(e) => set({ relativeName: e.target.value })}
              placeholder="Nome do familiar"
              disabled={disabled}
            />
            <PhoneInput
              value={v.relativePhone}
              onChange={(relativePhone) => set({ relativePhone })}
              disabled={disabled}
              placeholder="+244 9XX XXX XXX"
            />
          </div>
          <p className="text-[11px] text-muted-foreground">
            Útil caso não esteja disponível no local — alguém que possa receber ou indicar a morada.
          </p>
        </div>
      </div>

      {(loadingProvinces || loadingMunis) && (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Loader2 className="h-3 w-3 animate-spin" /> A sincronizar mapa administrativo...
        </p>
      )}
    </div>
  );
}
