import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ProductGrid } from '@/components/ProductCard';
import { Skeleton } from '@/components/ui/skeleton';

const ProductsList = ({ products, isLoading, onCartOpen, viewMode = 'grid' }) => {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="space-y-4">
            <Skeleton className="aspect-[3/4] w-full rounded-xl" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/3" />
          </div>
        ))}
      </div>
    );
  }

  if (!products || products.length === 0) {
    return (
      <div className="text-center py-24 bg-muted/30 rounded-2xl border border-border border-dashed">
        <h3 className="text-xl font-semibold text-foreground mb-2">Nenhum livro encontrado</h3>
        <p className="text-muted-foreground mb-6">Tente ajustar os filtros ou explore o catálogo completo.</p>
        <Link to="/shop" className="text-[#0ea5c9] font-medium hover:underline">Ver todos os livros</Link>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <ProductGrid products={products} isLoading={false} onCartOpen={onCartOpen} viewMode={viewMode} />
    </motion.div>
  );
};

export default ProductsList;
