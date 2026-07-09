import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Facebook, Instagram, Mail, MapPin, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { subscribeNewsletter } from '@/api/EcommerceApi';
import { getPhysicalStores } from '@/api/PlatformApi';
import BrandLogo from '@/components/BrandLogo';
import { BRAND } from '@/lib/brand';

const DEFAULT_FOOTER_COLUMNS = [
  {
    title: 'Apoio ao Cliente',
    links: [
      { label: 'FAQ', url: '/faq', internal: true },
      { label: 'Envios e Devoluções', url: '/shipping-returns', internal: true },
      { label: 'Rastrear Encomenda', url: '/track', internal: true },
      { label: 'Contacte-nos', url: '/contact', internal: true },
    ],
  },
  {
    title: 'Loja',
    links: [
      { label: 'Explorar Livros', url: '/shop', internal: true },
      { label: 'Coleções', url: '/colecoes', internal: true },
      { label: 'Sobre Nós', url: '/about', internal: true },
    ],
  },
  {
    title: 'Conta',
    links: [
      { label: 'Entrar / Registar', url: '/login', internal: true },
      { label: 'Minha Conta', url: '/profile', internal: true },
    ],
  },
];

function FooterLink({ link }) {
  if (link.internal) {
    return (
      <Link to={link.url} className="text-sm text-background/70 hover:text-[#22d3ee] transition-colors">
        {link.label}
      </Link>
    );
  }
  return (
    <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-sm text-background/70 hover:text-[#22d3ee] transition-colors">
      {link.label}
    </a>
  );
}

const Footer = () => {
  const [email, setEmail] = useState('');
  const [stores, setStores] = useState([]);
  const [submitting, setSubmitting] = useState(false);
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

  const handleNewsletterSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitting(true);
    try {
      await subscribeNewsletter(email.trim());
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
              <ul className="space-y-2">
                {(col.links || []).map((link) => (
                  <li key={link.label}><FooterLink link={link} /></li>
                ))}
              </ul>
            </div>
          ))}

          <div className="lg:col-span-4">
            <h4 className="font-semibold mb-4 text-background">Newsletter</h4>
            <p className="text-sm text-background/70 mb-4">
              Receba novidades sobre lançamentos e promoções
            </p>
            <form onSubmit={handleNewsletterSubmit} className="space-y-2">
              <Input
                type="email"
                placeholder="O seu email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-background/10 border-background/20 text-background placeholder:text-background/40"
              />
              <Button type="submit" className="w-full bg-[#0ea5c9] hover:bg-[#0891b2] text-white" disabled={submitting}>
                <Mail className="h-4 w-4 mr-2" />
                {submitting ? 'A subscrever...' : 'Subscrever'}
              </Button>
            </form>
          </div>
        </div>

        {showStores && stores.length > 0 && (
          <div className="mb-12 border-t border-background/20 pt-10">
            <h4 className="font-semibold text-lg mb-6 text-background flex items-center gap-2">
              <MapPin className="h-5 w-5 text-[#22d3ee]" />
              As Nossas Lojas
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
                              className="inline-flex items-center gap-1 text-xs text-[#22d3ee] hover:underline mt-2"
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
