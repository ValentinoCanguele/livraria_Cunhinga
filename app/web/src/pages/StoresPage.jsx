import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { MapPin, Clock, Phone, Mail, Navigation, MessageCircle, PackageCheck, Store, Search, LocateFixed, Loader2 } from 'lucide-react';
import Header from '@/components/Header.jsx';
import Footer from '@/components/Footer.jsx';
import ShoppingCart from '@/components/ShoppingCart.jsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getPhysicalStores } from '@/api/PlatformApi';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { pageTitle } from '@/lib/brand';
import { displayAngolaPhone } from '@/lib/angolaPhone';
import { hasCoords, mapsUrl, directionsUrl, mapEmbedUrl, whatsappLink } from '@/lib/stores';

// Distância aproximada em km (fórmula de Haversine).
function distanceKm(a, b) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

export default function StoresPage() {
  const { settings } = useSiteSettings();
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [stores, setStores] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [query, setQuery] = useState('');
  const [province, setProvince] = useState('');
  const [position, setPosition] = useState(null);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    getPhysicalStores().then((list) => {
      setStores(list);
      const fromHash = window.location.hash.slice(1);
      setSelectedId(list.find((s) => s.id === fromHash)?.id || list[0]?.id || null);
    });
  }, []);

  const provinces = useMemo(() => [...new Set((stores || []).map((s) => s.province).filter(Boolean))], [stores]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = (stores || []).filter((s) => (!province || s.province === province)
      && (!q || [s.name, s.address, s.province].join(' ').toLowerCase().includes(q)));
    if (!position) return list;
    return list
      .map((s) => ({ ...s, distance: hasCoords(s) ? distanceKm(position, { latitude: Number(s.latitude), longitude: Number(s.longitude) }) : null }))
      .sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));
  }, [stores, query, province, position]);

  const selected = visible.find((s) => s.id === selectedId) || visible[0] || null;
  const embed = selected ? mapEmbedUrl(selected, settings.google_maps_embed_key) : '';

  const locate = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setPosition({ latitude: coords.latitude, longitude: coords.longitude });
        setLocating(false);
      },
      () => setLocating(false),
      { timeout: 10000 },
    );
  };

  useEffect(() => {
    if (position && visible[0]) setSelectedId(visible[0].id);
  }, [position]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <Helmet>
        <title>{pageTitle('Lojas físicas')}</title>
        <meta name="description" content="Moradas, horários, contactos e mapa das lojas da Livraria Adventista em Angola." />
      </Helmet>
      <Header onCartOpen={() => setIsCartOpen(true)} />
      <ShoppingCart isCartOpen={isCartOpen} setIsCartOpen={setIsCartOpen} />

      <main className="bg-muted/20 min-h-screen">
        <section className="bg-gradient-to-br from-[#0c4a6e] to-[#0ea5c9] text-white">
          <div className="container-custom py-12 md:py-16">
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
              <p className="text-sm font-semibold uppercase tracking-wider text-white/70 mb-2 flex items-center gap-2"><Store className="h-4 w-4" /> Lojas físicas</p>
              <h1 className="text-3xl md:text-5xl font-bold font-serif mb-3">Visite-nos</h1>
              <p className="text-white/85 max-w-xl">
                Encontre a loja mais perto de si, veja o horário e combine o levantamento das suas encomendas.
              </p>
            </motion.div>
          </div>
        </section>

        <div className="container-custom py-8">
          {stores === null ? (
            <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : stores.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground">De momento não há lojas para mostrar.</div>
          ) : (
            <>
              <div className="flex flex-wrap gap-3 mb-6">
                <div className="relative flex-1 min-w-[220px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Pesquisar por nome ou morada" className="pl-9 bg-background" aria-label="Pesquisar lojas" />
                </div>
                {provinces.length > 1 && (
                  <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por província">
                    {['', ...provinces].map((p) => (
                      <Button key={p || 'all'} type="button" size="sm" variant={province === p ? 'default' : 'outline'} onClick={() => setProvince(p)} className={province === p ? 'bg-primary hover:bg-[#0ea5c9]/90' : ''}>
                        {p || 'Todas'}
                      </Button>
                    ))}
                  </div>
                )}
                <Button type="button" variant="outline" onClick={locate} disabled={locating}>
                  {locating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <LocateFixed className="h-4 w-4 mr-2" />}
                  {position ? 'Ordenado pela distância' : 'Loja mais próxima'}
                </Button>
              </div>

              <div className="grid lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)] gap-6 items-start">
                <ul className="space-y-3" aria-label="Lista de lojas">
                  {visible.map((s) => {
                    const active = selected?.id === s.id;
                    const wa = whatsappLink(s.whatsapp || s.phone, `Olá! Tenho uma pergunta sobre a ${s.name}.`);
                    return (
                      <li key={s.id} id={s.id}>
                        <article
                          className={`rounded-2xl border bg-background overflow-hidden transition-all ${active ? 'border-[#0ea5c9] shadow-lg ring-2 ring-[#0ea5c9]/15' : 'border-border hover:border-[#0ea5c9]/40'}`}
                        >
                          <button type="button" className="w-full text-left flex gap-4 p-4" onClick={() => setSelectedId(s.id)} aria-pressed={active}>
                            <div className="h-20 w-24 shrink-0 rounded-xl bg-muted overflow-hidden">
                              {s.image_url ? (
                                <img src={s.image_url} alt="" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center"><Store className="h-7 w-7 text-primary/40" /></div>
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="text-[11px] font-bold uppercase tracking-wider text-primary">{s.province}{s.distance != null && ` · ${s.distance < 10 ? s.distance.toFixed(1) : Math.round(s.distance)} km`}</p>
                              <h2 className="text-base md:text-lg font-semibold leading-snug">{s.name}</h2>
                              <p className="text-sm text-muted-foreground flex items-start gap-1 mt-1"><MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" />{s.address}</p>
                              {s.hours && <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1"><Clock className="h-3.5 w-3.5 shrink-0" />{s.hours}</p>}
                            </div>
                          </button>
                          {active && (
                            <div className="px-4 pb-4 space-y-3">
                              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                                {s.phone && <a href={`tel:${s.phone}`} className="flex items-center gap-1.5 hover:text-primary"><Phone className="h-4 w-4 text-primary" />{displayAngolaPhone(s.phone)}</a>}
                                {s.email && <a href={`mailto:${s.email}`} className="flex items-center gap-1.5 hover:text-primary"><Mail className="h-4 w-4 text-primary" />{s.email}</a>}
                              </div>
                              {s.pickup_enabled && (
                                <p className="text-xs inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 px-2.5 py-1 font-medium">
                                  <PackageCheck className="h-3.5 w-3.5" /> Levantamento de encomendas disponível
                                </p>
                              )}
                              <div className="flex flex-wrap gap-2">
                                <Button asChild size="sm" className="btn-primary">
                                  <a href={directionsUrl(s)} target="_blank" rel="noopener noreferrer"><Navigation className="h-4 w-4 mr-1.5" /> Como chegar</a>
                                </Button>
                                {wa && (
                                  <Button asChild size="sm" variant="outline" className="border-green-500/30 text-green-700 hover:bg-green-50">
                                    <a href={wa} target="_blank" rel="noopener noreferrer"><MessageCircle className="h-4 w-4 mr-1.5" /> WhatsApp</a>
                                  </Button>
                                )}
                                <Button asChild size="sm" variant="ghost">
                                  <a href={mapsUrl(s)} target="_blank" rel="noopener noreferrer">Abrir no mapa</a>
                                </Button>
                              </div>
                            </div>
                          )}
                        </article>
                      </li>
                    );
                  })}
                  {!visible.length && <li className="text-center py-10 text-muted-foreground">Nenhuma loja corresponde à pesquisa.</li>}
                </ul>

                <div className="lg:sticky lg:top-28 rounded-2xl border border-border bg-background overflow-hidden">
                  {embed ? (
                    <iframe
                      key={selected.id}
                      title={`Mapa — ${selected.name}`}
                      src={embed}
                      className="w-full aspect-[4/3] lg:aspect-auto lg:h-[560px] border-0"
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                    />
                  ) : (
                    <div className="aspect-[4/3] flex flex-col items-center justify-center gap-3 text-center p-8 text-muted-foreground">
                      <MapPin className="h-10 w-10 text-primary/50" />
                      <p className="text-sm max-w-xs">{selected ? 'Esta loja ainda não tem coordenadas GPS. Use «Como chegar» para abrir a morada no Google Maps.' : 'Seleccione uma loja.'}</p>
                    </div>
                  )}
                  {selected && (
                    <div className="p-4 border-t border-border flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold truncate">{selected.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{selected.address}</p>
                      </div>
                      <Button asChild size="sm" variant="outline">
                        <a href={directionsUrl(selected)} target="_blank" rel="noopener noreferrer"><Navigation className="h-4 w-4 mr-1.5" /> Direcções</a>
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
