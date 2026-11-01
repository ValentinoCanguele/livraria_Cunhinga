import React, { useState, useEffect, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Layers, ChevronRight, BookOpen, Filter, X } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ShoppingCart from '@/components/ShoppingCart';
import ProductCard from '@/components/ProductCard';
import QuickViewModal from '@/components/QuickViewModal';
import FirestoreBooksList from '@/components/FirestoreBooksList';
import { pageTitle } from '@/lib/brand';
import { getCollections } from '@/api/PlatformApi';
import pb from '@/lib/pocketbaseClient';
import { escapeFilterValue } from '@/lib/sanitizeHtml';
import { Button } from '@/components/ui/button';

// Normalized helper to avoid accent differences matching (e.g. "Religião" vs "religiao")
const getNormalizedGenre = (genre) => {
  if (!genre) return '';
  return genre.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
};

const CATEGORY_MAPPINGS = {
  educational: ['educacao', 'saude', 'familia', 'educativo', 'juvenil'],
  inspirational: ['religiao', 'devocional', 'biografia', 'inspiracional'],
  children: ['infantil', 'criancas', 'infanto-juvenil']
};

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
    purchasable: true,
    variants: [
      {
        id: `variant_${book.id}`,
        price_formatted: `${Number(book.price).toLocaleString('pt-AO')} Kz`,
        inventory_quantity: book.stock || 99,
      }
    ],
    description: book.description || 'Este livro é uma leitura excelente que edifica a alma.',
  };
}

export default function CollectionsPage() {
  const { slug } = useParams();
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [collections, setCollections] = useState([]);
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filtering and Modal States
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [quickView, setQuickView] = useState(null);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

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
            // Reset filters on collection change
            setSelectedCategory('all');
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

  // Pre-calculate category counts
  const counts = useMemo(() => {
    let educational = 0;
    let inspirational = 0;
    let children = 0;

    books.forEach((book) => {
      const g = getNormalizedGenre(book.genre);
      if (CATEGORY_MAPPINGS.educational.includes(g)) educational++;
      if (CATEGORY_MAPPINGS.inspirational.includes(g)) inspirational++;
      if (CATEGORY_MAPPINGS.children.includes(g)) children++;
    });

    return { educational, inspirational, children };
  }, [books]);

  // Filter books based on active category
  const filteredBooks = useMemo(() => {
    if (selectedCategory === 'all') return books;
    const allowed = CATEGORY_MAPPINGS[selectedCategory] || [];
    return books.filter((book) => {
      const g = getNormalizedGenre(book.genre);
      return allowed.includes(g);
    });
  }, [books, selectedCategory]);

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
            <div className="space-y-16">
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
                      className="group block bg-card border rounded-2xl overflow-hidden hover:shadow-lg hover:border-primary/30 transition-all"
                    >
                      {col.cover ? (
                        <img src={col.cover} alt={col.title} className="w-full h-44 object-cover group-hover:scale-105 transition-transform duration-300" />
                      ) : (
                        <div className="w-full h-44 bg-gradient-to-br from-primary/20 to-[#0c4a6e]/20 flex items-center justify-center">
                          <BookOpen className="h-12 w-12 text-primary/50" />
                        </div>
                      )}
                      <div className="p-5">
                        <h2 className="font-bold text-lg group-hover:text-primary transition-colors">{col.title}</h2>
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

              {/* Dynamic Firestore Book Collection lists here */}
              <div className="pt-12 border-t border-border/80">
                <FirestoreBooksList onCartOpen={() => setIsCartOpen(true)} />
              </div>
            </div>
          ) : activeCollection ? (
            <div className="flex flex-col lg:flex-row gap-8">
              {/* Category Filtering Sidebar */}
              <aside className="w-full lg:w-64 shrink-0">
                {/* Desktop Sidebar Panel */}
                <div className="hidden lg:block bg-card border rounded-2xl p-5 shadow-sm space-y-4">
                  <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">Filtrar Categoria</h3>
                  <div className="space-y-1">
                    {[
                      { id: 'all', label: 'Todos os Livros', count: books.length },
                      { id: 'educational', label: 'Educativos', count: counts.educational },
                      { id: 'inspirational', label: 'Inspiracionais', count: counts.inspirational },
                      { id: 'children', label: 'Infantis', count: counts.children }
                    ].map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => setSelectedCategory(cat.id)}
                        className={`w-full flex items-center justify-between text-left px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                          selectedCategory === cat.id
                            ? 'bg-primary/10 text-primary font-bold'
                            : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <span>{cat.label}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${selectedCategory === cat.id ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
                          {cat.count}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Mobile Filter Action Area */}
                <div className="lg:hidden flex items-center justify-between bg-card border rounded-xl p-4 shadow-sm">
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-bold text-foreground">Filtro Ativo</span>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setMobileFilterOpen(true)}
                    className="rounded-full text-xs"
                  >
                    Filtrar ({selectedCategory === 'all' ? 'Todos' : selectedCategory === 'educational' ? 'Educativo' : selectedCategory === 'inspirational' ? 'Inspirational' : 'Infantil'})
                  </Button>
                </div>

                {/* Mobile Slide-out Drawer */}
                {mobileFilterOpen && (
                  <div className="fixed inset-0 z-50 bg-black/60 lg:hidden flex justify-end">
                    <div className="bg-background w-80 h-full p-6 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
                      <div className="flex items-center justify-between border-b pb-4 mb-6">
                        <h3 className="text-lg font-bold text-foreground">Filtrar por Categoria</h3>
                        <Button variant="ghost" size="icon" onClick={() => setMobileFilterOpen(false)}>
                          <X className="h-5 w-5" />
                        </Button>
                      </div>
                      <div className="space-y-2 flex-1 overflow-y-auto">
                        {[
                          { id: 'all', label: 'Todos os Livros', count: books.length },
                          { id: 'educational', label: 'Educativos', count: counts.educational },
                          { id: 'inspirational', label: 'Inspiracionais', count: counts.inspirational },
                          { id: 'children', label: 'Infantis', count: counts.children }
                        ].map((cat) => (
                          <button
                            key={cat.id}
                            onClick={() => {
                              setSelectedCategory(cat.id);
                              setMobileFilterOpen(false);
                            }}
                            className={`w-full flex items-center justify-between text-left px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                              selectedCategory === cat.id
                                ? 'bg-primary/10 text-primary font-bold'
                                : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                            }`}
                          >
                            <span>{cat.label}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${selectedCategory === cat.id ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
                              {cat.count}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </aside>

              {/* Books Grid */}
              <div className="flex-1">
                {filteredBooks.length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filteredBooks.map((book) => (
                      <ProductCard 
                        key={book.id} 
                        product={bookToProduct(book)} 
                        onQuickView={setQuickView}
                        onCartOpen={() => setIsCartOpen(true)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-20 bg-card border rounded-2xl">
                    <BookOpen className="h-12 w-12 mx-auto text-muted-foreground/60 mb-3" />
                    <p className="text-muted-foreground font-medium">Nenhum livro encontrado nesta categoria.</p>
                    <Button onClick={() => setSelectedCategory('all')} size="sm" variant="outline" className="mt-4 rounded-full">
                      Limpar Filtros
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-16">Coleção não encontrada.</p>
          )}
        </section>
      </main>

      <QuickViewModal 
        product={quickView} 
        open={!!quickView} 
        onClose={() => setQuickView(null)} 
        onCartOpen={() => setIsCartOpen(true)} 
      />

      <Footer />
    </>
  );
}
