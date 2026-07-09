import { useLocation } from 'react-router-dom';
import { useLayoutEffect, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowUp } from 'lucide-react';

const ScrollToTop = () => {
  const { pathname } = useLocation();
  const [isVisible, setIsVisible] = useState(false);

  // Auto scroll to top on page change
  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [pathname]);

  // Monitor scroll height to toggle button visibility
  useEffect(() => {
    const toggleVisibility = () => {
      if (window.scrollY > 300) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    window.addEventListener('scroll', toggleVisibility);
    return () => window.removeEventListener('scroll', toggleVisibility);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: 10 }}
          onClick={scrollToTop}
          className="fixed bottom-6 right-6 z-50 p-3.5 bg-[#0ea5c9] hover:bg-[#0c90b0] text-white rounded-full shadow-[0_4px_20px_rgba(14,165,201,0.4)] hover:shadow-[0_6px_24px_rgba(14,165,201,0.5)] transition-all border border-[#22d3ee]/30 focus:outline-none focus:ring-2 focus:ring-[#0ea5c9] focus:ring-offset-2"
          title="Voltar ao Topo"
          aria-label="Voltar ao Topo"
          whileHover={{ y: -3 }}
          whileTap={{ scale: 0.9 }}
        >
          <ArrowUp className="h-5 w-5 stroke-[2.5]" />
        </motion.button>
      )}
    </AnimatePresence>
  );
};

export default ScrollToTop;
