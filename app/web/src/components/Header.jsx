import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Search, ShoppingCart, Menu, X, User, ShoppingBag, LogOut, LayoutDashboard, BarChart3 } from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useHeaderReveal } from '@/hooks/useHeaderReveal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCart } from '@/hooks/useCart';
import { useAuth } from '@/hooks/useAuth';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import BrandLogo from '@/components/BrandLogo';
import MegaMenu from '@/components/header/MegaMenu';
import UserAvatar from '@/components/UserAvatar';
import { UserMenu, GuestAuthButton } from '@/components/UserMenu';
import { getUserDisplayName, getUserFirstName } from '@/lib/userUtils';

// Menu do telemóvel: as mesmas secções do mega menu, em lista.
const NAV_LINKS = [
  { to: '/', label: 'Início' },
  { to: '/shop', label: 'Livros' },
  { to: '/colecoes', label: 'Coleções' },
  { to: '/lojas', label: 'Lojas' },
  { to: '/about', label: 'Sobre' },
  { to: '/faq', label: 'Ajuda' },
  { to: '/contact', label: 'Contacto' },
];

const OPEN_HEADER_SEARCH_EVENT = 'livraria:open-header-search';

export const openHeaderSearch = () => {
  window.dispatchEvent(new Event(OPEN_HEADER_SEARCH_EVENT));
};

const Header = ({ onCartOpen, pinned = false }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { cartItems } = useCart();
  const { user, isAuthed, isAdmin, canAccessAdmin, logout } = useAuth();
  const { settings } = useSiteSettings();
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [hasFocus, setHasFocus] = useState(false);
  const searchInputRef = useRef(null);
  const headerRef = useRef(null);

  const revealed = useHeaderReveal(pinned || mobileOpen || searchOpen || hasFocus);

  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  useEffect(() => {
    setSearch(new URLSearchParams(location.search).get('search') || '');
  }, [location.search]);

  useEffect(() => {
    const handleOpenSearch = () => {
      setSearchOpen(true);
      setMobileOpen(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    window.addEventListener(OPEN_HEADER_SEARCH_EVENT, handleOpenSearch);
    return () => window.removeEventListener(OPEN_HEADER_SEARCH_EVENT, handleOpenSearch);
  }, []);

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);

  // As barras que colam por baixo (as letras do catálogo, os filtros da loja) precisam de
  // saber onde o cabeçalho acaba, senão colam ao topo e ficam escondidas por trás dele.
  // Antes `--header-offset` era lido em dois sítios mas nunca escrito, e cada um ficava
  // pelo seu palpite — 64px num, 0px no outro. Agora é a medida real, que muda quando a
  // pesquisa ou o menu abrem.
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return undefined;
    const publish = () => {
      document.documentElement.style.setProperty('--header-offset', `${Math.round(el.offsetHeight)}px`);
    };
    publish();
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(publish) : null;
    observer?.observe(el);
    window.addEventListener('resize', publish);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', publish);
      document.documentElement.style.removeProperty('--header-offset');
    };
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    const query = search.trim();
    if (!query) return;
    navigate(`/shop?search=${encodeURIComponent(query)}`);
    setMobileOpen(false);
    setSearchOpen(false);
  };

  const closeMobile = () => setMobileOpen(false);

  const handleLogout = () => {
    logout();
    closeMobile();
    navigate('/');
  };

  return (
    <header
      ref={headerRef}
      onFocusCapture={() => setHasFocus(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setHasFocus(false);
      }}
      className={cn(
        'safe-top top-0 z-40 border-b border-border shadow-sm glass-topbar text-white',
        // Onde a página abre com imagem de largura inteira, o cabeçalho sai do fluxo para
        // a poder descobrir: em `sticky` continuava a ocupar lugar, e escondê-lo deixava
        // uma faixa vazia por cima dela — exactamente o que se queria tirar.
        //
        // Onde a página abre com conteúdo normal — ficha de livro, perfil, confirmação de
        // encomenda — não há imagem para descobrir, e escondê-lo só deixava o texto colado
        // ao topo, sem navegação. Aí fica `sticky`, no fluxo, como sempre esteve.
        pinned ? 'sticky' : 'fixed inset-x-0 transition-transform duration-300 ease-out',
        // Com o menu aberto o cabeçalho pode passar da altura do ecrã; aí desloca-se por
        // dentro em vez de cortar o fim da lista.
        mobileOpen && 'max-h-dvh overflow-y-auto',
        !pinned && (revealed ? 'translate-y-0' : '-translate-y-full')
      )}
    >
      {/* Barra superior — mensagem de boas-vindas */}
      <div className="hidden sm:block text-white/90 text-center text-xs py-1.5 px-4 border-b border-white/5 bg-white/5">
        {isAuthed ? (
          <span>
            {(settings.header_welcome_logged || 'Bem-vindo de volta, {nome}').replace('{nome}', getUserFirstName(user))}
            {(settings.header_cta_text || settings.header_cta_link) && (
              <>
                {' · '}
                <Link to={settings.header_cta_link || '/shop'} className="underline underline-offset-2 hover:text-white">
                  {settings.header_cta_text || 'Explorar novidades'}
                </Link>
              </>
            )}
          </span>
        ) : (
          <span>
            {settings.header_welcome_guest || 'Envio em todo o país · Crie a sua conta para acompanhar encomendas'}
            {' · '}
            <Link to="/login" className="underline underline-offset-2 hover:text-white">Crie a sua conta</Link>
          </span>
        )}
      </div>

      <div className="container-custom">
        <div className="flex items-center justify-between h-16 gap-3">
          <BrandLogo variant="light" collapseToIcon />

          <div className="hidden lg:block">
            <MegaMenu />
          </div>

          <div className="flex items-center gap-1 sm:gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full text-white/80 hover:text-white hover:bg-white/10"
              onClick={() => {
                if (!searchOpen) openHeaderSearch();
                else setSearchOpen(false);
              }}
              aria-expanded={searchOpen}
              aria-controls="header-search"
              aria-label={searchOpen ? 'Fechar pesquisa' : 'Abrir pesquisa'}
            >
              {searchOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Search className="h-5 w-5" aria-hidden="true" />}
            </Button>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative rounded-full text-white/80 hover:text-white hover:bg-white/10"
                  onClick={onCartOpen}
                  aria-label={`Carrinho com ${cartCount} itens`}
                >
                  <ShoppingCart className="h-5 w-5" aria-hidden="true" />
                  {cartCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 bg-[#dc2626] text-white text-[10px] font-bold rounded-full h-5 min-w-5 px-1 flex items-center justify-center ring-2 ring-neutral-900">
                      {cartCount > 99 ? '99+' : cartCount}
                    </span>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Ver Carrinho de Compras</TooltipContent>
            </Tooltip>

            {isAuthed ? (
              <>
                <UserMenu className="hidden sm:flex text-white" />
                <Link to="/profile" className="sm:hidden" aria-label="Minha conta">
                  <UserAvatar user={user} size="sm" className="ring-2 ring-[#22d3ee]/30" />
                </Link>
              </>
            ) : (
              <>
                <GuestAuthButton className="hidden sm:flex text-white" />
                <Link to="/login" className="sm:hidden" aria-label="Entrar na conta">
                  <Button variant="ghost" size="icon" className="rounded-full text-white hover:bg-white/10">
                    <User className="h-5 w-5" aria-hidden="true" />
                  </Button>
                </Link>
              </>
            )}

            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden rounded-full text-white hover:bg-white/10 transition-transform duration-200 active:scale-95"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-expanded={mobileOpen}
              aria-controls="mobile-navigation-menu"
              aria-label={mobileOpen ? "Fechar menu" : "Abrir menu"}
            >
              {mobileOpen ? <X className="h-5 w-5 animate-in spin-in-90 duration-200" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        <form
          id="header-search"
          onSubmit={handleSearch}
          role="search"
          aria-label="Pesquisa de livros"
          aria-hidden={!searchOpen}
          className={`grid transition-[grid-template-rows,opacity] duration-300 ${
            searchOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
          }`}
        >
          <div className="overflow-hidden">
            <div className="flex gap-2 pb-4">
              <Input
                ref={searchInputRef}
                type="search"
                placeholder="Pesquisar livros, autores..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="min-w-0 flex-1 rounded-full bg-white/10 border-white/10 text-white placeholder-white/50 focus-visible:ring-[#22d3ee]"
                aria-label="Pesquisar livros, autores e coleções"
                tabIndex={searchOpen ? 0 : -1}
              />
              <Button type="submit" className="rounded-full bg-[#22d3ee] text-neutral-950 hover:bg-[#22d3ee]/90">
                Pesquisar
              </Button>
            </div>
          </div>
        </form>

        <div
          id="mobile-navigation-menu"
          className={`lg:hidden space-y-4 border-t border-white/10 pt-4 mobile-menu-container ${mobileOpen ? 'open' : ''}`}
          aria-hidden={!mobileOpen}
        >
          {/* Secção de conta no mobile */}
          {isAuthed ? (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-[#0ea5c9]/5 border border-[#0ea5c9]/15">
              <UserAvatar user={user} size="lg" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate text-white">{getUserDisplayName(user)}</p>
                <p className="text-xs text-white/60 truncate">{user?.email}</p>
                {isAdmin && (
                  <span className="text-[10px] font-medium text-[#22d3ee]">Administrador</span>
                )}
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-white/5 border border-white/10">
              <p className="text-sm text-white/70 mb-3">Entre para acompanhar encomendas e guardar preferências.</p>
              <GuestAuthButton fullWidth />
            </div>
          )}

          <nav className="flex flex-col gap-1" aria-label="Navegação Móvel">
            {NAV_LINKS.map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                onClick={closeMobile}
                className={`px-3 py-2.5 text-sm font-semibold rounded-lg transition-colors ${
                  location.pathname === to
                    ? 'bg-[#22d3ee]/15 text-[#22d3ee]'
                    : 'text-white/80 hover:bg-white/5 hover:text-white'
                }`}
                tabIndex={mobileOpen ? 0 : -1}
              >
                {label}
              </Link>
            ))}

            {isAuthed && (
              <>
                <div className="h-px bg-white/10 my-2" />
                <Link
                  to="/profile"
                  onClick={closeMobile}
                  className="flex items-center gap-3 px-3 py-2.5 text-sm font-semibold rounded-lg text-white/80 hover:bg-white/5 hover:text-white"
                  tabIndex={mobileOpen ? 0 : -1}
                >
                  <User className="h-4 w-4 text-[#22d3ee]" /> Minha Conta
                </Link>
                <Link
                  to="/profile"
                  state={{ tab: 'orders' }}
                  onClick={closeMobile}
                  className="flex items-center gap-3 px-3 py-2.5 text-sm font-semibold rounded-lg text-white/80 hover:bg-white/5 hover:text-white"
                  tabIndex={mobileOpen ? 0 : -1}
                >
                  <ShoppingBag className="h-4 w-4 text-[#22d3ee]" /> Encomendas
                </Link>
                {canAccessAdmin && (
                  <Link
                    to="/admin"
                    onClick={closeMobile}
                    className="flex items-center gap-3 px-3 py-2.5 text-sm font-semibold rounded-lg text-white/80 hover:bg-white/5 hover:text-white"
                    tabIndex={mobileOpen ? 0 : -1}
                  >
                    <LayoutDashboard className="h-4 w-4 text-[#22d3ee]" /> Painel Admin
                  </Link>
                )}
                {canAccessAdmin && (
                  <Link
                    to="/admin?tab=vendas-huambo"
                    onClick={closeMobile}
                    className="flex items-center gap-3 px-3 py-2.5 text-sm font-semibold rounded-lg text-white/80 hover:bg-white/5 hover:text-white"
                    tabIndex={mobileOpen ? 0 : -1}
                  >
                    <BarChart3 className="h-4 w-4 text-[#22d3ee]" /> Painel de Vendas
                  </Link>
                )}
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex items-center gap-3 px-3 py-2.5 text-sm font-semibold rounded-lg hover:bg-destructive/10 text-destructive w-full text-left"
                  tabIndex={mobileOpen ? 0 : -1}
                >
                  <LogOut className="h-4 w-4" /> Terminar Sessão
                </button>
              </>
            )}
            <Link
              to="/track"
              onClick={() => setMobileOpen(false)}
              className="px-3 py-2.5 text-sm font-semibold rounded-lg hover:bg-white/5 text-[#22d3ee]"
              tabIndex={mobileOpen ? 0 : -1}
            >
              Rastrear Encomenda
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
};

export default Header;
