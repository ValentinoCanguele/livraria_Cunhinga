import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getShopSlides } from '@/api/EcommerceApi';
import { sortSlides, getTransition, getSlideDuration } from '@/lib/slideTransitions';
import { resolveShopBgMode } from '@/lib/shopTheme';

function ShopSlideMedia({ slide }) {
  if (slide.media_type === 'video' && slide.video_url) {
    return (
      <video src={slide.video_url} className="absolute inset-0 w-full h-full object-cover" autoPlay muted loop playsInline poster={slide.image} />
    );
  }
  if (slide.image) {
    const isSvg = slide.image.endsWith('.svg') || slide.image.includes('image/svg');
    return (
      <div
        className="absolute inset-0 w-full h-full bg-cover bg-center"
        style={{
          backgroundImage: `url(${slide.image})`,
          backgroundSize: isSvg ? 'contain' : 'cover',
          backgroundRepeat: isSvg ? 'repeat' : 'no-repeat',
        }}
      />
    );
  }
  return null;
}

export default function ShopHeroBackground({ settings, children }) {
  const mode = resolveShopBgMode(settings);
  const overlay = Number(settings.shop_bg_overlay) ?? 0.55;
  const [slides, setSlides] = useState([]);
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (mode === 'slides') {
      getShopSlides().then((data) => {
        setSlides(sortSlides(data));
        setCurrent(0);
      });
    }
  }, [mode]);

  const slide = slides[current];
  const duration = slide ? getSlideDuration(slide, 8000) : 8000;
  const transition = slide ? getTransition(slide) : null;

  const next = useCallback(() => {
    setCurrent((i) => (i + 1) % slides.length);
  }, [slides.length]);

  useEffect(() => {
    if (mode !== 'slides' || slides.length <= 1 || paused) return undefined;
    const t = setInterval(next, duration);
    return () => clearInterval(t);
  }, [mode, slides.length, paused, duration, next]);

  const gradientStyle = {
    background: 'linear-gradient(135deg, var(--brand-dark) 0%, var(--brand-primary) 100%)',
  };

  return (
    <section
      className="text-white py-14 md:py-20 relative overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {mode === 'gradient' && (
        <>
          <div className="absolute inset-0" style={gradientStyle} />
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_30%_20%,white,transparent_50%)]" />
        </>
      )}

      {mode === 'image' && settings.shop_bg_image_url && (
        <>
          <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${settings.shop_bg_image_url})` }} />
          <div className="absolute inset-0" style={{ background: `rgba(12, 74, 110, ${overlay})` }} />
        </>
      )}

      {mode === 'video' && settings.shop_bg_video_url && (
        <>
          <video src={settings.shop_bg_video_url} className="absolute inset-0 w-full h-full object-cover" autoPlay muted loop playsInline poster={settings.shop_bg_image_url || undefined} />
          <div className="absolute inset-0" style={{ background: `rgba(12, 74, 110, ${overlay})` }} />
        </>
      )}

      {mode === 'slides' && slides.length > 0 && slide && (
        <AnimatePresence mode="wait">
          <motion.div key={slide.id} className="absolute inset-0" {...(transition?.bg || {})}>
            <ShopSlideMedia slide={slide} />
            <div className="absolute inset-0" style={{ background: `rgba(12, 74, 110, ${overlay})` }} />
          </motion.div>
        </AnimatePresence>
      )}

      {mode === 'slides' && slides.length === 0 && <div className="absolute inset-0" style={gradientStyle} />}

      {mode === 'image' && !settings.shop_bg_image_url && <div className="absolute inset-0" style={gradientStyle} />}

      {mode === 'video' && !settings.shop_bg_video_url && <div className="absolute inset-0" style={gradientStyle} />}

      <div className="container-custom relative z-10">{children}</div>

      {mode === 'slides' && slides.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex gap-1.5">
          {slides.map((s, i) => (
            <button key={s.id} type="button" onClick={() => setCurrent(i)} className={`h-1.5 rounded-full transition-all ${i === current ? 'w-6 bg-white' : 'w-1.5 bg-white/40'}`} aria-label={`Slide ${i + 1}`} />
          ))}
        </div>
      )}
    </section>
  );
}
