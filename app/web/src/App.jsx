import React, { Suspense, lazy } from 'react';
import { ThemeProvider } from 'next-themes';
import { Route, Routes, BrowserRouter as Router } from 'react-router-dom';
import { CartProvider } from '@/hooks/useCart';
import { AuthProvider } from '@/hooks/useAuth';
import { SiteSettingsProvider } from '@/hooks/useSiteSettings';
import { IntegrationsProvider } from '@/hooks/useIntegrations';
import { Toaster } from '@/components/ui/sonner';
import ScrollToTop from '@/components/ScrollToTop.jsx';
import { Spinner } from '@/components/ui/spinner';
import HomePage from '@/pages/HomePage.jsx';
import ShopPage from '@/pages/ShopPage.jsx';

// Lazy-loaded pages to optimize initial bundle size & load speed
const CategoryPage = lazy(() => import('@/pages/CategoryPage.jsx'));
const ProductDetailPage = lazy(() => import('@/pages/ProductDetailPage.jsx'));
const AboutPage = lazy(() => import('@/pages/AboutPage.jsx'));
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

import PwaInstallBanner from '@/components/PwaInstallBanner.jsx';
import LivrariaAssistant from '@/components/LivrariaAssistant.jsx';

function PageLoader() {
  return (
    <div className="min-h-[50vh] flex items-center justify-center p-8">
      <Spinner className="size-8 text-primary animate-spin" />
    </div>
  );
}

function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} storageKey="livraria-theme">
    <SiteSettingsProvider>
    <IntegrationsProvider>
    <AuthProvider>
    <CartProvider>
      <Router>
        <ScrollToTop />
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/shop" element={<ShopPage />} />
            <Route path="/colecoes" element={<CollectionsPage />} />
            <Route path="/colecoes/:slug" element={<CollectionsPage />} />
            <Route path="/shop/:category" element={<CategoryPage />} />
            <Route path="/product/:id" element={<ProductDetailPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/faq" element={<FAQPage />} />
            <Route path="/shipping-returns" element={<ShippingReturnsPage />} />
            <Route path="/success" element={<SuccessPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/track" element={<TrackOrderPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="*" element={
              <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="text-center">
                  <h1 className="text-6xl font-bold text-foreground mb-4">404</h1>
                  <p className="text-xl text-muted-foreground mb-8">Página não encontrada</p>
                  <a href="/" className="text-primary hover:underline font-medium">Voltar ao Início</a>
                </div>
              </div>
            } />
          </Routes>
        </Suspense>
        <Toaster />
        <PwaInstallBanner />
        <LivrariaAssistant />
      </Router>
    </CartProvider>
    </AuthProvider>
    </IntegrationsProvider>
    </SiteSettingsProvider>
    </ThemeProvider>
  );
}

export default App;