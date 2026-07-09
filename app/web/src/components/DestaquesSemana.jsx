import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, ShoppingCart, Eye, Download, TrendingUp, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getProducts, formatCurrency } from '@/api/EcommerceApi';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useCart } from '@/hooks/useCart';

export default function DestaquesSemana({ onCartOpen }) {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const timerRef = useRef(null);
  const { addToCart } = useCart();
  const { toast } = useToast();

  useEffect(() => {
    getProducts()
      .then((res) => {
        const sorted = (res.products || [])
          .map((b) => ({
            ...b,
            score: (b.vendidos || 0) * 4 + (b.compras || 0) * 3 + (b.lido || 0) * 2 + (b.baixados || 0),
          }))
          .sort((a, b) => b.score - a.score || b.featured - a.featured);
        // Show up to 5 highlights of the week
        setBooks(sorted.slice(0, 5));
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (books.length <= 1) return undefined;
    timerRef.current = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % books.length);
    }, 6000);
    return () => clearInterval(timerRef.current);
  }, [books.length]);

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
      addToCart(currentBook, currentBook.variants[0], 1);
      toast({
        title: 'Adicionado ao carrinho!',
        description: `${currentBook.title} foi adicionado com sucesso.`,
      });
      if (onCartOpen) onCartOpen();
    }
  };

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-slate-900 via-slate-950 to-background text-white py-16 md:py-24 border-b border-border">
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
            <h2 className="text-3xl md:text-5xl font-black tracking-tight">Promovidos e Mais Populares</h2>
            <p className="text-slate-400 mt-2 text-base md:text-lg">As escolhas e os recordistas da nossa comunidade</p>
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
                <Link to={`/product/${currentBook.id}`} className="group relative block aspect-[3/4] w-64 md:w-full max-w-[280px] rounded-2xl overflow-hidden shadow-[0_20px_50px_rgba(14,165,201,0.25)] border border-slate-800">
                  <img
                    src={currentBook.image || 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=400&q=80'}
                    alt={currentBook.title}
                    className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4 justify-center">
                    <span className="text-sm font-semibold bg-[#0ea5c9] text-white px-4 py-2 rounded-full">Saber Mais</span>
                  </div>
                </Link>
              </div>

              {/* Product Meta & Stats Details */}
              <div className="md:col-span-7 lg:col-span-8 space-y-6">
                <div>
                  <h3 className="text-2xl md:text-4xl font-extrabold text-white leading-tight line-clamp-2">
                    {currentBook.title}
                  </h3>
                  {currentBook.subtitle && (
                    <p className="text-[#22d3ee] font-medium text-lg mt-1">{currentBook.subtitle}</p>
                  )}
                </div>

                <p className="text-slate-300 text-base md:text-lg line-clamp-3 leading-relaxed">
                  {currentBook.description || 'Nenhuma sinopse disponível para este livro.'}
                </p>

                {/* Popularity Metrics Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-slate-900/60 p-4 md:p-6 rounded-2xl border border-slate-800">
                  <div className="space-y-1">
                    <span className="text-slate-400 text-xs uppercase tracking-wider block">Vendidos</span>
                    <div className="flex items-center gap-1.5 font-bold text-lg text-emerald-400">
                      <TrendingUp className="h-4 w-4" />
                      {currentBook.vendidos || 0} un.
                    </div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-slate-400 text-xs uppercase tracking-wider block">Leituras</span>
                    <div className="flex items-center gap-1.5 font-bold text-lg text-cyan-400">
                      <Eye className="h-4 w-4" />
                      {currentBook.lido || 0} leitores
                    </div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-slate-400 text-xs uppercase tracking-wider block">Downloads</span>
                    <div className="flex items-center gap-1.5 font-bold text-lg text-amber-400">
                      <Download className="h-4 w-4" />
                      {currentBook.baixados || 0} downloads
                    </div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-slate-400 text-xs uppercase tracking-wider block">Compras</span>
                    <div className="flex items-center gap-1.5 font-bold text-lg text-purple-400">
                      <ShoppingCart className="h-4 w-4" />
                      {currentBook.compras || 0} compras
                    </div>
                  </div>
                </div>

                {/* Purchase Button */}
                <div className="flex flex-wrap items-center gap-4 pt-2">
                  <div className="text-2xl md:text-3xl font-black text-white">
                    {formatCurrency(currentBook.price_in_cents)}
                  </div>

                  <div className="flex gap-3 w-full sm:w-auto">
                    <Link to={`/product/${currentBook.id}`} className="flex-1 sm:flex-initial">
                      <Button variant="outline" className="w-full bg-slate-900 text-white border-slate-700 hover:bg-slate-800">
                        Detalhes
                      </Button>
                    </Link>
                    {currentBook.purchasable ? (
                      <Button onClick={handleAddToCart} className="flex-1 sm:flex-initial bg-[#0ea5c9] hover:bg-[#0c90b0] text-white">
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
        <div className="flex justify-center gap-2 mt-12">
          {books.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentIndex(i)}
              className={`h-2 rounded-full transition-all duration-300 ${
                i === currentIndex ? 'w-8 bg-[#0ea5c9]' : 'w-2 bg-slate-700 hover:bg-slate-600'
              }`}
              aria-label={`Ir para destaque ${i + 1}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
