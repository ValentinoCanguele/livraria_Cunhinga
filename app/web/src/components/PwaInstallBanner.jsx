import React, { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { withCacheBust } from '@/lib/imageUrl';

export default function PwaInstallBanner() {
  const { settings } = useSiteSettings();
  const [deferred, setDeferred] = useState(null);
  const [dismissed, setDismissed] = useState(() => localStorage.getItem('pwa-dismissed') === '1');
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    setIsStandalone(window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone);
    const handler = (e) => {
      e.preventDefault();
      setDeferred(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (!settings.pwa_enabled || dismissed || isStandalone || !deferred) return null;

  const logoUrl = settings.logo_url
    ? withCacheBust(settings.logo_url, settings.assets_version)
    : '';

  const install = async () => {
    deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === 'accepted') setDeferred(null);
  };

  const dismiss = () => {
    localStorage.setItem('pwa-dismissed', '1');
    setDismissed(true);
  };

  return (
    <div className="fixed bottom-4 safe-float-bottom [--float-gap:1rem] left-4 right-4 sm:left-auto sm:right-4 sm:max-w-sm z-50 bg-card border shadow-xl rounded-2xl p-4 flex gap-3 items-start animate-in slide-in-from-bottom-4">
      <div className="h-10 w-10 rounded-xl bg-[#0ea5c9]/10 flex items-center justify-center shrink-0 overflow-hidden">
        {logoUrl ? (
          <img src={logoUrl} alt="" className="h-full w-full object-contain p-1" />
        ) : (
          <Download className="h-5 w-5 text-[#0ea5c9]" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm">Instalar App</p>
        <p className="text-xs text-muted-foreground mb-2">Adicione {settings.pwa_short_name || settings.site_name} ao ecrã inicial</p>
        <Button size="sm" className="btn-primary h-8" onClick={install}>Instalar</Button>
      </div>
      <button type="button" onClick={dismiss} className="text-muted-foreground hover:text-foreground p-1">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
