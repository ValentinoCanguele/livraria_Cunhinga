import React, { useEffect, useMemo, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BookOpen, LayoutGrid, GalleryHorizontal, Loader2, ArrowRight, Package } from 'lucide-react';
import { getProducts, getProduct } from '@/api/EcommerceApi';
import CategoryBookMarquee from '@/components/home/CategoryBookMarquee';
import QuickViewModal from '@/components/QuickViewModal';
import { Button } from '@/components/ui/button';
import { buildShowcaseCategories, CATEGORY_SHOP_FILTERS } from '@/lib/catalogCategories';

export default function CatalogShowcase({ onCartOpen }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [modalProduct, setModalProduct] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [viewMode, setViewMode] = useState('marquee');
  const [activeCat, setActiveCat] = useState(null);
  const navRef = useRef(null);

  useEffect(() => {
    getProducts({})
      .then((res) => setProducts(res.products || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selected) {
      setModalProduct(null);
      setModalLoading(false);
      return;
    }
    setModalProduct(selected);
    setModalLoading(true);
    getProduct(selected.id)
      .then(setModalProduct)
      .catch(() => {})
      .finally(() => setModalLoading(false));
  }, [selected]);

  const categories = useMemo(() => buildShowcaseCategories(products), [products]);

  const inStockCount = useMemo(
    () => products.filter((p) => p.purchasable && (p.variants?.[0]?.inventory_quantity ?? 0) > 0).length,
    [products],
  );

  const scrollToCategory = (catId) => {
    setActiveCat(catId);
    const el = document.getElementById(`cat-${catId}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (loading) {
    return (
      <section className="section-spacing bg-background">
        <div className="container-custom flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-muted-foreground">A carregar catálogo completo…</p>
        </div>
      </section>
    );
  }

  if (!categories.length) return null;

  return (
    <>
      <section className="section-spacing bg-gradient-to-b from-background via-muted/10 to-background">
        <div className="container-custom">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-6"
          >
            <div className="text-center lg:text-left">
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-[#0ea5c9]/10 text-[#0c4a6e] mb-3">
                <BookOpen className="h-3.5 w-3.5" />
                Catálogo estratégico
              </span>
              <h2 className="text-3xl md:text-5xl font-bold mb-2">Explore por Tema</h2>
              <p className="text-muted-foreground text-base md:text-lg max-w-2xl">
                {categories.length} categorias · {products.length} livros no catálogo
              </p>
              <div className="flex flex-wrap justify-center lg:justify-start gap-2 mt-4">
                <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-700 border border-emerald-500/20">
                  <Package className="h-3.5 w-3.5" /> {inStockCount} disponíveis
                </span>
                <span className="text-xs px-3 py-1.5 rounded-full bg-muted border text-muted-foreground">
                  Faixas infinitas · direções alternadas
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0">
              <div className="flex border rounded-xl overflow-hidden bg-card shadow-sm">
                <Button
                  type="button"
                  variant={viewMode === 'marquee' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="rounded-none h-9 gap-1.5 px-3"
                  onClick={() => setViewMode('marquee')}
                >
                  <GalleryHorizontal className="h-4 w-4" />
                  Faixas
                </Button>
                <Button
                  type="button"
                  variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="rounded-none h-9 gap-1.5 px-3"
                  onClick={() => setViewMode('grid')}
                >
                  <LayoutGrid className="h-4 w-4" />
                  Grade
                </Button>
              </div>
              <Link to="/shop">
                <Button className="btn-primary h-9 gap-1.5">
                  Loja completa <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </motion.div>

          {/* Navegação rápida por categoria */}
          <div
            ref={navRef}
            className="sticky top-[var(--header-offset,64px)] z-20 -mx-4 px-4 py-2 mb-4 bg-background/85 backdrop-blur-md border-y border-border/50"
          >
            <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => scrollToCategory(cat.id)}
                  className={`shrink-0 text-xs px-3 py-1.5 rounded-full border transition-all whitespace-nowrap ${
                    activeCat === cat.id
                      ? 'text-white shadow-sm'
                      : 'bg-card hover:bg-muted text-foreground'
                  }`}
                  style={activeCat === cat.id ? { background: cat.accent, borderColor: cat.accent } : { borderColor: `${cat.accent}44` }}
                >
                  {cat.title}
                  <span className="ml-1 opacity-70">({cat.books.length})</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="divide-y divide-border/40">
          {categories.map((cat, index) => (
            <CategoryBookMarquee
              key={cat.id}
              id={cat.id}
              title={cat.title}
              description={cat.description}
              accent={cat.accent}
              products={cat.books}
              direction={index % 2 === 0 ? 'ltr' : 'rtl'}
              viewMode={viewMode}
              onBookSelect={setSelected}
              onCartOpen={onCartOpen}
              categoryFilter={CATEGORY_SHOP_FILTERS[cat.id]}
            />
          ))}
        </div>

        <div className="container-custom text-center pt-10 pb-4">
          <p className="text-muted-foreground text-sm mb-4">
            Não encontrou o que procura? Explore o catálogo completo com filtros avançados.
          </p>
          <Link to="/shop">
            <Button size="lg" variant="outline" className="border-[#0ea5c9] text-primary hover:bg-[#0ea5c9]/10">
              Abrir loja completa <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      <QuickViewModal
        product={modalProduct}
        loading={modalLoading}
        open={!!selected}
        onClose={() => setSelected(null)}
        onCartOpen={onCartOpen}
      />
    </>
  );
}
