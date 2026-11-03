import React from 'react';
import { Link } from 'react-router-dom';
import ProductCard from '@/components/ProductCard';
import { User } from 'lucide-react';

export default function RelatedProducts({ products, author, onCartOpen }) {
  if (!products?.length) return null;

  return (
    <section className="mt-16 pt-12 border-t border-border">
      <div className="flex items-center gap-2 mb-6">
        <User className="h-5 w-5 text-primary" />
        <h2 className="text-2xl font-bold">
          {author ? `Mais de ${author}` : 'Também pode gostar'}
        </h2>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        {products.slice(0, 4).map((product, index) => (
          <ProductCard key={product.id} product={product} onCartOpen={onCartOpen} index={index} />
        ))}
      </div>
      {products.length > 4 && (
        <div className="text-center mt-6">
          <Link to={`/shop?author=${encodeURIComponent(author || '')}`} className="text-primary font-medium hover:underline">
            Ver todos os livros deste autor →
          </Link>
        </div>
      )}
    </section>
  );
}
