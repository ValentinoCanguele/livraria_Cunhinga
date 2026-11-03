import React, { Suspense, lazy } from 'react';
import { ThemeProvider } from '@/hooks/useTheme';
import { Navigate, Route, Routes, BrowserRouter as Router, useLocation, useParams } from 'react-router-dom';
import { CartProvider } from '@/hooks/useCart';
import { AuthProvider } from '@/hooks/useAuth';
import { SiteSettingsProvider } from '@/hooks/useSiteSettings';
import { IntegrationsProvider } from '@/hooks/useIntegrations';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import ScrollToTop from '@/components/ScrollToTop.jsx';
import { BookLoader } from '@/components/ui/book-loader';

const HomePage = lazy(() => import('@/pages/HomePage.jsx'));
const ShopPage = lazy(() => import('@/pages/ShopPage.jsx'));

// Lazy-loaded pages to optimize initial bundle size & load speed
const CategoryPage = lazy(() => import('@/pages/CategoryPage.jsx'));
const ProductDetailPage = lazy(() => import('@/pages/ProductDetailPage.jsx'));
const AboutPage = lazy(() => import('@/pages/AboutPage.jsx'));
const StoresPage = lazy(() => import('@/pages/StoresPage.jsx'));
const ContactPage = lazy(() => import('@/pages/ContactPage.jsx'));
const FAQPage = lazy(() => import('@/pages/FAQPage.jsx'));
const ShippingReturnsPage = lazy(() => import('@/pages/ShippingReturnsPage.jsx'));
const SuccessPage = lazy(() => import('@/pages/SuccessPage.jsx'));
const LoginPage = lazy(() => import('@/pages/LoginPage.jsx'));
const ForgotPasswordPage = lazy(() => import('@/pages/ForgotPasswordPage.jsx'));
const ResetPasswordPage = lazy(() => import('@/pages/ResetPasswordPage.jsx'));
const TrackOrderPage = lazy(() => import('@/pages/TrackOrderPage.jsx'));
const AdminPage = lazy(() => import('@/pages/AdminPage.jsx'));
const ProfilePage = lazy(() => import('@/pages/ProfilePage.jsx'));
const CollectionsPage = lazy(() => import('@/pages/CollectionsPage.jsx'));
const UnsubscribePage = lazy(() => import('@/pages/UnsubscribePage.jsx'));

const PwaInstallBanner = lazy(() => import('@/components/PwaInstallBanner.jsx'));
const LivrariaAssistant = lazy(() => import('@/components/LivrariaAssistant.jsx'));

function PageLoader() {
  return (
    <div className="min-h-[50vh] flex items-center justify-center p-8">
      <BookLoader label="A carregar a página" />
    </div>
  );
}

function LegacyCategoryRedirect() {
  const { category } = useParams();
  return <Navigate to={category ? `/shop/${encodeURIComponent(category)}` : '/shop'} replace />;
}

/**
 * O alias em português do cancelamento de subscrição tem de levar a busca consigo: o token
 * vai em `?t=`, e um `<Navigate>` simples deixava-o pelo caminho, dando um link partido a
 * quem usasse este endereço.
 */
function UnsubscribeAliasRedirect() {
  const { search } = useLocation();
  return <Navigate to={`/unsubscribe${search}`} replace />;
}

function LegacyCollectionRedirect() {
  const { slug } = useParams();
  return <Navigate to={slug ? `/colecoes/${encodeURIComponent(slug)}` : '/colecoes'} replace />;
}

class RouteErrorBoundaryView extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('RouteErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background px-6">
          <div className="max-w-md text-center">
            <h1 className="text-4xl font-bold text-foreground mb-4">Algo correu mal</h1>
            <p className="text-muted-foreground mb-6">A página não pôde ser carregada. Tente recarregar ou voltar à loja.</p>
            <a href="/" className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
              Voltar ao Início
            </a>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function RouteErrorBoundary({ children }) {
  const location = useLocation();
  return <RouteErrorBoundaryView key={location.key}>{children}</RouteErrorBoundaryView>;
}

function GlobalWidgets() {
  const { pathname } = useLocation();
  const showAssistant = pathname !== '/login' && !pathname.startsWith('/admin');

  return (
    <Suspense fallback={null}>
      <PwaInstallBanner />
      {showAssistant && <LivrariaAssistant />}
    </Suspense>
  );
}

function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} storageKey="livraria-theme">
    <TooltipProvider>
    <SiteSettingsProvider>
    <IntegrationsProvider>
    <AuthProvider>
    <CartProvider>
      <Router>
        <ScrollToTop />
        <RouteErrorBoundary>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<HomePage />} />

              <Route path="/shop" element={<ShopPage />} />
              <Route path="/loja" element={<Navigate to="/shop" replace />} />
              <Route path="/catalog" element={<Navigate to="/shop" replace />} />
              <Route path="/catalog/:category" element={<LegacyCategoryRedirect />} />
              <Route path="/shop/:category" element={<CategoryPage />} />

              <Route path="/colecoes" element={<CollectionsPage />} />
              <Route path="/colecoes/:slug" element={<CollectionsPage />} />
              <Route path="/colecao/:slug" element={<LegacyCollectionRedirect />} />

              <Route path="/product/:id" element={<ProductDetailPage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/sobre" element={<Navigate to="/about" replace />} />
              <Route path="/lojas" element={<StoresPage />} />
              <Route path="/contact" element={<ContactPage />} />
              <Route path="/contacto" element={<Navigate to="/contact" replace />} />
              <Route path="/faq" element={<FAQPage />} />
              <Route path="/shipping-returns" element={<ShippingReturnsPage />} />
              <Route path="/envios-devolucoes" element={<Navigate to="/shipping-returns" replace />} />
              <Route path="/envios-e-devolucoes" element={<Navigate to="/shipping-returns" replace />} />

              <Route path="/success" element={<SuccessPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/track" element={<TrackOrderPage />} />
              <Route path="/unsubscribe" element={<UnsubscribePage />} />
              <Route path="/cancelar-subscricao" element={<UnsubscribeAliasRedirect />} />
              <Route path="/rastreio" element={<Navigate to="/track" replace />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/perfil" element={<Navigate to="/profile" replace />} />

              <Route path="/admin" element={<AdminPage />} />
              <Route path="/admin.html" element={<Navigate to="/admin" replace />} />
              <Route path="/painel" element={<Navigate to="/admin" replace />} />
              <Route path="/painel-admin" element={<Navigate to="/admin" replace />} />
              <Route path="/painel-vendas.html" element={<Navigate to="/admin?tab=vendas-huambo" replace />} />
              <Route path="/painel-vendas" element={<Navigate to="/admin?tab=vendas-huambo" replace />} />
              <Route path="/painel-vendas-huambo.html" element={<Navigate to="/admin?tab=vendas-huambo" replace />} />
              <Route path="/painel-vendas-huambo" element={<Navigate to="/admin?tab=vendas-huambo" replace />} />

              <Route path="*" element={
                <div className="min-h-screen flex items-center justify-center bg-background">
                  <div className="text-center">
                    <h1 className="text-6xl font-bold text-foreground mb-4">404</h1>
                    <p className="text-xl text-muted-foreground mb-8">Página não encontrada</p>
                    <a href="/" className="inline-block px-4 py-3 text-primary hover:underline font-medium">Voltar ao Início</a>
                  </div>
                </div>
              } />
            </Routes>
          </Suspense>
        </RouteErrorBoundary>
        <Toaster />
        <GlobalWidgets />
      </Router>
    </CartProvider>
    </AuthProvider>
    </IntegrationsProvider>
    </SiteSettingsProvider>
    </TooltipProvider>
    </ThemeProvider>
  );
}

export default App;