import React from 'react';
import { Link } from 'react-router-dom';
import { BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { withCacheBust } from '@/lib/imageUrl';
import { BRAND } from '@/lib/brand';

function LogoText({ light = false, siteName }) {
  const parts = (siteName || BRAND.name).split(' ');
  const line1 = parts.length > 1 ? parts.slice(0, -1).join(' ') : 'Livraria';
  const line2 = parts.length > 1 ? parts[parts.length - 1] : siteName || 'ADVENTISTA';

  return (
    <div className="hidden sm:flex flex-col leading-tight">
      <span className={cn('text-[10px] font-medium tracking-widest uppercase', light ? 'text-white/70' : 'text-muted-foreground')}>
        {line1}
      </span>
      <span className={cn('text-base font-bold tracking-wide', light ? 'text-[#22d3ee]' : 'text-[#0ea5c9]')}>
        {line2.toUpperCase()}
      </span>
    </div>
  );
}

export function BrandLogo({ className, linkTo = '/', variant = 'default' }) {
  const { settings } = useSiteSettings();
  const isLight = variant === 'light';
  const siteName = settings?.site_name || BRAND.name;
  const logoUrl = settings?.logo_url
    ? withCacheBust(settings.logo_url, settings.assets_version)
    : '';
  const primaryColor = settings?.primary_color || '#0ea5c9';

  const content = (
    <div className={cn('flex items-center gap-2.5', className)}>
      <div
        className={cn('flex items-center justify-center h-9 w-9 sm:h-10 sm:w-10 rounded-lg shrink-0 overflow-hidden', !logoUrl && (isLight ? 'bg-white/10' : 'bg-[#0ea5c9]/10'))}
        style={!logoUrl && !isLight ? { backgroundColor: `${primaryColor}18` } : undefined}
      >
        {logoUrl ? (
          <img key={logoUrl} src={logoUrl} alt={siteName} className="h-full w-full object-contain p-0.5" />
        ) : (
          <BookOpen className={cn('h-5 w-5 sm:h-6 sm:w-6', isLight ? 'text-[#22d3ee]' : '')} style={!isLight ? { color: primaryColor } : undefined} />
        )}
      </div>
      {!logoUrl && <LogoText light={isLight} siteName={siteName} />}
      {logoUrl && (
        <span className={cn('font-bold text-sm sm:text-base hidden sm:block', isLight ? 'text-white' : 'text-foreground')}>
          {siteName}
        </span>
      )}
    </div>
  );

  if (linkTo) {
    return (
      <Link to={linkTo} className="shrink-0 hover:opacity-90 transition-opacity" aria-label={`${siteName} — Início`}>
        {content}
      </Link>
    );
  }
  return content;
}

export default BrandLogo;
