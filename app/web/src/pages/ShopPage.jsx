import React, { useState, useMemo, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  SlidersHorizontal, X, LayoutGrid, List, BookOpen, Sparkles,
  Layers, Star, Package, ChevronRight, TrendingUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useProductFilters } from '@/hooks/useProductFilters.jsx';
import ProductsList from '@/components/ProductsList.jsx';
import FilterPanel from '@/components/FilterPanel.jsx';
import Header from '@/components/Header.jsx';
import Footer from '@/components/Footer.jsx';
import ShoppingCart from '@/components/ShoppingCart.jsx';
import AdvancedSearchPanel from '@/components/AdvancedSearchPanel';
import ShopHeroBackground from '@/components/ShopHeroBackground';
import ProductCard from '@/components/ProductCard';
import { pageTitle } from '@/lib/brand';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { applyShopTheme, shopDefaults } from '@/lib/shopTheme';

const SORT_OPTIONS = [
  { value: 'featured', label: 'Destaques' },
  { value: 'title', label: 'A – Z' },
  { value: 'price-low', label: 'Preço: Menor ao Maior' },
  { value: 'price-high', label: 'Preço: Maior ao Menor' },
  { value: 'newest', label: 'Novidades' },
];

function sortProducts(products, sortBy) {
  return [...products].sort((a, b) => {
    if (sortBy === 'price-low') return a.price_in_cents - b.price_in_cents;
    if (sortBy === 'price-high') return b.price_in_cents - a.price_in_cents;
    if (sortBy === 'title') return (a.title || '').localeCompare(b.title || '');
    if (sortBy === 'newest') return (b.order || 0) - (a.order || 0);
    if (sortBy === 'featured') return (b.featured ? 1 : 0) - (a.featured ? 1 : 0) || (b.order || 0) - (a.order || 0);
    return (b.order || 0) - (a.order || 0);
  });
}

const ShopPage = () => {
  const { settings } = useSiteSettings();
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(null);

  const shop = {
    ...shopDefaults,
    ...settings,
    shop_per_page: Number(settings.shop_per_page) || shopDefaults.shop_per_page,
    shop_grid_columns: Number(settings.shop_grid_columns) || shopDefaults.shop_grid_columns,
    shop_show_featured: settings.shop_show_featured !== false,
    shop_show_collections: settings.shop_show_collections !== false,
    shop_show_low_stock: settings.shop_show_low_stock !== false,
  };

  const [sortBy, setSortBy] = useState(shop.shop_default_sort || 'featured');
  const [viewMode, setViewMode] = useState('grid');

  useEffect(() => {
    applyShopTheme(settings);
  }, [settings]);

  useEffect(() => {
    setSortBy(shop.shop_default_sort || 'featured');
  }, [shop.shop_default_sort]);

  const {
    allProducts,
    bookCollections,
    availableFilters,
    filteredProducts,
    activeFilters,
    updateFilter,
    updateOptionFilter,
    clearFilters,
    filterCount,
    catalogStats,
    hasActiveBrowsing,
    isLoading,
  } = useProductFilters();

  const sortedProducts = useMemo(
    () => sortProducts(filteredProducts, sortBy),
    [filteredProducts, sortBy]
  );

  const perPage = shop.shop_per_page;
  const displayProducts = visibleCount ? sortedProducts.slice(0, visibleCount) : sortedProducts.slice(0, perPage);
  const hasMore = sortedProducts.length > displayProducts.length;

  useEffect(() => {
    setVisibleCount(null);
  }, [filteredProducts, sortBy, filterCount, activeFilters.search]);

  const featuredProducts = useMemo(
    () => allProducts.filter((p) => p.featured).slice(0, 8),
    [allProducts]
  );

  const lowStockProducts = useMemo(
    () => allProducts.filter((p) => p.purchasable && (p.variants?.[0]?.inventory_quantity ?? 0) <= 5).slice(0, 6),
    [allProducts]
  );

  const gridClass = {
    3: 'xl:grid-cols-3',
    4: 'xl:grid-cols-4',
  }[shop.shop_grid_columns] || 'xl:grid-cols-4';

  const heroTitle = shop.shop_hero_title || shopDefaults.shop_hero_title;
  const heroSubtitle = shop.shop_hero_subtitle || shop.tagline || shopDefaults.shop_hero_subtitle;
  const heroBadge = shop.shop_hero_badge || shopDefaults.shop_hero_badge;

  const activeFilterChips = [
    activeFilters.search && { key: 'search', label: `«${activeFilters.search}»`, clear: () => updateFilter('search', '') },
    activeFilters.author && { key: 'author', label: `Autor: ${activeFilters.author}`, clear: () => updateFilter('author', '') },
    activeFilters.collection && bookCollections.find((c) => c.id === activeFilters.collection) && {
      key: 'collection',
      label: bookCollections.find((c) => c.id === activeFilters.collection).title,
      clear: () => updateFilter('collection', ''),
    },
    ...activeFilters.categories.map((c) => ({
      key: `cat-${c}`,
      label: c,
      clear: () => updateFilter('categories', activeFilters.categories.filter((x) => x !== c)),
    })),
    activeFilters.inStockOnly && { key: 'stock', label: 'Com stock', clear: () => updateFilter('inStockOnly', false) },
    activeFilters.featuredOnly && { key: 'feat', label: 'Destaques', clear: () => updateFilter('featuredOnly', false) },
  ].filter(Boolean);

  return (
    <>
      <Helmet>
        <title>{pageTitle(`${heroTitle} — ${settings.site_name || 'Loja'}`)}</title>
        <meta name="description" content={heroSubtitle} />
      </Helmet>

      <Header onCartOpen={() => setIsCartOpen(true)} />
      <ShoppingCart isCartOpen={isCartOpen} setIsCartOpen={setIsCartOpen} />

      {/* Hero personalizável com fundo configurável */}
      <ShopHeroBackground settings={shop}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="flex items-center gap-2 text-white/70 text-sm mb-4">
              <Sparkles className="h-4 w-4" />
              <span>{heroBadge}</span>
              <span className="text-white/40">·</span>
              <Link to="/" className="hover:text-white transition-colors">Início</Link>
              <ChevronRight className="h-3 w-3" />
              <span className="text-white">Loja</span>
            </div>
            <h1 className="text-3xl md:text-5xl font-bold mb-3 tracking-tight">{heroTitle}</h1>
            <p className="text-white/85 max-w-2xl text-lg mb-8">{heroSubtitle}</p>

            {/* Estatísticas do catálogo */}
            {!isLoading && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8 max-w-2xl">
                {[
                  { icon: BookOpen, label: 'Livros', value: catalogStats.total },
                  { icon: Package, label: 'Disponíveis', value: catalogStats.inStock },
                  { icon: Star, label: 'Destaques', value: catalogStats.featured },
                  { icon: Layers, label: 'Coleções', value: catalogStats.collections },
                ].map(({ icon: Icon, label, value }) => (
                  <div key={label} className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3 border border-white/10">
                    <Icon className="h-4 w-4 text-white/70 mb-1" />
                    <p className="text-2xl font-bold">{value}</p>
                    <p className="text-xs text-white/70">{label}</p>
                  </div>
                ))}
              </div>
            )}

            <AdvancedSearchPanel
              activeFilters={activeFilters}
              updateFilter={updateFilter}
              className="max-w-2xl"
              variant="hero"
              bookCollections={bookCollections}
              publishers={availableFilters.publishers}
              resultCount={hasActiveBrowsing ? filteredProducts.length : undefined}
              filterCount={filterCount}
            />
          </motion.div>
      </ShopHeroBackground>

      {/* Destaques — só sem filtros activos */}
      {!hasActiveBrowsing && shop.shop_show_featured && featuredProducts.length > 0 && (
        <section className="border-b border-border bg-gradient-to-b from-amber-50/50 to-background dark:from-amber-950/10">
          <div className="container-custom py-10">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Star className="h-5 w-5 text-amber-500" /> Em Destaque
                </h2>
                <p className="text-sm text-muted-foreground mt-1">Seleccionados pela equipa editorial</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => updateFilter('featuredOnly', true)}>
                Ver todos <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 gap-4 md:gap-6">
              {featuredProducts.map((product, i) => (
                <ProductCard key={product.id} product={product} onCartOpen={() => setIsCartOpen(true)} index={i} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Coleções */}
      {!hasActiveBrowsing && shop.shop_show_collections && bookCollections.length > 0 && (
        <section className="border-b border-border">
          <div className="container-custom py-8">
            <h2 className="text-lg font-bold flex items-center gap-2 mb-4">
              <Layers className="h-5 w-5 text-[var(--brand-primary)]" /> Explorar por Coleção
            </h2>
            <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-1">
              {bookCollections.map((col) => {
                const count = allProducts.filter((p) => p.collection_id === col.id).length;
                return (
                  <button
                    key={col.id}
                    type="button"
                    onClick={() => updateFilter('collection', col.id)}
                    className="shrink-0 flex flex-col items-start p-4 rounded-xl border border-border bg-card hover:border-[var(--brand-primary)] hover:shadow-md transition-all min-w-[160px] text-left"
                  >
                    <span className="font-semibold text-sm line-clamp-2">{col.title}</span>
                    <span className="text-xs text-muted-foreground mt-1">{count} livro{count !== 1 ? 's' : ''}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Géneros rápidos */}
      {availableFilters.genres?.length > 0 && (
        <div className="border-b border-border bg-muted/20 sticky top-[var(--header-offset,0px)] z-20 backdrop-blur-md bg-background/80">
          <div className="container-custom py-3 flex gap-2 overflow-x-auto scrollbar-hide items-center">
            <span className="text-xs font-medium text-muted-foreground shrink-0 mr-1">Género:</span>
            <Button
              size="sm"
              variant={activeFilters.categories.length === 0 && !activeFilters.collection ? 'default' : 'outline'}
              className={`rounded-full shrink-0 h-8 ${activeFilters.categories.length === 0 && !activeFilters.collection ? 'btn-primary' : ''}`}
              onClick={() => { updateFilter('categories', []); updateFilter('collection', ''); }}
            >
              Todos ({catalogStats.total})
            </Button>
            {availableFilters.genres.map((g) => {
              const count = allProducts.filter((p) => p.type?.value === g).length;
              const active = activeFilters.categories.includes(g);
              return (
                <Button
                  key={g}
                  size="sm"
                  variant={active ? 'default' : 'outline'}
                  className={`rounded-full shrink-0 h-8 ${active ? 'btn-primary' : ''}`}
                  onClick={() => updateFilter('categories', active ? [] : [g])}
                >
                  {g} ({count})
                </Button>
              );
            })}
          </div>
        </div>
      )}

      <main className="container-custom py-10 min-h-screen">
        {/* Dynamic Breadcrumbs */}
        <div className="flex flex-wrap items-center gap-2 text-xs md:text-sm text-muted-foreground mb-6 bg-card border border-border/80 px-4 py-3 rounded-xl shadow-xs shrink-0" id="shop-breadcrumbs">
          <Link to="/" className="hover:text-primary transition-colors font-medium">Início</Link>
          <ChevronRight className="h-3.5 w-3.5 opacity-60" />
          <Link to="/shop" className="hover:text-primary transition-colors font-medium" onClick={clearFilters}>Loja</Link>
          {activeFilters.categories?.length > 0 && (
            <>
              <ChevronRight className="h-3.5 w-3.5 opacity-60" />
              <span className="text-foreground font-semibold bg-primary/10 text-primary px-2.5 py-0.5 rounded-full text-[11px] uppercase tracking-wide">
                {activeFilters.categories.join(', ')}
              </span>
            </>
          )}
          {activeFilters.collection && bookCollections.find(c => c.id === activeFilters.collection) && (
            <>
              <ChevronRight className="h-3.5 w-3.5 opacity-60" />
              <span className="text-foreground font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-400 px-2.5 py-0.5 rounded-full text-[11px] uppercase tracking-wide">
                Coleção: {bookCollections.find(c => c.id === activeFilters.collection).title}
              </span>
            </>
          )}
          {activeFilters.search && (
            <>
              <ChevronRight className="h-3.5 w-3.5 opacity-60" />
              <span className="text-foreground font-semibold italic">Busca: "{activeFilters.search}"</span>
            </>
          )}
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar filtros */}
          <aside className="hidden lg:block w-72 flex-shrink-0">
            <div className="sticky top-28 bg-card border border-border rounded-2xl p-6 shadow-sm">
              <FilterPanel
                availableFilters={availableFilters}
                activeFilters={activeFilters}
                updateFilter={updateFilter}
                updateOptionFilter={updateOptionFilter}
                clearFilters={clearFilters}
                filterCount={filterCount}
                bookCollections={bookCollections}
              />
            </div>
          </aside>

          <div className="flex-1 min-w-0">
            {/* Barra de ferramentas */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6 bg-card border border-border p-4 rounded-2xl shadow-sm">
              <div className="flex items-center gap-2 flex-wrap">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="sm" className="lg:hidden" onClick={() => setIsMobileFilterOpen(true)}>
                      <SlidersHorizontal className="h-4 w-4 mr-1" />
                      Filtros {filterCount > 0 && `(${filterCount})`}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">Filtrar catálogo</TooltipContent>
                </Tooltip>
                <div className="text-sm text-muted-foreground">
                  A mostrar <strong className="text-foreground">{displayProducts.length}</strong>
                  {sortedProducts.length !== displayProducts.length && ` de ${sortedProducts.length}`}
                  {' '}· catálogo com <strong className="text-foreground">{catalogStats.total}</strong> livros
                </div>
              </div>
              <div className="flex items-center gap-2 ml-auto">
                <div className="flex border rounded-lg overflow-hidden">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant={viewMode === 'grid' ? 'secondary' : 'ghost'} size="icon" className="h-9 w-9 rounded-none" onClick={() => setViewMode('grid')}>
                        <LayoutGrid className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">Visualização em Grelha</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant={viewMode === 'list' ? 'secondary' : 'ghost'} size="icon" className="h-9 w-9 rounded-none" onClick={() => setViewMode('list')}>
                        <List className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">Visualização em Lista</TooltipContent>
                  </Tooltip>
                </div>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-[160px] h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SORT_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Chips de filtros activos */}
            {activeFilterChips.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 mb-5">
                {activeFilterChips.map((chip) => (
                  <span key={chip.key} className="text-sm bg-[rgb(var(--brand-primary-rgb)/0.1)] text-[var(--brand-primary)] px-3 py-1 rounded-full flex items-center gap-1">
                    {chip.label}
                    <button type="button" className="ml-1 hover:opacity-70" onClick={chip.clear}>×</button>
                  </span>
                ))}
                <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs h-7">Limpar tudo</Button>
              </div>
            )}

            {/* Últimas unidades */}
            {!hasActiveBrowsing && shop.shop_show_low_stock && lowStockProducts.length > 0 && (
              <div className="mb-8 p-4 rounded-2xl border border-amber-200/60 bg-amber-50/50 dark:bg-amber-950/20">
                <h3 className="text-sm font-semibold flex items-center gap-2 text-amber-800 dark:text-amber-200 mb-3">
                  <TrendingUp className="h-4 w-4" /> Últimas unidades — não perca
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                  {lowStockProducts.map((product) => (
                    <Link key={product.id} to={`/product/${product.id}`} className="text-center group">
                      <img src={product.image} alt="" className="w-full aspect-[3/4] object-cover rounded-lg border group-hover:shadow-md transition-shadow" />
                      <p className="text-xs font-medium mt-1 line-clamp-2">{product.title}</p>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            <motion.div 
              key={`${activeFilters.categories.join(',')}-${sortBy}-${viewMode}-${filterCount}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              className={viewMode === 'grid' ? `[&_.product-grid]:grid-cols-2 md:[&_.product-grid]:grid-cols-3 ${gridClass}` : ''}
            >
              <ProductsList
                products={displayProducts}
                isLoading={isLoading}
                onCartOpen={() => setIsCartOpen(true)}
                viewMode={viewMode}
              />
            </motion.div>

            {hasMore && !isLoading && (
              <div className="text-center mt-10">
                <Button
                  variant="outline"
                  size="lg"
                  className="px-10 border-[var(--brand-primary)] text-[var(--brand-primary)]"
                  onClick={() => setVisibleCount((v) => (v || perPage) + perPage)}
                >
                  Carregar mais livros ({sortedProducts.length - displayProducts.length} restantes)
                </Button>
              </div>
            )}
          </div>
        </div>

        {isMobileFilterOpen && (
          <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm lg:hidden">
            <motion.div initial={{ x: '-100%' }} animate={{ x: 0 }} className="fixed inset-y-0 left-0 w-full max-w-sm bg-background border-r p-6 overflow-y-auto shadow-xl">
              <div className="flex justify-between mb-6 pb-4 border-b">
                <h2 className="text-xl font-semibold">Filtros</h2>
                <Button variant="ghost" size="icon" onClick={() => setIsMobileFilterOpen(false)}><X /></Button>
              </div>
              <FilterPanel
                availableFilters={availableFilters}
                activeFilters={activeFilters}
                updateFilter={updateFilter}
                updateOptionFilter={updateOptionFilter}
                clearFilters={clearFilters}
                filterCount={filterCount}
                bookCollections={bookCollections}
              />
              <Button className="w-full btn-primary mt-6" onClick={() => setIsMobileFilterOpen(false)}>
                Ver {sortedProducts.length} livros
              </Button>
            </motion.div>
          </div>
        )}
      </main>

      <Footer />
    </>
  );
};

export default ShopPage;
