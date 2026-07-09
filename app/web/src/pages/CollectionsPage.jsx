import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Layers, ChevronRight, BookOpen } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ShoppingCart from '@/components/ShoppingCart';
import ProductCard from '@/components/ProductCard';
import { pageTitle } from '@/lib/brand';
import { getCollections } from '@/api/PlatformApi';
import pb from '@/lib/pocketbaseClient';
import { escapeFilterValue } from '@/lib/sanitizeHtml';

function bookToProduct(book) {
  return {
    id: book.id,
    title: book.title,
    subtitle: book.author,
    price_in_cents: Math.round(Number(book.price) * 100),
    image: book.cover,
    category: book.genre,
    marketing_hook: book.marketing_hook,
    urgency_text: book.urgency_text,
  };
}

export default function CollectionsPage() {
  const { slug } = useParams();
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [collections, setCollections] = useState([]);
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);

  const activeCollection = slug
    ? collections.find((c) => c.slug === slug || c.id === slug)
    : null;

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const cols = await getCollections();
        setCollections(cols);
        if (slug) {
          const col = cols.find((c) => c.slug === slug || c.id === slug);
          if (col) {
            const list = await pb.collection('stock_books').getFullList({
              filter: `collection_id = "${escapeFilterValue(col.id)}"`,
              sort: '-featured,title',
            });
            setBooks(list);
          }
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [slug]);

  return (
    <>
      <Helmet>
        <title>{pageTitle(activeCollection ? activeCollection.title : 'Coleções')}</title>
        {activeCollection?.seo_description && (
          <meta name="description" content={activeCollection.seo_description} />
        )}
      </Helmet>
      <Header onCartOpen={() => setIsCartOpen(true)} />
      <ShoppingCart isCartOpen={isCartOpen} setIsCartOpen={setIsCartOpen} />

      <main className="min-h-screen bg-background">
        <section className="bg-gradient-to-br from-[#0c4a6e] to-[#0ea5c9] text-white py-14">
          <div className="container-custom">
            <div className="flex items-center gap-2 text-sm text-white/70 mb-4">
              <Link to="/" className="hover:text-white">Início</Link>
              <ChevronRight className="h-4 w-4" />
              <Link to="/colecoes" className="hover:text-white">Coleções</Link>
              {activeCollection && (
                <>
                  <ChevronRight className="h-4 w-4" />
                  <span>{activeCollection.title}</span>
                </>
              )}
            </div>
            <h1 className="text-3xl md:text-4xl font-bold flex items-center gap-3">
              <Layers className="h-8 w-8" />
              {activeCollection ? activeCollection.title : 'Coleções de Livros'}
            </h1>
            <p className="mt-3 text-white/80 max-w-2xl">
              {activeCollection
                ? (activeCollection.marketing_tagline || activeCollection.description?.replace(/<[^>]+>/g, '').slice(0, 200))
                : 'Explore catálogos temáticos seleccionados para fortalecer a sua fé e conhecimento.'}
            </p>
          </div>
        </section>

        <section className="container-custom py-12">
          {loading ? (
            <p className="text-center text-muted-foreground py-20">A carregar...</p>
          ) : !slug ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {collections.map((col, i) => (
                <motion.div
                  key={col.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Link
                    to={`/colecoes/${col.slug || col.id}`}
                    className="group block bg-card border rounded-2xl overflow-hidden hover:shadow-lg hover:border-[#0ea5c9]/30 transition-all"
                  >
                    {col.cover ? (
                      <img src={col.cover} alt={col.title} className="w-full h-44 object-cover group-hover:scale-105 transition-transform duration-300" />
                    ) : (
                      <div className="w-full h-44 bg-gradient-to-br from-[#0ea5c9]/20 to-[#0c4a6e]/20 flex items-center justify-center">
                        <BookOpen className="h-12 w-12 text-[#0ea5c9]/50" />
                      </div>
                    )}
                    <div className="p-5">
                      <h2 className="font-bold text-lg group-hover:text-[#0ea5c9] transition-colors">{col.title}</h2>
                      {col.marketing_tagline && (
                        <p className="text-sm text-muted-foreground mt-1">{col.marketing_tagline}</p>
                      )}
                      {col.featured && (
                        <span className="inline-block mt-2 text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Destaque</span>
                      )}
                    </div>
                  </Link>
                </motion.div>
              ))}
              {collections.length === 0 && (
                <p className="col-span-full text-center text-muted-foreground py-16">
                  Nenhuma coleção disponível de momento.
                </p>
              )}
            </div>
          ) : activeCollection ? (
            books.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {books.map((book) => (
                  <ProductCard key={book.id} product={bookToProduct(book)} />
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-16">Esta coleção ainda não tem livros.</p>
            )
          ) : (
            <p className="text-center text-muted-foreground py-16">Coleção não encontrada.</p>
          )}
        </section>
      </main>

      <Footer />
    </>
  );
}
