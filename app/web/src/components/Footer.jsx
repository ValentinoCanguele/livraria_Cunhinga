import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Facebook, Instagram, Mail, MapPin, ExternalLink, Sparkles, CheckCircle2, PackageSearch, Truck, CreditCard, Store, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { subscribeNewsletter } from '@/api/EcommerceApi';
import { getPhysicalStores, getPaymentMethods } from '@/api/PlatformApi';
import BrandLogo from '@/components/BrandLogo';
import { BRAND } from '@/lib/brand';
import { motion, AnimatePresence } from 'framer-motion';

// Só caminhos que existem no App.jsx. O separador do perfil vai no URL (/profile?tab=…),
// como no painel, para estes atalhos abrirem já na secção certa.
const DEFAULT_FOOTER_COLUMNS = [
  {
    title: 'Apoio ao Cliente',
    links: [
      { label: 'Rastrear encomenda', url: '/track', internal: true },
      { label: 'Envios e devoluções', url: '/shipping-returns', internal: true },
      { label: 'Perguntas frequentes', url: '/faq', internal: true },
      { label: 'Falar connosco', url: '/contact', internal: true },
      { label: 'Lojas físicas e horários', url: '/lojas', internal: true },
    ],
  },
  {
    title: 'Comprar',
    links: [
      { label: 'Todos os livros', url: '/shop', internal: true },
      { label: 'Coleções', url: '/colecoes', internal: true },
      { label: 'Levantamento na loja', url: '/lojas', internal: true },
      { label: 'Pagamento na entrega', url: '/shipping-returns', internal: true },
      { label: 'Sobre nós', url: '/about', internal: true },
    ],
  },
  {
    title: 'A minha conta',
    links: [
      { label: 'Entrar ou criar conta', url: '/login', internal: true },
      { label: 'As minhas encomendas', url: '/profile?tab=orders', internal: true },
      { label: 'Lista de desejos', url: '/profile?tab=wishlist', internal: true },
      { label: 'Dados e notificações', url: '/profile?tab=settings', internal: true },
      { label: 'Palavra-passe e segurança', url: '/profile?tab=security', internal: true },
    ],
  },
];

function FooterLink({ link }) {
  if (link.internal) {
    return (
      <Link to={link.url} className="block py-1.5 text-sm text-background/70 hover:text-[#22d3ee] transition-colors">
        {link.label}
      </Link>
    );
  }
  return (
    <a href={link.url} target="_blank" rel="noopener noreferrer" className="block py-1.5 text-sm text-background/70 hover:text-[#22d3ee] transition-colors">
      {link.label}
    </a>
  );
}

const Footer = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [stores, setStores] = useState([]);
  const [payments, setPayments] = useState([]);
  const [trackNumber, setTrackNumber] = useState('');
  const [trackEmail, setTrackEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const { toast } = useToast();
  const { settings } = useSiteSettings();

  const tagline = settings.footer_tagline || settings.tagline || BRAND.tagline;
  const copyright = settings.footer_copyright || `© ${new Date().getFullYear()} ${settings.site_name || BRAND.name}. Todos os direitos reservados.`;
  const columns = Array.isArray(settings.footer_columns) && settings.footer_columns.length > 0
    ? settings.footer_columns
    : DEFAULT_FOOTER_COLUMNS;
  const showStores = settings.show_stores_in_footer !== false;

  useEffect(() => {
    if (showStores) {
      getPhysicalStores().then(setStores).catch(() => {});
    }
  }, [showStores]);

  // Os métodos de pagamento que o admin tem activos — os mesmos que o checkout aceita.
  useEffect(() => {
    getPaymentMethods().then((d) => setPayments(d?.methods || [])).catch(() => {});
  }, []);

  // Rastreio rápido: a página /track recebe o número e o email já preenchidos.
  const handleTrackSubmit = (e) => {
    e.preventDefault();
    const num = trackNumber.trim();
    if (!num) return;
    navigate('/track', { state: { orderNumber: num, email: trackEmail.trim() } });
  };

  const freeFrom = Number(settings.shipping_free_threshold) || 0;
  const hasPickup = stores.some((s) => s.pickup_enabled !== false);
  const whatsappDigits = (settings.whatsapp || settings.contact_phone || '').replace(/\D/g, '');

  const handleNewsletterSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitting(true);
    try {
      await subscribeNewsletter(email.trim());
      setSubscribed(true);
      toast({
        title: 'Subscrição realizada!',
        description: 'Obrigado por se juntar à nossa comunidade de leitores.',
      });
      setEmail('');
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erro', description: err.message || 'Não foi possível subscrever.' });
    } finally {
      setSubmitting(false);
    }
  };

  const storesByProvince = stores.reduce((acc, s) => {
    const prov = s.province || 'Outras';
    if (!acc[prov]) acc[prov] = [];
    acc[prov].push(s);
    return acc;
  }, {});

  return (
    <footer className={`text-background ${settings.ui_glass_enabled !== false ? 'glass-surface-dark' : 'bg-foreground'}`}>
      <div className="container-custom section-spacing">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-12 mb-12">
          <div className="lg:col-span-4">
            <BrandLogo linkTo="/" variant="light" />
            <p className="text-background/70 text-sm mb-6">
              {tagline}. Literatura cristã, educação e inspiração para toda a família.
            </p>
            <div className="flex gap-4">
              {settings.facebook && (
                <a href={settings.facebook} target="_blank" rel="noopener noreferrer" className="text-background/60 hover:text-[#22d3ee] transition-colors">
                  <Facebook className="h-5 w-5" />
                </a>
              )}
              {settings.instagram && (
                <a href={settings.instagram} target="_blank" rel="noopener noreferrer" className="text-background/60 hover:text-[#22d3ee] transition-colors">
                  <Instagram className="h-5 w-5" />
                </a>
              )}
            </div>
            {(settings.contact_email || settings.contact_phone || settings.whatsapp) && (
              <div className="text-sm text-background/60 mt-4 space-y-1">
                {settings.contact_email && <p>{settings.contact_email}</p>}
                {settings.contact_phone && <p>{settings.contact_phone}</p>}
                {settings.whatsapp && settings.whatsapp !== settings.contact_phone && <p>{settings.whatsapp}</p>}
              </div>
            )}
          </div>

          {columns.map((col) => (
            <div key={col.title} className="lg:col-span-2">
              <h4 className="font-semibold mb-4 text-background">{col.title}</h4>
              <ul className="space-y-1">
                {(col.links || []).map((link) => (
                  <li key={link.label}><FooterLink link={link} /></li>
                ))}
              </ul>
            </div>
          ))}

          <div className="lg:col-span-4">
            <div className="relative rounded-2xl bg-white/5 border border-white/10 p-6 shadow-xl backdrop-blur-md overflow-hidden">
              <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-[#0ea5c9]/20 rounded-full blur-xl pointer-events-none" />
              
              <AnimatePresence mode="wait">
                {!subscribed ? (
                  <motion.div
                    key="form"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-4"
                  >
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 px-2.5 items-center justify-center rounded-full text-[10px] font-bold bg-[#0ea5c9]/20 text-[#22d3ee] border border-[#0ea5c9]/30">
                        <Sparkles className="h-3 w-3 mr-1" /> OFERTA
                      </span>
                      <span className="text-xs text-[#22d3ee] font-medium">-10% no 1º livro</span>
                    </div>

                    <div>
                      <h4 className="text-lg font-extrabold text-background flex items-center gap-2">
                        Newsletter Premium
                      </h4>
                      <p className="text-xs text-background/70 mt-1">
                        Junte-se à nossa lista exclusiva para receber lançamentos, devocionais semanais e ofertas especiais.
                      </p>
                    </div>

                    <form onSubmit={handleNewsletterSubmit} className="space-y-3">
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-background/40" />
                        <Input
                          type="email"
                          placeholder="Digite o seu melhor email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                          className="bg-background/5 border-background/10 text-background placeholder:text-background/40 pl-10 focus-visible:ring-[#0ea5c9] focus-visible:border-[#0ea5c9] h-11 rounded-xl"
                        />
                      </div>
                      <Button 
                        type="submit" 
                        className="w-full bg-primary hover:bg-[#0891b2] text-white font-bold h-11 rounded-xl shadow-[0_4px_14px_rgba(14,165,201,0.3)] hover:shadow-[0_6px_20px_rgba(14,165,201,0.4)] transition-all flex items-center justify-center cursor-pointer" 
                        disabled={submitting}
                      >
                        <Mail className="h-4 w-4 mr-2" />
                        {submitting ? 'A processar...' : 'Subscrever Agora'}
                      </Button>
                    </form>

                    <p className="text-[10px] text-background/40 text-center">
                      🔒 Respeitamos a sua privacidade. Cancele com um clique.
                    </p>
                  </motion.div>
                ) : (
                  <motion.div
                    key="success"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center py-6 space-y-4"
                  >
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 mb-2 border border-emerald-500/30">
                      <CheckCircle2 className="h-6 w-6" />
                    </div>
                    <div>
                      <h4 className="text-lg font-bold text-background">Inscrição Confirmada!</h4>
                      <p className="text-xs text-background/70 mt-2 leading-relaxed">
                        Seja bem-vindo(a) à nossa comunidade. Enviámos um cupão de **10% de desconto** para a sua caixa de entrada.
                      </p>
                    </div>
                    <Button 
                      variant="outline" 
                      onClick={() => setSubscribed(false)} 
                      className="text-xs h-8 border-white/20 text-background hover:bg-white/10 rounded-lg"
                    >
                      Inscrever outro email
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Serviços: o que a loja faz mesmo, com os valores reais das Configurações, das
            lojas e dos métodos de pagamento activos. */}
        <div className="grid gap-8 lg:grid-cols-12 mb-12 border-t border-background/20 pt-10">
          <div className="lg:col-span-5">
            <h4 className="font-semibold mb-2 text-background flex items-center gap-2">
              <PackageSearch className="h-4 w-4 text-[#22d3ee]" aria-hidden="true" />
              Rastrear a sua encomenda
            </h4>
            <p className="text-sm text-background/60 mb-4">
              Indique o número da encomenda e o email usado na compra.
            </p>
            <form onSubmit={handleTrackSubmit} className="flex flex-col sm:flex-row gap-2">
              <Input
                value={trackNumber}
                onChange={(e) => setTrackNumber(e.target.value)}
                placeholder="Nº da encomenda"
                aria-label="Número da encomenda"
                className="bg-background/10 border-background/20 text-background placeholder:text-background/40"
              />
              <Input
                type="email"
                value={trackEmail}
                onChange={(e) => setTrackEmail(e.target.value)}
                placeholder="Email da compra"
                aria-label="Email usado na compra"
                className="bg-background/10 border-background/20 text-background placeholder:text-background/40"
              />
              <Button type="submit" className="btn-primary shrink-0" disabled={!trackNumber.trim()}>
                Seguir
              </Button>
            </form>
          </div>

          <div className="lg:col-span-4">
            <h4 className="font-semibold mb-4 text-background">Como compra e recebe</h4>
            <ul className="space-y-3 text-sm text-background/70">
              <li className="flex gap-3">
                <Truck className="h-4 w-4 mt-0.5 text-[#22d3ee] shrink-0" aria-hidden="true" />
                <span>
                  Entrega em todo o país
                  {freeFrom > 0 && <> · portes grátis acima de {freeFrom.toLocaleString('pt-AO')} Kz</>}
                </span>
              </li>
              {hasPickup && (
                <li className="flex gap-3">
                  <Store className="h-4 w-4 mt-0.5 text-[#22d3ee] shrink-0" aria-hidden="true" />
                  <span>Levantamento nas lojas, sem portes</span>
                </li>
              )}
              <li className="flex gap-3">
                <CheckCircle2 className="h-4 w-4 mt-0.5 text-[#22d3ee] shrink-0" aria-hidden="true" />
                <span>Confirmação de recepção com assinatura digital</span>
              </li>
              {whatsappDigits && (
                <li className="flex gap-3">
                  <MessageCircle className="h-4 w-4 mt-0.5 text-[#22d3ee] shrink-0" aria-hidden="true" />
                  <a
                    href={`https://wa.me/${whatsappDigits}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="-my-1.5 inline-block py-1.5 hover:text-[#22d3ee] transition-colors"
                  >
                    Falar por WhatsApp
                  </a>
                </li>
              )}
            </ul>
          </div>

          {payments.length > 0 && (
            <div className="lg:col-span-3">
              <h4 className="font-semibold mb-4 text-background flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-[#22d3ee]" aria-hidden="true" />
                Pagamentos aceites
              </h4>
              <ul className="flex flex-wrap gap-2">
                {payments.map((m) => (
                  <li
                    key={m.id || m.code}
                    className="rounded-md border border-background/20 bg-background/10 px-2.5 py-1 text-xs text-background/80"
                  >
                    {m.name}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {showStores && stores.length > 0 && (
          <div className="mb-12 border-t border-background/20 pt-10">
            <h4 className="font-semibold text-lg mb-6 text-background flex items-center gap-2">
              <MapPin className="h-5 w-5 text-[#22d3ee]" />
              As Nossas Lojas
              <Link to="/lojas" className="-my-1.5 ml-auto inline-block py-1.5 text-xs font-normal text-[#22d3ee] hover:underline">Ver todas com mapa</Link>
            </h4>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {Object.entries(storesByProvince).map(([province, list]) => (
                <div key={province}>
                  <p className="text-xs font-semibold uppercase tracking-wider text-[#22d3ee] mb-3">{province}</p>
                  <div className="space-y-4">
                    {list.map((store) => (
                      <div key={store.id} className="rounded-xl overflow-hidden bg-background/5 border border-background/10">
                        {store.image_url && (
                          <img src={store.image_url} alt={store.name} className="w-full h-28 object-cover" />
                        )}
                        <div className="p-3">
                          <p className="font-medium text-sm">{store.name}</p>
                          <p className="text-xs text-background/60 mt-1">{store.address}</p>
                          {store.hours && <p className="text-xs text-background/50 mt-1">{store.hours}</p>}
                          {store.maps_url && (
                            <a
                              href={store.maps_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="-mb-1.5 inline-flex items-center gap-1 py-1.5 text-xs text-[#22d3ee] hover:underline mt-0.5"
                            >
                              <ExternalLink className="h-3 w-3" /> Ver no mapa
                            </a>
                          )}
                          {settings.google_maps_embed_key && store.latitude && store.longitude && (
                            <div className="mt-2 rounded-lg overflow-hidden border border-background/10 aspect-video">
                              <iframe
                                title={`Mapa ${store.name}`}
                                src={`https://www.google.com/maps/embed/v1/place?key=${settings.google_maps_embed_key}&q=${store.latitude},${store.longitude}&zoom=15`}
                                className="w-full h-full border-0"
                                loading="lazy"
                                referrerPolicy="no-referrer-when-downgrade"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="border-t border-background/20 pt-8 text-center">
          <p className="text-sm text-background/50">{copyright}</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
