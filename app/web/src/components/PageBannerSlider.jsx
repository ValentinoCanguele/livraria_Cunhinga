import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export const SHOP_BANNER_IMAGES = [
  '/images/site/loja-banner.webp',
  '/images/site/opcoes/loja-doutrina.webp',
  '/images/site/opcoes/loja-ellen-white.webp',
  '/images/site/opcoes/loja-familia.webp',
  '/images/site/opcoes/loja-leque.webp',
  '/images/site/opcoes/loja-parede.webp',
  '/images/site/opcoes/loja-prateleira.webp',
];

export default function PageBannerSlider({
  children,
  images = SHOP_BANNER_IMAGES,
  overlayOpacity = 0.65,
  contentClassName = 'text-left',
  ariaLabel = 'Banners da livraria',
}) {
  const configuredSlides = [...new Set((images || []).filter(Boolean))];
  const slides = configuredSlides.length > 0 ? configuredSlides : SHOP_BANNER_IMAGES;
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const activeIndex = current % slides.length;
  const reducedMotion = typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    if (slides.length <= 1 || paused || reducedMotion) return undefined;
    const timer = window.setInterval(() => {
      setCurrent((index) => (index + 1) % slides.length);
    }, 7000);
    return () => window.clearInterval(timer);
  }, [slides.length, paused, reducedMotion]);

  const navigate = (direction) => {
    setCurrent((index) => (index + direction + slides.length) % slides.length);
  };

  return (
    <section
      role="region"
      aria-roledescription="carrossel"
      aria-label={ariaLabel}
      className="relative isolate flex min-h-[240px] items-center overflow-hidden bg-[#0c4a6e] text-white md:min-h-[290px]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false);
      }}
    >
      {slides.length > 0 && (
        <AnimatePresence mode="sync">
          <motion.img
            key={slides[activeIndex]}
            src={slides[activeIndex]}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover object-[65%_center] md:object-center"
            initial={{ opacity: 0, scale: reducedMotion ? 1 : 1.03 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reducedMotion ? 0 : 0.8, ease: 'easeInOut' }}
            loading="eager"
            onError={(event) => { event.currentTarget.style.visibility = 'hidden'; }}
          />
        </AnimatePresence>
      )}
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(90deg, rgba(12, 74, 110, ${overlayOpacity}) 0%, rgba(12, 74, 110, ${overlayOpacity * 0.82}) 58%, rgba(12, 74, 110, ${overlayOpacity * 0.68}) 100%)`,
        }}
      />

      <div className={`container-custom relative z-10 pb-14 pt-10 md:py-14 ${contentClassName}`}>
        {children}
      </div>

      {slides.length > 1 && (
        <>
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label="Banner anterior"
            className="absolute left-3 top-1/2 z-20 hidden -translate-y-1/2 rounded-full bg-black/25 p-2 text-white transition hover:bg-black/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white sm:block md:left-6"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => navigate(1)}
            aria-label="Próximo banner"
            className="absolute right-3 top-1/2 z-20 hidden -translate-y-1/2 rounded-full bg-black/25 p-2 text-white transition hover:bg-black/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white sm:block md:right-6"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          <div className="absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 gap-2">
            {slides.map((image, index) => (
              <button
                key={image}
                type="button"
                onClick={() => setCurrent(index)}
                aria-label={`Mostrar banner ${index + 1}`}
                aria-pressed={activeIndex === index}
                className={`h-2 rounded-full transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-white ${
                  activeIndex === index ? 'w-7 bg-white' : 'w-2 bg-white/60 hover:bg-white'
                }`}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
