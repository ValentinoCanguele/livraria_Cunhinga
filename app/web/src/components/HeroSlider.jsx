import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getHeroSlides } from '@/api/EcommerceApi';
import { sortSlides, getTransition, getSlideDuration } from '@/lib/slideTransitions';
import { sanitizeHtml } from '@/lib/sanitizeHtml';

const FALLBACK_SLIDES = [
  {
    id: '1',
    title: 'Catálogo Oficial da Livraria',
    subtitle: 'Mais de 100 títulos adventistas — teologia, família, saúde e muito mais.',
    image: 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=1920&q=80',
    cta_text: 'Ver Catálogo Geral',
    cta_link: '/shop?category=Cat%C3%A1logo%20Geral',
    template: 'classic',
    is_primary: true,
    transition: 'fade',
    media_type: 'image',
  },
  {
    id: '2',
    title: 'Obras de Ellen G. White',
    subtitle: 'Clássicos da literatura adventista disponíveis na nossa loja.',
    image: 'https://images.unsplash.com/photo-1456513088650-9b9390942247?w=1920&q=80',
    cta_text: 'Pesquisar Ellen G. White',
    cta_link: '/shop?search=Ellen',
    template: 'classic',
    transition: 'slide',
    media_type: 'image',
  },
  {
    id: '3',
    title: 'Colportagem',
    subtitle: 'Títulos para evangelização e saúde com condições especiais.',
    image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=1920&q=80',
    cta_text: 'Ver Colportagem',
    cta_link: '/shop?category=Colportagem',
    template: 'minimal',
    transition: 'wipe',
    media_type: 'image',
  },
];

function SlideMedia({ slide, eager }) {
  const isVideo = slide.media_type === 'video' && slide.video_url;
  if (isVideo) {
    return (
      <video
        src={slide.video_url}
        className="w-full h-full object-cover"
        autoPlay
        muted
        loop
        playsInline
        poster={slide.image || undefined}
      />
    );
  }
  return (
    <img
      src={slide.image}
      alt={slide.title}
      className="w-full h-full object-cover"
      loading={eager ? 'eager' : 'lazy'}
    />
  );
}

function SlideContent({ slide }) {
  const template = slide.template || 'classic';
  // 0 significa "sem preço promocional" (é o valor por omissão do campo).
  const priceLabel = Number(slide.promo_price) > 0
    ? `Kz ${Number(slide.promo_price).toLocaleString('pt-AO', { minimumFractionDigits: 2 })}`
    : null;

  const ctaButton = slide.cta_link ? (
    <Link to={slide.cta_link}>
      <Button size="lg" className="btn-primary text-base md:text-lg px-6 md:px-8 py-5 md:py-6 rounded-full mt-6">
        {slide.cta_text || 'Explorar'}
        <ArrowRight className="ml-2 h-5 w-5" />
      </Button>
    </Link>
  ) : null;

  if (template === 'book_promo') {
    return (
      <div className="flex flex-col md:flex-row items-center gap-8 md:gap-12 max-w-4xl text-white">
        {(slide.book_cover || slide.image) && (
          <img src={slide.book_cover || slide.image} alt={slide.book_title || slide.title} className="w-40 md:w-52 h-auto rounded-xl shadow-2xl ring-4 ring-white/20" />
        )}
        <div>
          {slide.promo_badge && <span className="inline-block bg-amber-400 text-amber-900 text-xs font-bold px-3 py-1 rounded-full mb-3">{slide.promo_badge}</span>}
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-3 leading-tight">{slide.title}</h1>
          {slide.book_author && <p className="text-[#22d3ee] font-medium mb-2">{slide.book_author}</p>}
          {slide.subtitle && <p className="text-lg text-white/85 mb-2">{slide.subtitle}</p>}
          {slide.body_html && <div className="text-sm text-white/75 prose prose-invert prose-sm max-w-none mb-2" dangerouslySetInnerHTML={{ __html: sanitizeHtml(slide.body_html) }} />}
          {priceLabel && <p className="text-3xl font-bold text-[#22d3ee]">{priceLabel}</p>}
          {ctaButton}
        </div>
      </div>
    );
  }

  if (template === 'split') {
    return (
      <div className="grid md:grid-cols-2 gap-8 items-center max-w-5xl text-white w-full">
        <div className="hidden md:block rounded-2xl overflow-hidden shadow-2xl aspect-[4/3]">
          <SlideMedia slide={slide} eager={false} />
        </div>
        <div>
          {slide.promo_badge && <span className="inline-block bg-white/20 text-white text-xs font-bold px-3 py-1 rounded-full mb-3">{slide.promo_badge}</span>}
          <h1 className="text-4xl md:text-5xl font-bold mb-4 leading-tight">{slide.title}</h1>
          {slide.subtitle && <p className="text-lg text-white/85 mb-4">{slide.subtitle}</p>}
          {slide.body_html && <div className="text-sm text-white/75 prose prose-invert prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: sanitizeHtml(slide.body_html) }} />}
          {ctaButton}
        </div>
      </div>
    );
  }

  if (template === 'minimal') {
    return (
      <div className="max-w-3xl mx-auto text-center text-white">
        {slide.promo_badge && <span className="inline-block bg-white/15 text-white text-xs font-bold px-3 py-1 rounded-full mb-4">{slide.promo_badge}</span>}
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-4 text-balance">{slide.title}</h1>
        {slide.subtitle && <p className="text-lg md:text-xl text-white/80 mb-4">{slide.subtitle}</p>}
        {slide.body_html && <div className="text-sm text-white/70 prose prose-invert prose-sm max-w-none mx-auto" dangerouslySetInnerHTML={{ __html: sanitizeHtml(slide.body_html) }} />}
        <div className="flex justify-center">{ctaButton}</div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl text-white">
      {slide.promo_badge && <span className="inline-block bg-amber-400/90 text-amber-900 text-xs font-bold px-3 py-1 rounded-full mb-3">{slide.promo_badge}</span>}
      <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold mb-4 md:mb-6 text-balance leading-tight">{slide.title}</h1>
      {slide.subtitle && <p className="text-lg md:text-xl text-white/85 mb-4 max-w-xl">{slide.subtitle}</p>}
      {slide.body_html && <div className="text-sm text-white/75 prose prose-invert prose-sm max-w-none mb-4" dangerouslySetInnerHTML={{ __html: sanitizeHtml(slide.body_html) }} />}
      {priceLabel && <p className="text-2xl font-bold text-[#22d3ee] mb-2">{priceLabel}</p>}
      {ctaButton}
    </div>
  );
}

const HeroSlider = () => {
  const [slides, setSlides] = useState(FALLBACK_SLIDES);
  const [current, setCurrent] = useState(0);
  const [loading, setLoading] = useState(true);
  const [paused, setPaused] = useState(false);
  const [progressKey, setProgressKey] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => {
    getHeroSlides('home')
      .then((data) => {
        if (data.length > 0) {
          const sorted = sortSlides(data);
          setSlides(sorted);
          setCurrent(0);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const slide = slides[current] || slides[0];
  const duration = getSlideDuration(slide);
  const transition = getTransition(slide);
  const isSplit = slide?.template === 'split';

  const goTo = useCallback((index) => {
    setCurrent((index + slides.length) % slides.length);
    setProgressKey((k) => k + 1);
  }, [slides.length]);

  const next = useCallback(() => goTo(current + 1), [current, goTo]);
  const prev = useCallback(() => goTo(current - 1), [current, goTo]);

  useEffect(() => {
    if (slides.length <= 1 || paused) return undefined;
    timerRef.current = setInterval(() => {
      setCurrent((i) => (i + 1) % slides.length);
      setProgressKey((k) => k + 1);
    }, duration);
    return () => clearInterval(timerRef.current);
  }, [slides.length, paused, duration, current]);

  if (!slide) return null;

  return (
    <section
      className="relative h-[85vh] min-h-[520px] max-h-[900px] overflow-hidden bg-foreground"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <AnimatePresence mode="wait">
        <motion.div key={`bg-${slide.id}-${current}`} className="absolute inset-0" {...transition.bg}>
          {!isSplit && (
            <>
              <SlideMedia slide={slide} eager={current === 0} />
              <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/45 to-black/20" />
            </>
          )}
          {isSplit && <div className="absolute inset-0 bg-gradient-to-br from-[var(--brand-dark)] to-[var(--brand-primary)]" />}
        </motion.div>
      </AnimatePresence>

      <div className="relative z-10 h-full flex items-center">
        <div className="container-custom w-full">
          <AnimatePresence mode="wait">
            <motion.div key={`text-${slide.id}-${current}`} {...transition.text}>
              <SlideContent slide={slide} />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {slides.length > 1 && (
        <>
          <button type="button" onClick={prev} className="absolute left-4 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-black/30 hover:bg-black/50 text-white transition-colors backdrop-blur-sm" aria-label="Slide anterior">
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button type="button" onClick={next} className="absolute right-4 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-black/30 hover:bg-black/50 text-white transition-colors backdrop-blur-sm" aria-label="Próximo slide">
            <ChevronRight className="h-6 w-6" />
          </button>
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex gap-2">
            {slides.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => goTo(i)}
                className={`h-2 rounded-full transition-all duration-300 ${i === current ? 'w-8 bg-white' : 'w-2 bg-white/40 hover:bg-white/60'}`}
                aria-label={`Ir para slide ${i + 1}${s.is_primary ? ' (principal)' : ''}`}
              />
            ))}
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20 z-20">
            {!paused && (
              <motion.div
                key={`progress-${current}-${progressKey}`}
                className="h-full bg-[var(--brand-primary)]"
                initial={{ width: '0%' }}
                animate={{ width: '100%' }}
                transition={{ duration: duration / 1000, ease: 'linear' }}
              />
            )}
          </div>
        </>
      )}

      {loading && <div className="absolute inset-0 z-30 bg-background/20 animate-pulse pointer-events-none" />}
    </section>
  );
};

export default HeroSlider;
