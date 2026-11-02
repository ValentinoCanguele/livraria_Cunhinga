import React, { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search, BookOpen, X } from 'lucide-react';
import { ProductGrid } from '@/components/ProductCard';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const ProductsList = ({ products = [], isLoading, onCartOpen, viewMode = 'grid', onQuickView, embedded = false, skeletonCount = 8 }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Debounce the list search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Dynamically extract unique categories/genres from the products list
  const categories = useMemo(() => {
    const list = new Set();
    products.forEach((p) => {
      if (p.type?.value) {
        list.add(p.type.value);
      } else if (p.category) {
        list.add(p.category);
      }
    });
    return ['all', ...Array.from(list)];
  }, [products]);

  // Filter products based on search and category
  const filteredList = useMemo(() => {
    return products.filter((p) => {
      const categoryMatch =
        selectedCategory === 'all' ||
        p.type?.value === selectedCategory ||
        p.category === selectedCategory;

      const title = p.title?.toLowerCase() || '';
      const subtitle = p.subtitle?.toLowerCase() || '';
      const bookCode = p.book_code?.toLowerCase() || '';
      const author = p.author?.toLowerCase() || '';
      
      const searchMatch =
        !debouncedSearchQuery.trim() ||
        title.includes(debouncedSearchQuery.toLowerCase()) ||
        subtitle.includes(debouncedSearchQuery.toLowerCase()) ||
        bookCode.includes(debouncedSearchQuery.toLowerCase()) ||
        author.includes(debouncedSearchQuery.toLowerCase());

      return categoryMatch && searchMatch;
    });
  }, [products, debouncedSearchQuery, selectedCategory]);

  const displayList = embedded ? products : filteredList;

  if (isLoading) {
    // O esqueleto usa a classe `product-grid` e as mesmas colunas da grelha real, e tantos
    // cartões quantos a página vai mostrar. Antes eram 8 fixos, numa grelha com outras
    // colunas: quando os 24 produtos chegavam, a página crescia de repente e empurrava tudo
    // o que estava abaixo. Um esqueleto com a forma errada desloca tanto como não ter nenhum.
    return (
      <div className="space-y-6">
        {!embedded && (
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between pb-4 border-b">
            <Skeleton className="h-10 w-full sm:w-64 rounded-xl" />
            <Skeleton className="h-8 w-full sm:w-80 rounded-full" />
          </div>
        )}
        <div
          className={`product-grid grid gap-6 ${viewMode === 'list' ? 'grid-cols-1' : 'grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'}`}
          aria-busy="true"
          aria-label="A carregar livros"
        >
          {Array.from({ length: skeletonCount }, (_, i) => (
            <div key={i} className="space-y-4">
              <Skeleton className="aspect-[3/4] w-full rounded-xl" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-1/3" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {!embedded && (
      <div className="flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center bg-card border border-border p-4 rounded-2xl shadow-sm">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Pesquisar por título, autor ou código..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-10 py-5 rounded-xl border-2 border-muted focus-visible:ring-1 focus-visible:ring-[#0ea5c9] w-full bg-background"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Category Quick Filter */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide py-1">
          {categories.slice(0, 5).map((category) => {
            const isSelected = selectedCategory === category;
            return (
              <Button
                key={category}
                variant={isSelected ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCategory(category)}
                className={`rounded-full shrink-0 text-xs px-4 h-9 ${
                  isSelected ? 'btn-primary bg-[#0ea5c9] text-white hover:bg-[#0ea5c9]/90' : 'hover:border-[#0ea5c9]/30 hover:bg-[#0ea5c9]/5'
                }`}
              >
                {category === 'all' ? 'Todos os Géneros' : category}
              </Button>
            );
          })}
        </div>
      </div>
      )}

      {displayList.length === 0 ? (
        <div className="text-center py-20 bg-muted/20 rounded-2xl border border-dashed border-border p-8">
          <BookOpen className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-foreground mb-2">
            {embedded ? 'Nenhum livro nesta seleção' : 'Nenhum livro corresponde à pesquisa'}
          </h3>
          <p className="text-muted-foreground text-sm max-w-sm mx-auto mb-6">
            {embedded
              ? 'Tente ajustar os filtros na barra lateral ou limpar a pesquisa no topo da loja.'
              : 'Não encontrámos resultados para as opções selecionadas. Tente redefinir a sua pesquisa ou os filtros.'}
          </p>
          {!embedded && (searchQuery || selectedCategory !== 'all') && (
            <Button
              variant="outline"
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('all');
              }}
              className="rounded-xl border-[#0ea5c9] text-[#0ea5c9] hover:bg-[#0ea5c9]/10"
            >
              Limpar Filtros
            </Button>
          )}
        </div>
      ) : (
        <motion.div
          layout
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="transition-all duration-300"
        >
          <ProductGrid products={displayList} isLoading={false} onCartOpen={onCartOpen} viewMode={viewMode} onQuickView={onQuickView} />
        </motion.div>
      )}
    </div>
  );
};

export default ProductsList;
