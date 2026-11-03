import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowUp } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Botão flutuante "Voltar ao Topo" com animação suave.
 * @param {'window'|'container'} mode — scroll da página ou de um painel interno
 * @param {React.RefObject<HTMLElement>} containerRef — obrigatório quando mode='container'
 */
export function FloatingScrollTop({
  mode = 'window',
  containerRef,
  threshold = 300,
  label = 'Voltar ao Topo',
  className,
  positionClass = 'fixed bottom-6 right-6 z-50',
}) {
  const [visible, setVisible] = useState(false);

  const getTarget = useCallback(() => {
    if (mode === 'container' && containerRef?.current) return containerRef.current;
    return null;
  }, [mode, containerRef]);

  useEffect(() => {
    const onScroll = () => {
      const el = getTarget();
      const y = el ? el.scrollTop : window.scrollY;
      setVisible(y > threshold);
    };

    const el = getTarget();
    if (mode === 'container' && !el) return undefined;

    onScroll();
    const target = el || window;
    target.addEventListener('scroll', onScroll, { passive: true });
    return () => target.removeEventListener('scroll', onScroll);
  }, [mode, threshold, getTarget, containerRef]);

  const scrollToTop = () => {
    const el = getTarget();
    if (el) {
      el.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          type="button"
          initial={{ opacity: 0, scale: 0.8, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: 10 }}
          onClick={scrollToTop}
          className={cn(
            'flex items-center gap-2 pl-4 pr-3.5 py-3.5 bg-primary hover:bg-[#0c90b0] text-white rounded-full',
            'shadow-[0_4px_20px_rgba(14,165,201,0.4)] hover:shadow-[0_6px_24px_rgba(14,165,201,0.5)]',
            'transition-all border border-[#22d3ee]/30 focus:outline-none focus:ring-2 focus:ring-[#0ea5c9] focus:ring-offset-2 group',
            positionClass,
            className,
          )}
          title={label}
          aria-label={label}
          whileHover={{ y: -3 }}
          whileTap={{ scale: 0.9 }}
        >
          <span className="text-xs font-semibold hidden sm:inline max-w-0 overflow-hidden group-hover:max-w-[120px] transition-all duration-300 whitespace-nowrap">
            {label}
          </span>
          <ArrowUp className="h-5 w-5 stroke-[2.5] shrink-0" />
        </motion.button>
      )}
    </AnimatePresence>
  );
}

export default FloatingScrollTop;
