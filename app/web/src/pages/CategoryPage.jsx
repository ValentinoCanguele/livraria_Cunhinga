import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronRight, SlidersHorizontal, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useProductFilters } from '@/hooks/useProductFilters.jsx';
import ProductsList from '@/components/ProductsList.jsx';
import FilterPanel from '@/components/FilterPanel.jsx';
import Header from '@/components/Header.jsx';
import { pageTitle } from '@/lib/brand';
import Footer from '@/components/Footer.jsx';
import ShoppingCart from '@/components/ShoppingCart.jsx';
import PageBannerSlider from '@/components/PageBannerSlider';

const CategoryPage = () => {
  const { category } = useParams();
  
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);
  const [sortBy, setSortBy] = useState('newest');

  const {
    allProducts,
    availableFilters,
    filteredProducts,
    activeFilters,
    updateFilter,
    updateOptionFilter,
    clearFilters,
    filterCount,
    isLoading
  } = useProductFilters(category);

  // Debugging: Trace filter flow — removed in production
  const categoryName = category
    ? category.charAt(0).toUpperCase() + category.slice(1)
    : 'Products';

  // Apply sorting to filtered products
  const sortedProducts = [...filteredProducts].sort((a, b) => {
    if (sortBy === 'price-low') return a.price_in_cents - b.price_in_cents;
    if (sortBy === 'price-high') return b.price_in_cents - a.price_in_cents;
    return (a.order || 0) - (b.order || 0);
  });

  return (
    <>
      <Helmet>
        <title>{pageTitle(categoryName)}</title>
        <meta name="description" content={`Shop our ${categoryName.toLowerCase()} collection. Premium products for your lifestyle.`} />
      </Helmet>

      <Header onCartOpen={() => setIsCartOpen(true)} />
      <ShoppingCart isCartOpen={isCartOpen} setIsCartOpen={setIsCartOpen} />

      <PageBannerSlider contentClassName="text-left">
        <nav className="mb-4 flex items-center gap-2 text-sm text-white/75">
          <Link to="/" className="transition-colors hover:text-white">Home</Link>
          <ChevronRight className="h-4 w-4" />
          <Link to="/shop" className="transition-colors hover:text-white">Shop</Link>
          <ChevronRight className="h-4 w-4" />
          <span className="text-white">{categoryName}</span>
        </nav>
        <h1 className="mb-3 text-3xl font-bold leading-tight sm:text-4xl md:text-5xl">{categoryName}</h1>
        <p className="text-base text-white/85 sm:text-lg">Explore our curated {categoryName.toLowerCase()} collection</p>
      </PageBannerSlider>

      <main className="container-custom py-12 min-h-screen">
        <div className="flex flex-col lg:flex-row gap-8">
          <aside className="hidden lg:block w-64 flex-shrink-0">
            <div className="sticky top-24 bg-card border border-border rounded-xl p-6">
              <FilterPanel 
                availableFilters={availableFilters}
                activeFilters={activeFilters}
                updateFilter={updateFilter}
                updateOptionFilter={updateOptionFilter}
                clearFilters={clearFilters}
                filterCount={filterCount}
              />
            </div>
          </aside>

          <div className="flex-1">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-3 sm:gap-4 bg-card border border-border p-4 rounded-xl">
              <Button
                variant="outline"
                onClick={() => setIsMobileFilterOpen(true)}
                className="lg:hidden w-full sm:w-auto"
              >
                <SlidersHorizontal className="h-4 w-4 mr-2" />
                Filters {filterCount > 0 && `(${filterCount})`}
              </Button>

              <div className="flex items-center gap-4 w-full sm:w-auto sm:ml-auto">
                <span className="text-sm text-muted-foreground hidden sm:inline">Ordenar por:</span>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-full sm:w-[180px] bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Novidades</SelectItem>
                    <SelectItem value="price-low">Preço: Menor ao Maior</SelectItem>
                    <SelectItem value="price-high">Preço: Maior ao Menor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {!isLoading && sortedProducts.length === 0 ? (
              <div className="space-y-12">
                <div className="text-center py-16 bg-card border border-border rounded-xl">
                  <h3 className="text-2xl font-semibold mb-2">No products found</h3>
                  <p className="text-muted-foreground mb-6">We couldn't find any products matching your filters.</p>
                  <Button onClick={clearFilters} variant="outline">Clear Filters</Button>
                </div>
                <div>
                  <h3 className="text-2xl font-semibold mb-6">No results found. Here are all available products:</h3>
                  <ProductsList products={allProducts} isLoading={isLoading} />
                </div>
              </div>
            ) : (
              <ProductsList products={sortedProducts} isLoading={isLoading} />
            )}
          </div>
        </div>

        {/* Mobile Filter Drawer */}
        {isMobileFilterOpen && (
          <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm lg:hidden">
            <motion.div 
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              className="fixed inset-y-0 left-0 w-full max-w-sm bg-background border-r border-border p-6 overflow-y-auto shadow-xl"
            >
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-border">
                <h2 className="text-xl font-semibold">Filters</h2>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsMobileFilterOpen(false)}
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
              <FilterPanel 
                availableFilters={availableFilters}
                activeFilters={activeFilters}
                updateFilter={updateFilter}
                updateOptionFilter={updateOptionFilter}
                clearFilters={clearFilters}
                filterCount={filterCount}
              />
              <div className="mt-8 pt-4 border-t border-border">
                <Button className="w-full btn-primary" onClick={() => setIsMobileFilterOpen(false)}>
                  Show {sortedProducts.length} Results
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </main>

      <Footer />
    </>
  );
};

export default CategoryPage;