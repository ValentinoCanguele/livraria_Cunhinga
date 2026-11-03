import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Helmet } from 'react-helmet';
import { MapPin, Clock, Phone, Mail, Navigation, MessageCircle, PackageCheck, Store, Search, LocateFixed, Loader2, Radio, X, AlertCircle } from 'lucide-react';
import Header from '@/components/Header.jsx';
import Footer from '@/components/Footer.jsx';
import ShoppingCart from '@/components/ShoppingCart.jsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getPhysicalStores } from '@/api/PlatformApi';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { pageTitle } from '@/lib/brand';
import { displayAngolaPhone } from '@/lib/angolaPhone';
import { mapsUrl, directionsUrl, mapEmbedUrl, whatsappLink } from '@/lib/stores';
import PageBannerSlider from '@/components/PageBannerSlider';
import StoreThumb from '@/components/StoreThumb';
import useLocalizacaoAoVivo from '@/hooks/useLocalizacaoAoVivo';
import { formatarDistancia, ordenarPorDistancia, precisaoLegivel } from '@/lib/localizacao';

export default function StoresPage() {
  const { settings } = useSiteSettings();
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [stores, setStores] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [query, setQuery] = useState('');
  const [province, setProvince] = useState('');
  const { estado: estadoGps, posicao, erro: erroGps, comecar, parar } = useLocalizacaoAoVivo();

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
    return posicao ? ordenarPorDistancia(list, posicao) : list;
  }, [stores, query, province, posicao]);

  const selected = visible.find((s) => s.id === selectedId) || visible[0] || null;
  const embed = selected ? mapEmbedUrl(selected, settings.google_maps_embed_key) : '';

  // A primeira leitura escolhe a loja mais perto. As seguintes não voltam a escolher: quem
  // já abriu outra loja na lista não quer ser arrastado de volta a cada passo que dá.
  const jaEscolheuPorGps = useRef(false);
  useEffect(() => {
    if (!posicao) { jaEscolheuPorGps.current = false; return; }
    if (jaEscolheuPorGps.current) return;
    if (visible[0]) { setSelectedId(visible[0].id); jaEscolheuPorGps.current = true; }
  }, [posicao, visible]);

  const maisPerto = posicao && visible[0]?.distancia != null ? visible[0].id : null;

  return (
    <>
      <Helmet>
        <title>{pageTitle('Lojas físicas')}</title>
        <meta name="description" content="Moradas, horários, contactos e mapa das lojas da Livraria Adventista em Angola." />
      </Helmet>
      <Header onCartOpen={() => setIsCartOpen(true)} />
      <ShoppingCart isCartOpen={isCartOpen} setIsCartOpen={setIsCartOpen} />

      <PageBannerSlider contentClassName="text-left">
        <p className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-white/80"><Store className="h-4 w-4" /> Lojas físicas</p>
        <h1 className="mb-3 font-serif text-3xl font-bold leading-tight sm:text-4xl md:text-5xl">Visite-nos</h1>
        <p className="max-w-xl text-sm text-white/85 sm:text-base">
          Encontre a loja mais perto de si, veja o horário e combine o levantamento das suas encomendas.
        </p>
      </PageBannerSlider>

      <main className="bg-muted/20 min-h-screen">
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
                {estadoGps === 'activo' ? (
                  <Button type="button" variant="outline" onClick={parar} className="border-emerald-500/40 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300">
                    <X className="h-4 w-4 mr-2" /> Parar de me localizar
                  </Button>
                ) : (
                  <Button type="button" variant="outline" onClick={comecar} disabled={estadoGps === 'a-pedir'}>
                    {estadoGps === 'a-pedir'
                      ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      : <LocateFixed className="h-4 w-4 mr-2" />}
                    {estadoGps === 'a-pedir' ? 'À procura do sinal…' : 'Loja mais perto de mim'}
                  </Button>
                )}
              </div>

              {/* O que o GPS está a fazer, dito por extenso. Antes, negar a autorização
                  deixava um botão que aparentemente não respondia. */}
              {estadoGps === 'activo' && (
                <div
                  className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-200"
                  role="status"
                >
                  <Radio className="h-4 w-4 shrink-0 animate-pulse" aria-hidden />
                  <span className="font-medium">Lojas ordenadas da mais perto para a mais longe.</span>
                  <span className="text-emerald-700/80 dark:text-emerald-300/80">
                    As distâncias acompanham-no enquanto se desloca
                    {precisaoLegivel(posicao?.precisao) ? ` · sinal ${precisaoLegivel(posicao.precisao)}` : ''}.
                  </span>
                </div>
              )}
              {(estadoGps === 'erro' || estadoGps === 'indisponivel') && (
                <div
                  className="mb-6 flex flex-wrap items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-200"
                  role="alert"
                >
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" aria-hidden />
                  {/* Em telemóvel o botão passa para a linha de baixo: ao lado do texto,
                      sobrava-lhe metade da largura e a mensagem saía em sete linhas. */}
                  <span className="min-w-0 basis-full sm:basis-0 sm:flex-1">{erroGps}</span>
                  {estadoGps === 'erro' && (
                    <Button type="button" size="sm" variant="outline" onClick={comecar}>Tentar outra vez</Button>
                  )}
                </div>
              )}

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
                            <StoreThumb store={s} className="h-20 w-24 shrink-0 rounded-xl" />
                            <div className="min-w-0">
                              {/* A distância ganha lugar próprio em vez de ir pendurada na
                                  província, onde se lia como parte do nome do sítio. */}
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                <p className="text-[11px] font-bold uppercase tracking-wider text-primary">{s.province}</p>
                                {formatarDistancia(s.distancia) && (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                                    <Navigation className="h-3 w-3" aria-hidden />
                                    {formatarDistancia(s.distancia)}
                                  </span>
                                )}
                                {maisPerto === s.id && (
                                  <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                                    A mais perto de si
                                  </span>
                                )}
                              </div>
                              <h2 className="text-base md:text-lg font-semibold leading-snug">{s.name}</h2>
                              <p className="text-sm text-muted-foreground flex items-start gap-1 mt-1"><MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" />{s.address}</p>
                              {s.hours && <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1"><Clock className="h-3.5 w-3.5 shrink-0" />{s.hours}</p>}
                            </div>
                          </button>
                          {active && (
                            <div className="px-4 pb-4 space-y-3">
                              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                                {s.phone && <a href={`tel:${s.phone}`} className="flex items-center gap-1.5 py-1 hover:text-primary"><Phone className="h-4 w-4 text-primary" />{displayAngolaPhone(s.phone)}</a>}
                                {s.email && <a href={`mailto:${s.email}`} className="flex items-center gap-1.5 py-1 hover:text-primary"><Mail className="h-4 w-4 text-primary" />{s.email}</a>}
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
