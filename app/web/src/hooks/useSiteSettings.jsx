import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { getSiteSettings } from '@/api/PlatformApi';
import { BRAND } from '@/lib/brand';
import { withCacheBust } from '@/lib/imageUrl';
import { applyShopTheme } from '@/lib/shopTheme';

const THEME_DEFAULTS = {
  primary_color: '#0ea5c9',
  pwa_theme_color: '#0c4a6e',
  ui_glass_enabled: true,
  ui_glass_opacity: 0.72,
  shop_bg_mode: 'image',
  shop_bg_overlay: 0.55,
};

const SiteSettingsContext = createContext(null);

export function SiteSettingsProvider({ children }) {
  const [settings, setSettings] = useState({
    ...BRAND,
    ...THEME_DEFAULTS,
    site_name: BRAND.name,
    logo_url: '',
    favicon_url: '',
    assets_version: '',
    shipping_free_threshold: 20000,
    shipping_cost: 1500,
    pwa_enabled: true,
    maintenance_mode: false,
    google_oauth_enabled: false,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    applyShopTheme(THEME_DEFAULTS);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const data = await getSiteSettings();
      const merged = { ...THEME_DEFAULTS, ...data };
      setSettings((prev) => ({ ...prev, ...merged }));
      applyShopTheme(merged);
      if (data.favicon_url) {
        const favHref = withCacheBust(data.favicon_url, data.assets_version);
        let link = document.querySelector("link[rel='icon']");
        if (!link) {
          link = document.createElement('link');
          link.rel = 'icon';
          document.head.appendChild(link);
        }
        link.href = favHref;
      }
      if (data.site_name) document.title = data.site_name;
      if (data.pwa_theme_color) {
        let meta = document.querySelector("meta[name='theme-color']");
        if (!meta) {
          meta = document.createElement('meta');
          meta.name = 'theme-color';
          document.head.appendChild(meta);
        }
        meta.content = data.pwa_theme_color;
      }
    } catch {
      applyShopTheme(THEME_DEFAULTS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return (
    <SiteSettingsContext.Provider value={{ settings, loading, refresh }}>
      {children}
    </SiteSettingsContext.Provider>
  );
}

export const useSiteSettings = () => useContext(SiteSettingsContext);
