import React from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { Wrench, Mail, Phone, MapPin, PackageSearch } from 'lucide-react';
import { Button } from '@/components/ui/button';
import BrandLogo from '@/components/BrandLogo';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { pageTitle, BRAND } from '@/lib/brand';

export default function MaintenancePage() {
  const { settings } = useSiteSettings();
  const siteName = settings?.site_name || BRAND.name;
  const message = settings?.maintenance_message
    || settings?.tagline
    || 'Estamos a melhorar a loja para si. Voltamos em breve.';

  return (
    <>
      <Helmet>
        <title>{pageTitle('Manutenção')}</title>
      </Helmet>

      <div className="min-h-screen bg-gradient-to-br from-[var(--brand-dark,#0c4a6e)] via-[#0e7490] to-[var(--brand-primary,#0ea5c9)] text-white flex flex-col">
        <header className="container-custom py-6">
          <BrandLogo variant="light" linkTo={null} />
        </header>

        <main className="flex-1 flex items-center justify-center px-4 py-12">
          <div className="max-w-lg w-full text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 mb-8">
              <Wrench className="h-10 w-10 text-[#22d3ee]" />
            </div>

            <h1 className="text-3xl md:text-4xl font-bold mb-4 text-white">
              Loja em manutenção
            </h1>
            <p className="text-white/85 text-lg mb-8 leading-relaxed">
              {message}
            </p>

            <div className="rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 p-6 text-left space-y-3 mb-8">
              <p className="text-sm text-white/70 uppercase tracking-wider font-medium">Enquanto isso</p>
              <p className="text-white/90 text-sm">
                Pode rastrear uma encomenda existente ou contactar-nos — o checkout online está temporariamente indisponível.
              </p>
              {(settings?.contact_email || settings?.contact_phone) && (
                <div className="pt-2 space-y-2 text-sm text-white/80">
                  {settings.contact_email && (
                    <p className="flex items-center gap-2">
                      <Mail className="h-4 w-4 shrink-0 text-[#22d3ee]" />
                      {settings.contact_email}
                    </p>
                  )}
                  {settings.contact_phone && (
                    <p className="flex items-center gap-2">
                      <Phone className="h-4 w-4 shrink-0 text-[#22d3ee]" />
                      {settings.contact_phone}
                    </p>
                  )}
                  {settings.contact_address && (
                    <p className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 shrink-0 text-[#22d3ee]" />
                      {settings.contact_address}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button asChild className="bg-white text-[#0c4a6e] hover:bg-white/90">
                <Link to="/track">
                  <PackageSearch className="h-4 w-4 mr-2" />
                  Rastrear encomenda
                </Link>
              </Button>
              <Button asChild variant="outline" className="border-white/40 text-white hover:bg-white/10 bg-transparent">
                <Link to="/login">Área de administrador</Link>
              </Button>
            </div>
          </div>
        </main>

        <footer className="container-custom py-6 text-center text-sm text-white/50">
          © {new Date().getFullYear()} {siteName}
        </footer>
      </div>
    </>
  );
}
