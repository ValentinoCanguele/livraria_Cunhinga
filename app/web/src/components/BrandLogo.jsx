import React from 'react';
import { Link } from 'react-router-dom';
import { BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { withCacheBust } from '@/lib/imageUrl';
import { BRAND } from '@/lib/brand';

export function BrandLogo({ className, linkTo = '/', variant = 'default', showText = true }) {
  const { settings } = useSiteSettings();
  const isLight = variant === 'light';
  const isIconOnly = variant === 'icon';
  const siteName = settings?.site_name || BRAND.name;
  const hasCustomLogo = Boolean(settings?.logo_url);
  // Lockup compacto: no lockup oficial (/logo.svg) a assinatura ocupa 28% da altura e
  // fica ilegível nos 40px do cabeçalho. Em fundo escuro entra a versão a branco, porque
  // o azul-marinho da marca não se lê sobre o azul do cabeçalho.
  const defaultLogo = isLight ? '/logo-compact-light.svg' : '/logo-compact.svg';
  const logoUrl = hasCustomLogo
    ? withCacheBust(settings.logo_url, settings.assets_version)
    : defaultLogo;
  const primaryColor = settings?.primary_color || '#0ea5c9';

  if (isIconOnly) {
    const iconEl = (
      <img
        src={isLight ? '/logo-icon-light.svg' : '/logo-icon.svg'}
        alt={siteName}
        className={cn('h-9 w-9 sm:h-10 sm:w-10 object-contain', className)}
      />
    );
    if (linkTo) {
      return (
        <Link to={linkTo} className="shrink-0 hover:opacity-90 transition-opacity" aria-label={`${siteName} — Início`}>
          {iconEl}
        </Link>
      );
    }
    return iconEl;
  }

  const DEFAULT_HORIZONTAL = [
    '/logo-compact.svg', '/logo-compact-light.svg',
    '/logo.svg', '/logo-light.svg', '/logo.png', '/logo-light.png',
  ];
  const isHorizontalLogo = !hasCustomLogo || DEFAULT_HORIZONTAL.includes(settings.logo_url);

  const content = (
    <div className={cn('flex items-center gap-2.5', className)}>
      {isHorizontalLogo ? (
        <img
          key={logoUrl}
          src={logoUrl}
          alt={siteName}
          className={cn(
            'h-9 sm:h-10 w-auto max-w-[190px] sm:max-w-[220px] object-contain shrink-0',
            isLight && hasCustomLogo && 'brightness-110 drop-shadow-[0_1px_2px_rgba(255,255,255,0.2)]'
          )}
        />
      ) : (
        <>
          <div
            className={cn(
              'flex items-center justify-center h-9 w-9 sm:h-10 sm:w-10 rounded-lg shrink-0 overflow-hidden',
              isLight ? 'bg-white/10' : 'bg-[#0ea5c9]/10'
            )}
            style={!isLight ? { backgroundColor: `${primaryColor}18` } : undefined}
          >
            {logoUrl ? (
              <img key={logoUrl} src={logoUrl} alt={siteName} className="h-full w-full object-contain p-0.5" />
            ) : (
              <BookOpen className={cn('h-5 w-5 sm:h-6 sm:w-6', isLight ? 'text-[#22d3ee]' : '')} style={!isLight ? { color: primaryColor } : undefined} />
            )}
          </div>
          {showText && (
            <span className={cn('font-bold text-sm sm:text-base hidden sm:block', isLight ? 'text-white' : 'text-foreground')}>
              {siteName}
            </span>
          )}
        </>
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
