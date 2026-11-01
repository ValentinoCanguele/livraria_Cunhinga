import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ChevronDown, BookOpen, Star, PackageCheck, Layers, Truck, Search, Info, Mail, HelpCircle,
  RotateCcw, MessageCircle, MapPin, ShoppingBag, Image as ImageIcon, Settings,
  Users, CreditCard, Plug, BarChart3, ArrowRight,
} from 'lucide-react';
import { getFeaturedProducts, getProducts } from '@/api/EcommerceApi';
import { getCollections, getPhysicalStores } from '@/api/PlatformApi';
import { SHOWCASE_CATEGORIES, CATEGORY_SHOP_FILTERS } from '@/lib/catalogCategories';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { useAuth } from '@/hooks/useAuth';

const OPEN_DELAY = 90;
const CLOSE_DELAY = 160;

function categoryLink(cat) {
  const filter = CATEGORY_SHOP_FILTERS[cat.id];
  return filter ? `/shop?${filter}` : `/shop?category=${encodeURIComponent(cat.title)}`;
}

/** Dados das imagens dos painéis, carregados uma vez quando o menu abre pela primeira vez. */
function useMegaData(enabled) {
  const [data, setData] = useState({ books: [], collections: [], stores: [], loaded: false });
  useEffect(() => {
    if (!enabled || data.loaded) return;
    let alive = true;
    Promise.all([
      // Destaques primeiro; se houver menos de 4, completa com outros livros com stock.
      getFeaturedProducts(4).then(async (r) => {
        const featured = r.products || [];
        if (featured.length >= 4) return featured;
        const { products = [] } = await getProducts({ limit: 12 }).catch(() => ({}));
        const extra = products.filter((p) => p.image && !featured.some((f) => f.id === p.id) && p.purchasable !== false);
        return [...featured, ...extra].slice(0, 4);
      }).catch(() => []),
      getCollections().catch(() => []),
      getPhysicalStores().catch(() => []),
    ]).then(([books, collections, stores]) => {
      if (alive) setData({ books, collections, stores, loaded: true });
    });
    return () => { alive = false; };
  }, [enabled, data.loaded]);
  return data;
}

function ImageCard({ to, image, title, subtitle, onNavigate, tall = false }) {
  return (
    <Link
      to={to}
      onClick={onNavigate}
      className="group/card block rounded-xl overflow-hidden border border-border bg-muted/30 hover:border-[#0ea5c9]/50 hover:shadow-md transition-all"
    >
      <div className={`${tall ? 'aspect-[3/4]' : 'aspect-[4/3]'} bg-muted overflow-hidden`}>
        {image ? (
          <img
            src={image}
            alt=""
            loading="lazy"
            className="w-full h-full object-cover transition-transform duration-500 group-hover/card:scale-105"
            onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[#0ea5c9]/40"><BookOpen className="h-8 w-8" /></div>
        )}
      </div>
      <div className="p-2.5">
        <p className="text-xs font-semibold text-foreground line-clamp-2 leading-snug">{title}</p>
        {subtitle && <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{subtitle}</p>}
      </div>
    </Link>
  );
}

function ShortcutList({ title, items, onNavigate }) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-3">{title}</p>
      <ul className="space-y-1">
        {items.map(({ to, href, label, description, icon: Icon }) => {
          const content = (
            <>
              <span className="mt-0.5 h-8 w-8 shrink-0 rounded-lg bg-[#0ea5c9]/10 text-[#0ea5c9] flex items-center justify-center">
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-foreground">{label}</span>
                {description && <span className="block text-xs text-muted-foreground leading-snug">{description}</span>}
              </span>
            </>
          );
          const cls = 'flex items-start gap-3 rounded-lg p-2 hover:bg-muted transition-colors';
          return (
            <li key={label}>
              {href ? (
                <a href={href} className={cls} onClick={onNavigate} target={href.startsWith('http') ? '_blank' : undefined} rel="noreferrer">{content}</a>
              ) : (
                <Link to={to} className={cls} onClick={onNavigate}>{content}</Link>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function PanelLayout({ heading, lead, footerLink, children, aside }) {
  return (
    <div className="grid lg:grid-cols-[1fr_300px] gap-0">
      <div className="p-6 min-w-0">
        <div className="flex items-end justify-between gap-4 mb-4">
          <div>
            <p className="text-lg font-bold text-foreground font-serif">{heading}</p>
            {lead && <p className="text-sm text-muted-foreground">{lead}</p>}
          </div>
          {footerLink}
        </div>
        {children}
      </div>
      <aside className="p-6 bg-muted/40 border-l border-border">{aside}</aside>
    </div>
  );
}

const SeeAll = ({ to, label, onNavigate }) => (
  <Link to={to} onClick={onNavigate} className="text-sm font-semibold text-[#0ea5c9] hover:underline inline-flex items-center gap-1 shrink-0">
    {label} <ArrowRight className="h-3.5 w-3.5" />
  </Link>
);

export default function MegaMenu() {
  const location = useLocation();
  const { settings } = useSiteSettings();
  const { canAccessAdmin } = useAuth();
  const [open, setOpen] = useState(null);
  const [everOpened, setEverOpened] = useState(false);
  const timer = useRef(null);
  const data = useMegaData(everOpened);

  const close = () => { clearTimeout(timer.current); setOpen(null); };
  const schedule = (id, delay) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setOpen(id);
      if (id) setEverOpened(true);
    }, delay);
  };

  useEffect(() => close(), [location.pathname, location.search]);
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); clearTimeout(timer.current); };
  }, []);

  const whatsapp = (settings.whatsapp || settings.contact_phone || '').replace(/\D/g, '');

  const menus = [
    {
      id: 'livros',
      label: 'Livros',
      to: '/shop',
      panel: (
        <PanelLayout
          heading="Livros em destaque"
          lead="Escolhas da livraria para começar"
          footerLink={<SeeAll to="/shop" label="Ver todo o catálogo" onNavigate={close} />}
          aside={(
            <ShortcutList
              title="Atalhos"
              onNavigate={close}
              items={[
                { to: '/shop?featuredOnly=true', label: 'Em destaque', description: 'Os livros recomendados', icon: Star },
                { to: '/shop?inStockOnly=true', label: 'Disponíveis agora', description: 'Com stock para envio', icon: PackageCheck },
                { to: '/colecoes', label: 'Coleções', description: 'Séries e temas organizados', icon: Layers },
                { to: '/track', label: 'Rastrear encomenda', description: 'Estado e entrega', icon: Truck },
              ]}
            />
          )}
        >
          <div className="grid grid-cols-[minmax(0,2.3fr)_minmax(0,1fr)] gap-6">
            <div className="grid grid-cols-4 gap-4">
              {(data.books.length ? data.books : Array.from({ length: 4 }, () => null)).slice(0, 4).map((p, i) => (
                p ? (
                  <ImageCard key={p.id} to={`/product/${p.id}`} image={p.image} title={p.title} subtitle={p.variants?.[0]?.price_formatted} onNavigate={close} tall />
                ) : (
                  <div key={i} className="aspect-[3/4] rounded-xl bg-muted animate-pulse" />
                )
              ))}
            </div>
            <div className="border-l border-border pl-5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Categorias</p>
              <ul className="space-y-0.5">
                {SHOWCASE_CATEGORIES.filter((c) => !['stock', 'destaques'].includes(c.id)).map((c) => (
                  <li key={c.id}>
                    <Link to={categoryLink(c)} onClick={close} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-foreground hover:bg-muted whitespace-nowrap">
                      <span className="h-2 w-2 rounded-full shrink-0" style={{ background: c.accent || '#0ea5c9' }} />
                      {c.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </PanelLayout>
      ),
    },
    {
      id: 'colecoes',
      label: 'Coleções',
      to: '/colecoes',
      panel: (
        <PanelLayout
          heading="Coleções"
          lead="Livros agrupados por tema e autor"
          footerLink={<SeeAll to="/colecoes" label="Todas as coleções" onNavigate={close} />}
          aside={(
            <ShortcutList
              title="Explorar"
              onNavigate={close}
              items={[
                { to: '/shop', label: 'Pesquisa avançada', description: 'Autor, ISBN, editora e preço', icon: Search },
                { to: '/shop?featuredOnly=true', label: 'Destaques', description: 'Seleção da equipa', icon: Star },
                { to: '/shop?category=Colportagem', label: 'Colportagem', description: 'Livros para evangelismo', icon: BookOpen },
              ]}
            />
          )}
        >
          <div className="grid grid-cols-4 gap-4">
            {(data.collections.length ? data.collections : Array.from({ length: 4 }, () => null)).slice(0, 4).map((c, i) => (
              c ? (
                <ImageCard key={c.id} to={`/colecoes/${c.slug || c.id}`} image={c.cover} title={c.title} subtitle={c.marketing_tagline} onNavigate={close} />
              ) : (
                <div key={i} className="aspect-[4/3] rounded-xl bg-muted animate-pulse" />
              )
            ))}
          </div>
        </PanelLayout>
      ),
    },
    {
      id: 'ajuda',
      label: 'Ajuda',
      to: '/faq',
      panel: (
        <PanelLayout
          heading="Lojas e apoio"
          lead="Visite-nos ou fale connosco"
          footerLink={<SeeAll to="/lojas" label="Ver todas as lojas" onNavigate={close} />}
          aside={(
            <ShortcutList
              title="Informação"
              onNavigate={close}
              items={[
                { to: '/lojas', label: 'Lojas físicas', description: 'Moradas, horários e mapa', icon: MapPin },
                { to: '/about', label: 'Sobre nós', icon: Info },
                { to: '/faq', label: 'Perguntas frequentes', icon: HelpCircle },
                { to: '/shipping-returns', label: 'Envios e devoluções', icon: RotateCcw },
                { to: '/contact', label: 'Contacto', icon: Mail },
                ...(whatsapp ? [{ href: `https://wa.me/${whatsapp}`, label: 'WhatsApp', description: settings.whatsapp || settings.contact_phone, icon: MessageCircle }] : []),
              ]}
            />
          )}
        >
          {data.stores.length ? (
            <div className="grid grid-cols-3 gap-4">
              {data.stores.slice(0, 3).map((s) => (
                <ImageCard key={s.id} to={`/lojas#${s.id}`} image={s.image_url} title={s.name} subtitle={[s.address, s.province].filter(Boolean).join(' · ')} onNavigate={close} />
              ))}
              {data.stores.length < 3 && (
                <Link
                  to="/track"
                  onClick={close}
                  className="rounded-xl border border-border bg-gradient-to-br from-[#0ea5c9]/15 to-transparent p-5 flex flex-col justify-between hover:border-[#0ea5c9]/50 hover:shadow-md transition-all"
                >
                  <span className="h-10 w-10 rounded-lg bg-[#0ea5c9] text-white flex items-center justify-center"><Truck className="h-5 w-5" /></span>
                  <span>
                    <span className="block text-sm font-semibold text-foreground">Rastrear encomenda</span>
                    <span className="block text-xs text-muted-foreground mt-0.5">Número da encomenda e email da compra</span>
                  </span>
                </Link>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              <MapPin className="h-6 w-6 mx-auto mb-2 text-[#0ea5c9]" />
              {settings.contact_address || 'Luanda, Angola'}
            </div>
          )}
        </PanelLayout>
      ),
    },
  ];

  if (canAccessAdmin) {
    const tiles = [
      { tab: 'books', label: 'Livros', icon: BookOpen },
      { tab: 'orders', label: 'Encomendas', icon: ShoppingBag },
      { tab: 'slides', label: 'Slider', icon: ImageIcon },
      { tab: 'collections', label: 'Coleções', icon: Layers },
    ];
    menus.push({
      id: 'gestao',
      label: 'Gestão',
      to: '/admin',
      panel: (
        <PanelLayout
          heading="Gestão da livraria"
          lead="Acesso rápido às áreas do painel"
          footerLink={<SeeAll to="/admin" label="Abrir painel" onNavigate={close} />}
          aside={(
            <ShortcutList
              title="Sistema"
              onNavigate={close}
              items={[
                { to: '/admin?tab=settings', label: 'Configurações', description: 'Marca, loja, email e PWA', icon: Settings },
                { to: '/admin?tab=users', label: 'Utilizadores', description: 'Papéis e permissões', icon: Users },
                { to: '/admin?tab=payments', label: 'Pagamentos', description: 'Métodos e instruções', icon: CreditCard },
                { to: '/admin?tab=apps', label: 'Integrações', description: 'WhatsApp, Drive, SMTP', icon: Plug },
                { to: '/admin?tab=vendas-huambo', label: 'Painel de Vendas', description: 'Vendas de cada loja', icon: BarChart3 },
              ]}
            />
          )}
        >
          <div className="grid grid-cols-4 gap-4">
            {tiles.map(({ tab, label, icon: Icon }) => (
              <Link
                key={tab}
                to={`/admin?tab=${tab}`}
                onClick={close}
                className="group/tile rounded-xl border border-border p-4 bg-gradient-to-br from-[#0ea5c9]/10 to-transparent hover:border-[#0ea5c9]/50 hover:shadow-md transition-all"
              >
                <span className="h-10 w-10 rounded-lg bg-[#0ea5c9] text-white flex items-center justify-center mb-6 transition-transform group-hover/tile:scale-110">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="block text-sm font-semibold text-foreground">{label}</span>
              </Link>
            ))}
          </div>
        </PanelLayout>
      ),
    });
  }

  const active = menus.find((m) => m.id === open);

  return (
    <div onMouseLeave={() => schedule(null, CLOSE_DELAY)}>
      <nav className="flex items-center gap-1" aria-label="Navegação Principal">
        <Link
          to="/"
          className={`px-3 py-2 rounded-full text-sm font-semibold transition-colors hover:text-[#22d3ee] ${location.pathname === '/' ? 'text-[#22d3ee]' : 'text-white/80'}`}
          onMouseEnter={() => schedule(null, CLOSE_DELAY)}
        >
          Início
        </Link>
        {menus.map((m) => {
          const current = location.pathname === m.to || (m.to !== '/' && location.pathname.startsWith(m.to));
          return (
            <div key={m.id} className="flex items-center" onMouseEnter={() => schedule(m.id, open ? 0 : OPEN_DELAY)}>
              <Link
                to={m.to}
                className={`pl-3 pr-1 py-2 text-sm font-semibold transition-colors hover:text-[#22d3ee] ${current || open === m.id ? 'text-[#22d3ee]' : 'text-white/80'}`}
                onFocus={() => schedule(m.id, 0)}
              >
                {m.label}
              </Link>
              <button
                type="button"
                className="pr-2 py-2 text-white/60 hover:text-[#22d3ee]"
                aria-expanded={open === m.id}
                aria-controls="mega-menu-panel"
                aria-label={`${open === m.id ? 'Fechar' : 'Abrir'} menu ${m.label}`}
                onClick={() => (open === m.id ? close() : schedule(m.id, 0))}
              >
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open === m.id ? 'rotate-180' : ''}`} aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </nav>

      <AnimatePresence>
        {active && (
          <motion.div
            key="mega"
            id="mega-menu-panel"
            role="region"
            aria-label={`Menu ${active.label}`}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="absolute left-0 right-0 top-full z-50 pt-0"
            onMouseEnter={() => clearTimeout(timer.current)}
          >
            <div className="container-custom">
              <div className="rounded-b-2xl border border-t-0 border-border bg-background text-foreground shadow-2xl overflow-hidden">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={active.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.12 }}
                  >
                    {active.panel}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
