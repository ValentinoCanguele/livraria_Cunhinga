import { useState, useEffect } from 'react';
import { getProducts } from '@/api/EcommerceApi';

export function useCategories() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        setLoading(true);
        // Fetch a large batch of products to extract all unique categories
        const response = await getProducts({ limit: 100 });
        
        const uniqueCategories = new Map();
        
        response.products.forEach(product => {
          const typeValue = product.type?.value;
          if (typeValue && !uniqueCategories.has(typeValue.toLowerCase())) {
            uniqueCategories.set(typeValue.toLowerCase(), {
              id: typeValue.toLowerCase().replace(/\s+/g, '-'),
              name: typeValue,
              slug: typeValue.toLowerCase().replace(/\s+/g, '-'),
              // Use the first product's image as the category image, or a fallback
              image: product.image || product.images?.[0]?.url || 'https://images.unsplash.com/photo-1615529182904-14819c35db37'
            });
          }
        });

        setCategories(Array.from(uniqueCategories.values()).sort((a, b) => a.name.localeCompare(b.name)));
      } catch (err) {
        setError(err.message || 'Failed to fetch categories');
      } finally {
        setLoading(false);
      }
    };

    fetchCategories();
  }, []);

  return { categories, loading, error };
}