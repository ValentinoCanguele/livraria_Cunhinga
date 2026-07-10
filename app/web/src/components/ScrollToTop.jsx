import { useLocation } from 'react-router-dom';
import { useLayoutEffect } from 'react';
import { FloatingScrollTop } from '@/components/ui/FloatingScrollTop';

/** Scroll global da página + botão flutuante ao mudar de rota */
const ScrollToTop = () => {
  const { pathname } = useLocation();

  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [pathname]);

  return <FloatingScrollTop mode="window" threshold={300} />;
};

export default ScrollToTop;
