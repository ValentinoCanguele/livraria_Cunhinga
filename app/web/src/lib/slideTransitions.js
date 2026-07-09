/** Transições estilo TV / broadcast para sliders */
export const SLIDE_TRANSITIONS = {
  fade: {
    id: 'fade',
    label: 'Fade suave',
    bg: { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.9, ease: 'easeInOut' } },
    text: { initial: { opacity: 0, y: 24 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -16 }, transition: { duration: 0.55, delay: 0.15 } },
  },
  slide: {
    id: 'slide',
    label: 'Slide lateral',
    bg: { initial: { opacity: 0, x: 80 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -80 }, transition: { duration: 0.75, ease: [0.22, 1, 0.36, 1] } },
    text: { initial: { opacity: 0, x: 40 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -30 }, transition: { duration: 0.5, delay: 0.1 } },
  },
  wipe: {
    id: 'wipe',
    label: 'Wipe (TV)',
    bg: { initial: { opacity: 0, clipPath: 'inset(0 100% 0 0)' }, animate: { opacity: 1, clipPath: 'inset(0 0% 0 0)' }, exit: { opacity: 0, clipPath: 'inset(0 0 0 100%)' }, transition: { duration: 0.85, ease: [0.4, 0, 0.2, 1] } },
    text: { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0 }, transition: { duration: 0.45, delay: 0.25 } },
  },
  zoom: {
    id: 'zoom',
    label: 'Zoom cinematográfico',
    bg: { initial: { opacity: 0, scale: 1.12 }, animate: { opacity: 1, scale: 1 }, exit: { opacity: 0, scale: 0.96 }, transition: { duration: 1, ease: [0.25, 0.46, 0.45, 0.94] } },
    text: { initial: { opacity: 0, scale: 0.95, y: 16 }, animate: { opacity: 1, scale: 1, y: 0 }, exit: { opacity: 0, y: -12 }, transition: { duration: 0.5, delay: 0.2 } },
  },
};

export function sortSlides(slides = []) {
  return [...slides].sort((a, b) => {
    const aPrimary = a.is_primary ? 1 : 0;
    const bPrimary = b.is_primary ? 1 : 0;
    if (bPrimary !== aPrimary) return bPrimary - aPrimary;
    return (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0);
  });
}

export function getTransition(slide) {
  const key = slide?.transition || 'fade';
  return SLIDE_TRANSITIONS[key] || SLIDE_TRANSITIONS.fade;
}

export function getSlideDuration(slide, fallback = 6000) {
  const ms = Number(slide?.duration_ms);
  return ms > 2000 ? ms : fallback;
}
