import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Search, ShoppingCart, Menu, X, User, ShoppingBag, LogOut, LayoutDashboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCart } from '@/hooks/useCart';
import { useAuth } from '@/hooks/useAuth';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import BrandLogo from '@/components/BrandLogo';
import UserAvatar from '@/components/UserAvatar';
import { UserMenu, GuestAuthButton } from '@/components/UserMenu';
import { getUserDisplayName, getUserFirstName } from '@/lib/userUtils';

const NAV_LINKS = [
  { to: '/', label: 'Início' },
  { to: '/shop', label: 'Loja' },
  { to: '/colecoes', label: 'Coleções' },
  { to: '/about', label: 'Sobre' },
  { to: '/contact', label: 'Contacto' },
];

const Header = ({ onCartOpen }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { cartItems } = useCart();
  const { user, isAuthed, isAdmin, canAccessAdmin, logout } = useAuth();
  const { settings } = useSiteSettings();
  const [search, setSearch] = useState('');
  const [mobileOpen, setMobileOpen] = useState(false);

  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  const handleSearch = (e) => {
    e.preventDefault();
    const query = search.trim();
    if (!query) return;
    navigate(`/shop?search=${encodeURIComponent(query)}`);
    setMobileOpen(false);
  };

  const closeMobile = () => setMobileOpen(false);

  const handleLogout = () => {
    logout();
    closeMobile();
    navigate('/');
  };

  return (
    <header className={`sticky top-0 z-40 border-b border-border shadow-sm ${settings.ui_glass_enabled !== false ? 'glass-surface' : 'bg-background/95 backdrop-blur-md'}`}>
      {/* Barra superior — mensagem de boas-vindas */}
      <div className={`hidden sm:block text-white text-center text-xs py-1.5 px-4 ${settings.ui_glass_enabled !== false ? 'glass-topbar' : 'bg-gradient-to-r from-[var(--brand-dark)] to-[var(--brand-primary)]'}`}>
        {isAuthed ? (
          <span>
            {(settings.header_welcome_logged || 'Bem-vindo de volta, {nome}').replace('{nome}', getUserFirstName(user))}
            {(settings.header_cta_text || settings.header_cta_link) && (
              <>
                {' · '}
                <Link to={settings.header_cta_link || '/shop'} className="underline underline-offset-2 hover:text-white/90">
                  {settings.header_cta_text || 'Explorar novidades'}
                </Link>
              </>
            )}
          </span>
        ) : (
          <span>
            {settings.header_welcome_guest || 'Envio em todo o país · Crie a sua conta para acompanhar encomendas'}
            {' · '}
            <Link to="/login" className="underline underline-offset-2 hover:text-white/90">Crie a sua conta</Link>
          </span>
        )}
      </div>

      <div className="container-custom">
        <div className="flex items-center justify-between h-16 gap-3">
          <BrandLogo />

          <nav className="hidden lg:flex items-center gap-6">
            {NAV_LINKS.map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                className={`text-sm font-medium transition-colors hover:text-[var(--brand-primary)] ${
                  location.pathname === to ? 'text-[var(--brand-primary)]' : 'text-muted-foreground'
                }`}
              >
                {label}
              </Link>
            ))}
          </nav>

          <form onSubmit={handleSearch} className="hidden md:flex flex-1 max-w-md mx-4">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Pesquisar livros, autores..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-muted/40 border-border/50 focus-visible:ring-[var(--brand-primary)] rounded-full glass-surface"
              />
            </div>
          </form>

          <div className="flex items-center gap-1 sm:gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="relative rounded-full hover:bg-[#0ea5c9]/10"
              onClick={onCartOpen}
              aria-label={`Carrinho${cartCount > 0 ? `, ${cartCount} itens` : ''}`}
            >
              <ShoppingCart className="h-5 w-5" />
              {cartCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-[#dc2626] text-white text-[10px] font-bold rounded-full h-5 min-w-5 px-1 flex items-center justify-center ring-2 ring-background">
                  {cartCount > 99 ? '99+' : cartCount}
                </span>
              )}
            </Button>

            {isAuthed ? (
              <>
                <UserMenu className="hidden sm:flex" />
                <Link to="/profile" className="sm:hidden" aria-label="Minha conta">
                  <UserAvatar user={user} size="sm" className="ring-2 ring-[#0ea5c9]/30" />
                </Link>
              </>
            ) : (
              <>
                <GuestAuthButton className="hidden sm:flex" />
                <Link to="/login" className="sm:hidden" aria-label="Entrar">
                  <Button variant="ghost" size="icon" className="rounded-full">
                    <User className="h-5 w-5" />
                  </Button>
                </Link>
              </>
            )}

            <Button variant="ghost" size="icon" className="lg:hidden rounded-full" onClick={() => setMobileOpen(!mobileOpen)}>
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {mobileOpen && (
          <div className="lg:hidden pb-4 space-y-4 border-t border-border pt-4">
            {/* Secção de conta no mobile */}
            {isAuthed ? (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-[#0ea5c9]/5 border border-[#0ea5c9]/15">
                <UserAvatar user={user} size="lg" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{getUserDisplayName(user)}</p>
                  <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                  {isAdmin && (
                    <span className="text-[10px] font-medium text-[#0ea5c9]">Administrador</span>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-muted/50 border">
                <p className="text-sm text-muted-foreground mb-3">Entre para acompanhar encomendas e guardar preferências.</p>
                <GuestAuthButton fullWidth />
              </div>
            )}

            <form onSubmit={handleSearch}>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Pesquisar livros..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 rounded-full"
                />
              </div>
            </form>

            <nav className="flex flex-col gap-1">
              {NAV_LINKS.map(({ to, label }) => (
                <Link
                  key={to}
                  to={to}
                  onClick={closeMobile}
                  className={`px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                    location.pathname === to
                      ? 'bg-[#0ea5c9]/10 text-[#0ea5c9]'
                      : 'hover:bg-muted'
                  }`}
                >
                  {label}
                </Link>
              ))}

              {isAuthed && (
                <>
                  <div className="h-px bg-border my-2" />
                  <Link
                    to="/profile"
                    onClick={closeMobile}
                    className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg hover:bg-muted"
                  >
                    <User className="h-4 w-4 text-[#0ea5c9]" /> Minha Conta
                  </Link>
                  <Link
                    to="/profile"
                    state={{ tab: 'orders' }}
                    onClick={closeMobile}
                    className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg hover:bg-muted"
                  >
                    <ShoppingBag className="h-4 w-4 text-[#0ea5c9]" /> Encomendas
                  </Link>
                  {canAccessAdmin && (
                    <Link
                      to="/admin"
                      onClick={closeMobile}
                      className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg hover:bg-muted"
                    >
                      <LayoutDashboard className="h-4 w-4 text-[#0ea5c9]" /> Painel Admin
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg hover:bg-destructive/10 text-destructive w-full text-left"
                  >
                    <LogOut className="h-4 w-4" /> Terminar Sessão
                  </button>
                </>
              )}
              <Link
                to="/track"
                onClick={() => setMobileOpen(false)}
                className="px-3 py-2.5 text-sm font-medium rounded-lg hover:bg-muted text-[#0ea5c9]"
              >
                Rastrear Encomenda
              </Link>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
