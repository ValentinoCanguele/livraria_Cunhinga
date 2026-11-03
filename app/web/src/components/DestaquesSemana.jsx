import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, ShoppingCart, Sparkles, BookOpen } from 'lucide-react';
import { getFeaturedProducts, formatCurrency } from '@/api/EcommerceApi';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useCart } from '@/hooks/useCart';
import QuickViewModal from '@/components/QuickViewModal';

const PLACEHOLDER = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjMzc0MTUxIi8+CiAgPHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxOCIgZmlsbD0iIzlDQTNBRiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk5vIEltYWdlPC90ZXh0Pgo8L3N2Zz4K";

export default function DestaquesSemana({ onCartOpen }) {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [quickView, setQuickView] = useState(null);
  const timerRef = useRef(null);
  const { addToCart } = useCart();
  const { toast } = useToast();

  useEffect(() => {
    getFeaturedProducts(12)
      .then((res) => {
        const inStock = (b) => b.purchasable && (b.variants?.[0]?.inventory_quantity ?? 0) > 0;
        const sorted = (res.products || [])
          .filter((b) => b.book_code || inStock(b))
          .sort((a, b) =>
            (b.featured ? 1 : 0) - (a.featured ? 1 : 0)
            || (inStock(b) ? 1 : 0) - (inStock(a) ? 1 : 0)
            || (b.order || 0) - (a.order || 0),
          );
        setBooks(sorted.slice(0, 5));
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (books.length <= 1 || paused) return undefined;
    timerRef.current = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % books.length);
    }, 6000);
    return () => clearInterval(timerRef.current);
  }, [books.length, paused]);

  if (loading) {
    return (
      <div className="w-full bg-[#0ea5c9]/5 py-12">
        <div className="container-custom">
          <div className="h-96 w-full rounded-2xl bg-muted animate-pulse flex items-center justify-center">
            <p className="text-muted-foreground">Carregando Destaques da Semana...</p>
          </div>
        </div>
      </div>
    );
  }

  if (books.length === 0) return null;

  const currentBook = books[currentIndex];

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % books.length);
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + books.length) % books.length);
  };

  const handleAddToCart = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (currentBook.variants && currentBook.variants[0]) {
      addToCart(currentBook, currentBook.variants[0], 1, { silent: true });
      toast({
        title: 'Adicionado ao carrinho!',
        description: `${currentBook.title} foi adicionado com sucesso.`,
      });
      if (onCartOpen) onCartOpen();
    }
  };

  return (
    <>
    <section
      className="relative overflow-hidden bg-gradient-to-b from-slate-900 via-slate-950 to-background text-white py-16 md:py-24 border-b border-border"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Decorative ambient blobs */}
      <div className="absolute -top-40 -right-40 w-96 h-96 bg-[#0ea5c9]/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="container-custom relative z-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-4">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-[#0ea5c9]/20 text-[#22d3ee] mb-3">
              <Sparkles className="h-3.5 w-3.5" /> DESTAQUES DA SEMANA
            </span>
            <h2 className="text-3xl md:text-5xl font-black tracking-tight">Destaques do Catálogo</h2>
            <p className="text-slate-400 mt-2 text-base md:text-lg">Livros reais da livraria — em stock e seleccionados</p>
          </motion.div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrev}
              className="p-3 rounded-full bg-slate-800/80 hover:bg-slate-700/80 transition-colors border border-slate-700"
              aria-label="Anterior"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <span className="text-sm font-medium px-3 text-slate-400">
              {currentIndex + 1} / {books.length}
            </span>
            <button
              onClick={handleNext}
              className="p-3 rounded-full bg-slate-800/80 hover:bg-slate-700/80 transition-colors border border-slate-700"
              aria-label="Seguinte"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="relative min-h-[460px] flex items-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentBook.id}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -30 }}
              transition={{ duration: 0.5, ease: 'easeInOut' }}
              className="grid md:grid-cols-12 gap-8 md:gap-12 items-center w-full"
            >
              {/* Product Cover image */}
              <div className="md:col-span-5 lg:col-span-4 flex justify-center">
                <button
                  type="button"
                  onClick={() => setQuickView(currentBook)}
                  className="group relative block aspect-[3/4] w-64 md:w-full max-w-[280px] rounded-2xl overflow-hidden shadow-[0_20px_50px_rgba(14,165,201,0.25)] border border-slate-800 text-left"
                >
                  <img
                    src={currentBook.image || PLACEHOLDER}
                    alt={currentBook.title}
                    className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4 justify-center">
                    <span className="text-sm font-semibold bg-primary text-white px-4 py-2 rounded-full">Ver detalhes</span>
                  </div>
                </button>
              </div>

              {/* Product Meta & Stats Details */}
              <div className="md:col-span-7 lg:col-span-8 space-y-6">
                <div>
                  {currentBook.book_code && (
                    <code className="text-xs text-[#22d3ee] font-mono">{currentBook.book_code}</code>
                  )}
                  <h3 className="text-2xl md:text-4xl font-extrabold text-white leading-tight line-clamp-2 mt-1">
                    {currentBook.title}
                  </h3>
                  {currentBook.subtitle && (
                    <p className="text-[#22d3ee] font-medium text-lg mt-1">{currentBook.subtitle}</p>
                  )}
                  {currentBook.type?.value && (
                    <span className="inline-block mt-2 text-xs px-2 py-0.5 rounded-full bg-white/10 border border-white/15">
                      {currentBook.type.value}
                    </span>
                  )}
                </div>

                <p className="text-slate-300 text-base md:text-lg line-clamp-3 leading-relaxed">
                  {currentBook.description?.replace(/<[^>]+>/g, ' ').trim() || 'Literatura adventista de qualidade — disponível na nossa loja.'}
                </p>

                {/* Purchase Button */}
                <div className="flex flex-wrap items-center gap-4 pt-2">
                  <div className="text-2xl md:text-3xl font-black text-white">
                    {formatCurrency(currentBook.price_in_cents)}
                  </div>

                  <div className="flex gap-3 w-full sm:w-auto">
                    <Button variant="outline" className="flex-1 sm:flex-initial bg-slate-900 text-white border-slate-700 hover:bg-slate-800" onClick={() => setQuickView(currentBook)}>
                      <BookOpen className="h-4 w-4 mr-2" /> Detalhes
                    </Button>
                    {currentBook.purchasable ? (
                      <Button onClick={handleAddToCart} className="flex-1 sm:flex-initial bg-primary hover:bg-[#0c90b0] text-white">
                        <ShoppingCart className="h-4 w-4 mr-2" />
                        Comprar Agora
                      </Button>
                    ) : (
                      <Button disabled className="bg-slate-800 text-slate-500">
                        Fora de Stock
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Slide indicators */}
        {/* O ponto mede 8px: em vez de o engordar, o botão à volta dele passa a medir 24,
            o mínimo que a WCAG 2.5.8 pede em AA. O intervalo sai do contentor porque o
            preenchimento de cada botão já afasta os pontos — somados, davam alvos
            encostados a nada e uma fila larga de mais. */}
        <div className="flex justify-center mt-12">
          {books.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setCurrentIndex(i)}
              className="group grid h-6 place-items-center px-2"
              aria-label={`Ir para destaque ${i + 1}`}
            >
              <span className={`block h-2 rounded-full transition-all duration-300 ${
                i === currentIndex ? 'w-8 bg-primary' : 'w-2 bg-slate-700 group-hover:bg-slate-600'
              }`} />
            </button>
          ))}
        </div>
      </div>
    </section>

    <QuickViewModal
      product={quickView}
      open={!!quickView}
      onClose={() => setQuickView(null)}
      onCartOpen={onCartOpen}
    />
    </>
  );
}
