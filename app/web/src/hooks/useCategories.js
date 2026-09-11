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
        const response = await getProducts({});
        
        const uniqueCategories = new Map();
        const PLACEHOLDER = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjMzc0MTUxIi8+CiAgPHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxOCIgZmlsbD0iIzlDQTNBRiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk5vIEltYWdlPC90ZXh0Pgo8L3N2Zz4K";
        
        response.products.forEach(product => {
          const typeValue = product.type?.value;
          if (typeValue && !uniqueCategories.has(typeValue.toLowerCase())) {
            uniqueCategories.set(typeValue.toLowerCase(), {
              id: typeValue.toLowerCase().replace(/\s+/g, '-'),
              name: typeValue,
              slug: typeValue.toLowerCase().replace(/\s+/g, '-'),
              image: product.image || product.images?.[0]?.url || PLACEHOLDER,
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