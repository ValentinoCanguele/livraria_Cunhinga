import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  SlidersHorizontal, X, LayoutGrid, List, Sparkles,
  Layers, Star, ChevronRight, ChevronLeft, TrendingUp,
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
import CategoryBookMarquee from '@/components/home/CategoryBookMarquee';
import QuickViewModal from '@/components/QuickViewModal';
import ProductCard from '@/components/ProductCard';
import { getProduct } from '@/api/EcommerceApi';
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
  // Páginas a sério em vez do "carregar mais", que empilhava 24 → 48 → 72 → 102 na mesma
  // página: num telemóvel isso é uma lista interminável onde se perde o lugar.
  const [page, setPage] = useState(1);
  const gridTopRef = useRef(null);

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
  const [gridCols, setGridCols] = useState(shop.shop_grid_columns || 4);
  const [quickView, setQuickView] = useState(null);
  const [modalProduct, setModalProduct] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);

  useEffect(() => {
    applyShopTheme(settings);
  }, [settings]);

  useEffect(() => {
    setSortBy(shop.shop_default_sort || 'featured');
  }, [shop.shop_default_sort]);

  useEffect(() => {
    if (!quickView) {
      setModalProduct(null);
      setModalLoading(false);
      return undefined;
    }
    setModalProduct(quickView);
    setModalLoading(true);
    getProduct(quickView.id)
      .then(setModalProduct)
      .catch(() => {})
      .finally(() => setModalLoading(false));
  }, [quickView]);

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
  const pageCount = Math.max(1, Math.ceil(sortedProducts.length / perPage));
  const currentPage = Math.min(page, pageCount);
  const displayProducts = sortedProducts.slice((currentPage - 1) * perPage, currentPage * perPage);
  const firstShown = sortedProducts.length === 0 ? 0 : (currentPage - 1) * perPage + 1;
  const lastShown = Math.min(currentPage * perPage, sortedProducts.length);

  useEffect(() => {
    setPage(1);
  }, [filteredProducts, sortBy, filterCount, activeFilters.search]);

  // Mudar de página volta ao topo da lista; senão fica-se a meio da página seguinte.
  const goToPage = (next) => {
    const alvo = Math.min(Math.max(next, 1), pageCount);
    setPage(alvo);
    gridTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const featuredProducts = useMemo(
    () => allProducts.filter((p) => p.featured).slice(0, 8),
    [allProducts]
  );

  const lowStockProducts = useMemo(
    () => allProducts.filter((p) => p.purchasable && (p.variants?.[0]?.inventory_quantity ?? 0) <= 5).slice(0, 6),
    [allProducts]
  );

  // Estável entre renders: uma função criada no JSX muda de identidade a cada render e
  // anula o `memo` dos cartões, que é o que evita refazer os 24 sempre que o painel de
  // filtros abre ou a página muda.
  const handleCartOpen = useCallback(() => setIsCartOpen(true), []);

  const gridClass = {
    2: 'xl:grid-cols-2',
    3: 'xl:grid-cols-3',
    4: 'xl:grid-cols-4',
  }[gridCols] || 'xl:grid-cols-4';

  const inStockProducts = useMemo(
    () => allProducts.filter((p) => p.purchasable && (p.variants?.[0]?.inventory_quantity ?? 0) > 0),
    [allProducts]
  );

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

      <Header onCartOpen={handleCartOpen} />
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
          </motion.div>
      </ShopHeroBackground>

      <section aria-labelledby="shop-search-title" className="border-b border-border bg-muted/30">
        <div className="container-custom py-6 md:py-8">
          <div className="mx-auto max-w-4xl rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6">
            <div className="mb-4">
              <h2 id="shop-search-title" className="text-lg font-semibold">Encontre o seu próximo livro</h2>
              <p className="mt-1 text-sm text-muted-foreground">Pesquise no catálogo ou escolha uma categoria e refine os resultados.</p>
            </div>
            <AdvancedSearchPanel
              activeFilters={activeFilters}
              updateFilter={updateFilter}
              bookCollections={bookCollections}
              publishers={availableFilters.publishers}
              quickGenres={availableFilters.genres}
              catalog={allProducts}
              resultCount={hasActiveBrowsing ? filteredProducts.length : undefined}
              filterCount={filterCount}
            />
          </div>
        </div>
      </section>

      {/* Faixa infinita — livros disponíveis */}
      {!hasActiveBrowsing && inStockProducts.length > 0 && (
        <div className="border-b border-border bg-muted/10">
          <CategoryBookMarquee
            title="Disponíveis para Encomenda"
            description="Deslize sem fim — toque para pausar"
            products={inStockProducts}
            direction="ltr"
            viewMode="marquee"
            onBookSelect={setQuickView}
            categoryFilter="inStockOnly=true"
          />
        </div>
      )}

      <QuickViewModal
        product={modalProduct}
        loading={modalLoading}
        open={!!quickView}
        onClose={() => setQuickView(null)}
        onCartOpen={handleCartOpen}
      />

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
                <ProductCard
                  key={product.id}
                  product={product}
                  onCartOpen={handleCartOpen}
                  onQuickView={setQuickView}
                  index={i}
                />
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
                  A mostrar <strong className="text-foreground">{firstShown}–{lastShown}</strong>
                  {` de ${sortedProducts.length}`}
                  {' '}· catálogo com <strong className="text-foreground">{catalogStats.total}</strong> livros
                </div>
              </div>
              <div className="flex items-center gap-2 ml-auto flex-wrap justify-end">
                {viewMode === 'grid' && (
                  <div className="flex border rounded-lg overflow-hidden">
                    {[
                      { cols: 2, label: '2 colunas' },
                      { cols: 3, label: '3 colunas' },
                      { cols: 4, label: '4 colunas' },
                    ].map(({ cols, label }) => (
                      <Button
                        key={cols}
                        variant={gridCols === cols ? 'secondary' : 'ghost'}
                        size="icon"
                        className="h-9 w-9 rounded-none"
                        onClick={() => setGridCols(cols)}
                        title={label}
                      >
                        <span className="text-[10px] font-bold">{cols}</span>
                      </Button>
                    ))}
                  </div>
                )}
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
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => setQuickView(product)}
                      className="text-center group"
                    >
                      <img src={product.image} alt="" className="w-full aspect-[3/4] object-cover rounded-lg border group-hover:shadow-md transition-shadow" />
                      <p className="text-xs font-medium mt-1 line-clamp-2">{product.title}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div ref={gridTopRef} aria-hidden="true" className="scroll-mt-24" />
            {/* Sem `key` derivada dos filtros. Tinha-a para reanimar a entrada sempre que a
                selecção mudava, mas mudar a `key` faz o React desmontar e montar de novo os
                24 cartões — o caminho mais caro possível para uma acção que o utilizador
                espera ver responder de imediato. A animação de entrada mantém-se na primeira
                montagem; a seguir, o React reconcilia pelos `key={product.id}` de cada
                cartão e reaproveita os que não mudaram. Quem muda um filtro já tem a
                contagem de resultados a dizer-lhe que mudou. */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              className={viewMode === 'grid' ? `[&_.product-grid]:grid-cols-2 md:[&_.product-grid]:grid-cols-3 ${gridClass}` : ''}
            >
              <ProductsList
                embedded
                products={displayProducts}
                isLoading={isLoading}
                skeletonCount={perPage}
                onCartOpen={handleCartOpen}
                viewMode={viewMode}
                onQuickView={setQuickView}
              />
            </motion.div>

            {/* Enquanto carrega, fica aqui um espaço com a altura da navegação de páginas.
                Sem ele, a navegação aparecia de repente no fim da lista e empurrava o rodapé
                quando os produtos terminavam de carregar. */}
            {isLoading && <div className="mt-10 h-9" aria-hidden />}

            {pageCount > 1 && !isLoading && (
              <nav className="mt-10 flex items-center justify-center gap-2" aria-label="Páginas do catálogo">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  aria-label="Página anterior"
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span className="hidden sm:inline ml-1">Anterior</span>
                </Button>

                {/* Telemóvel: só "Página 2 de 5" — uma fila de números não cabe em 375 px. */}
                <span className="sm:hidden text-sm text-muted-foreground px-2">
                  Página <strong className="text-foreground">{currentPage}</strong> de {pageCount}
                </span>

                <div className="hidden sm:flex items-center gap-1">
                  {Array.from({ length: pageCount }, (_, i) => i + 1)
                    .filter((n) => n === 1 || n === pageCount || Math.abs(n - currentPage) <= 1)
                    .map((n, i, lista) => (
                      <React.Fragment key={n}>
                        {i > 0 && n - lista[i - 1] > 1 && <span className="px-1 text-muted-foreground">…</span>}
                        <Button
                          variant={n === currentPage ? 'default' : 'outline'}
                          size="sm"
                          className={n === currentPage ? 'btn-primary w-9' : 'w-9'}
                          onClick={() => goToPage(n)}
                          aria-current={n === currentPage ? 'page' : undefined}
                          aria-label={`Página ${n}`}
                        >
                          {n}
                        </Button>
                      </React.Fragment>
                    ))}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage === pageCount}
                  aria-label="Página seguinte"
                >
                  <span className="hidden sm:inline mr-1">Seguinte</span>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </nav>
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
