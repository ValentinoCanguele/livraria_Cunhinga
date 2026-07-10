import React from 'react';
import { ThemeProvider } from 'next-themes';
import { Route, Routes, BrowserRouter as Router } from 'react-router-dom';
import { CartProvider } from '@/hooks/useCart';
import { AuthProvider } from '@/hooks/useAuth';
import { SiteSettingsProvider } from '@/hooks/useSiteSettings';
import { IntegrationsProvider } from '@/hooks/useIntegrations';
import { Toaster } from '@/components/ui/sonner';
import ScrollToTop from '@/components/ScrollToTop.jsx';
import HomePage from '@/pages/HomePage.jsx';
import ShopPage from '@/pages/ShopPage.jsx';
import CategoryPage from '@/pages/CategoryPage.jsx';
import ProductDetailPage from '@/pages/ProductDetailPage.jsx';
import AboutPage from '@/pages/AboutPage.jsx';
import ContactPage from '@/pages/ContactPage.jsx';
import FAQPage from '@/pages/FAQPage.jsx';
import ShippingReturnsPage from '@/pages/ShippingReturnsPage.jsx';
import SuccessPage from '@/pages/SuccessPage.jsx';
import LoginPage from '@/pages/LoginPage.jsx';
import ForgotPasswordPage from '@/pages/ForgotPasswordPage.jsx';
import ResetPasswordPage from '@/pages/ResetPasswordPage.jsx';
import TrackOrderPage from '@/pages/TrackOrderPage.jsx';
import AdminPage from '@/pages/AdminPage.jsx';
import ProfilePage from '@/pages/ProfilePage.jsx';
import CollectionsPage from '@/pages/CollectionsPage.jsx';
import PwaInstallBanner from '@/components/PwaInstallBanner.jsx';
import LivrariaAssistant from '@/components/LivrariaAssistant.jsx';

function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} storageKey="livraria-theme">
    <SiteSettingsProvider>
    <IntegrationsProvider>
    <AuthProvider>
    <CartProvider>
      <Router>
        <ScrollToTop />
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