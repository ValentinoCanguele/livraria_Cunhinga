import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { getProduct, getProductQuantities, getRelatedProducts } from '@/api/EcommerceApi';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { shareBookOnWhatsApp } from '@/lib/whatsapp';
import RelatedProducts from '@/components/RelatedProducts';
import { Button } from '@/components/ui/button';
import { useCart } from '@/hooks/useCart';
import { useToast } from '@/hooks/use-toast';
import { ShoppingCart as ShoppingCartIcon, Loader2, ChevronLeft, ChevronRight, CheckCircle, XCircle, Minus, Plus, BookOpen, User, Layers, Eye, MessageCircle } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Header from '@/components/Header.jsx';
import { pageTitle } from '@/lib/brand';
import Footer from '@/components/Footer.jsx';
import ShoppingCart from '@/components/ShoppingCart.jsx';
import { sanitizeHtml } from '@/lib/sanitizeHtml';

const placeholderImage = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjMzc0MTUxIi8+CiAgPHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxOCIgZmlsbD0iIzlDQTNBRiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk5vIEltYWdlPC90ZXh0Pgo8L3N2Zz4K";

function ProductDetailPage() {
  const { id } = useParams();
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [relatedProducts, setRelatedProducts] = useState([]);
  const { addToCart } = useCart();
  const { toast } = useToast();
  const { settings } = useSiteSettings();

  const handleAddToCart = useCallback(async (openCart = false) => {
    if (product && selectedVariant) {
      const availableQuantity = selectedVariant.inventory_quantity;
      try {
        await addToCart(product, selectedVariant, quantity, availableQuantity);
        toast({
          title: 'Adicionado ao carrinho',
          description: `${quantity}× ${product.title}`,
        });
        if (openCart) setIsCartOpen(true);
      } catch (error) {
        toast({
          variant: 'destructive',
          title: 'Erro',
          description: error.message,
        });
      }
    }
  }, [product, selectedVariant, quantity, addToCart, toast]);

  const handleBuyNow = useCallback(async () => {
    await handleAddToCart(true);
  }, [handleAddToCart]);

  const handleQuantityChange = useCallback((amount) => {
    setQuantity(prevQuantity => {
      const newQuantity = prevQuantity + amount;
      if (newQuantity < 1) return 1;
      return newQuantity;
    });
  }, []);

  const handlePrevImage = useCallback(() => {
    if (product?.images?.length > 1) {
      setCurrentImageIndex(prev => prev === 0 ? product.images.length - 1 : prev - 1);
    }
  }, [product?.images?.length]);

  const handleNextImage = useCallback(() => {
    if (product?.images?.length > 1) {
      setCurrentImageIndex(prev => prev === product.images.length - 1 ? 0 : prev + 1);
    }
  }, [product?.images?.length]);

  const handleVariantSelect = useCallback((variant) => {
    setSelectedVariant(variant);
    if (variant.image_url && product?.images?.length > 0) {
      const imageIndex = product.images.findIndex(image => image.url === variant.image_url);
      if (imageIndex !== -1) {
        setCurrentImageIndex(imageIndex);
      }
    }
  }, [product?.images]);

  useEffect(() => {
    const fetchProductData = async () => {
      try {
        setLoading(true);
        setError(null);
        const fetchedProduct = await getProduct(id);

        try {
          const quantitiesResponse = await getProductQuantities({
            fields: 'inventory_quantity',
            product_ids: [fetchedProduct.id]
          });

          const variantQuantityMap = new Map();
          quantitiesResponse.variants.forEach(variant => {
            variantQuantityMap.set(variant.id, variant.inventory_quantity);
          });

          const productWithQuantities = {
            ...fetchedProduct,
            variants: fetchedProduct.variants.map(variant => ({
              ...variant,
              inventory_quantity: variantQuantityMap.get(variant.id) ?? variant.inventory_quantity
            }))
          };

          setProduct(productWithQuantities);

          if (productWithQuantities.variants && productWithQuantities.variants.length > 0) {
            setSelectedVariant(productWithQuantities.variants[0]);
          }

          if (productWithQuantities.subtitle) {
            getRelatedProducts(productWithQuantities.subtitle, productWithQuantities.id, 4)
              .then((res) => setRelatedProducts(res.products || []))
              .catch(() => {});
          }
        } catch (quantityError) {
          throw quantityError;
        }
      } catch (err) {
        setError(err.message || 'Não foi possível carregar o livro');
      } finally {
        setLoading(false);
      }
    };

    fetchProductData();
  }, [id]);

  if (loading) {
    return (
      <>
        <Header onCartOpen={() => setIsCartOpen(true)} />
        <ShoppingCart isCartOpen={isCartOpen} setIsCartOpen={setIsCartOpen} />
        <div className="flex justify-center items-center h-[60vh]">
          <Loader2 className="h-16 w-16 text-primary animate-spin" />
        </div>
        <Footer />
      </>
    );
  }

  if (error || !product) {
    return (
      <>
        <Header onCartOpen={() => setIsCartOpen(true)} />
        <ShoppingCart isCartOpen={isCartOpen} setIsCartOpen={setIsCartOpen} />
        <div className="container-custom py-12">
          <div className="text-center text-destructive p-8 bg-card border border-border rounded-xl">
            <XCircle className="mx-auto h-16 w-16 mb-4" />
            <p className="mb-6">Erro ao carregar o livro: {error}</p>
            <Link to="/shop">
              <Button variant="outline">Voltar à Loja</Button>
            </Link>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  const price = selectedVariant?.sale_price_formatted ?? selectedVariant?.price_formatted;
  const originalPrice = selectedVariant?.price_formatted;
  const availableStock = selectedVariant ? selectedVariant.inventory_quantity : 0;
  const isStockManaged = selectedVariant?.manage_inventory ?? false;
  const canAddToCart = !isStockManaged || quantity <= availableStock;

  const currentImage = product.images[currentImageIndex];
  const hasMultipleImages = product.images.length > 1;

  return (
    <>
      <Helmet>
        <title>{pageTitle(product.title)}</title>
        <meta name="description" content={product.description?.substring(0, 160) || product.title} />
      </Helmet>

      <Header onCartOpen={() => setIsCartOpen(true)} />
      <ShoppingCart isCartOpen={isCartOpen} setIsCartOpen={setIsCartOpen} />

      <main className="container-custom py-12">
        <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-8">
          <Link to="/" className="hover:text-primary transition-colors">Início</Link>
          <span>/</span>
          <Link to="/shop" className="hover:text-primary transition-colors">Loja</Link>
          <span>/</span>
          <span className="text-foreground">{product.title}</span>
        </nav>

        <div className="grid lg:grid-cols-2 gap-12">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="relative overflow-hidden rounded-2xl bg-muted aspect-square mb-4">
              <img
                src={!currentImage?.url ? placeholderImage : currentImage.url}
                alt={product.title}
                className="w-full h-full object-cover"
              />

              {hasMultipleImages && (
                <>
                  <button
                    onClick={handlePrevImage}
                    className="absolute left-4 top-1/2 -translate-y-1/2 bg-background/80 hover:bg-background text-foreground p-2 rounded-full transition-colors"
                    aria-label="Previous image"
                  >
                    <ChevronLeft size={24} />
                  </button>
                  <button
                    onClick={handleNextImage}
                    className="absolute right-4 top-1/2 -translate-y-1/2 bg-background/80 hover:bg-background text-foreground p-2 rounded-full transition-colors"
                    aria-label="Next image"
                  >
                    <ChevronRight size={24} />
                  </button>
                </>
              )}

              {product.ribbon_text && (
                <div className="absolute top-4 left-4 bg-primary text-primary-foreground text-sm font-bold px-4 py-2 rounded-full">
                  {product.ribbon_text}
                </div>
              )}
            </div>

            {hasMultipleImages && (
              <div className="flex gap-2 overflow-x-auto">
                {product.images.map((image, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentImageIndex(index)}
                    className={`flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-colors ${
                      index === currentImageIndex ? 'border-primary' : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <img
                      src={!image.url ? placeholderImage : image.url}
                      alt={`${product.title} ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="flex flex-col"
          >
            <h1 className="text-4xl md:text-5xl font-bold mb-3 text-foreground">{product.title}</h1>
            {product.marketing_hook && (
              <p className="text-lg text-[#0ea5c9] font-medium mb-2">{product.marketing_hook}</p>
            )}
            {product.subtitle && (
              <p className="text-xl text-muted-foreground mb-4">{product.subtitle}</p>
            )}
            {product.social_proof && (
              <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4 inline-block">
                ✓ {product.social_proof}
              </p>
            )}

            {(product.book_code || product.sku || product.isbn) && (
              <div className="flex flex-wrap gap-3 mb-6 text-sm">
                {product.book_code && (
                  <span className="px-3 py-1 rounded-lg bg-muted font-mono text-[#0ea5c9]">
                    Código: {product.book_code}
                  </span>
                )}
                {product.sku && product.sku !== product.book_code && (
                  <span className="px-3 py-1 rounded-lg bg-muted font-mono text-muted-foreground">
                    SKU: {product.sku}
                  </span>
                )}
                {product.isbn && (
                  <span className="px-3 py-1 rounded-lg bg-muted font-mono text-muted-foreground">
                    ISBN: {product.isbn}
                  </span>
                )}
              </div>
            )}

            {(product.publisher || product.language || product.pages || product.year) && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6 text-sm">
                {product.publisher && <div><span className="text-muted-foreground">Editora</span><p className="font-medium">{product.publisher}</p></div>}
                {product.language && <div><span className="text-muted-foreground">Idioma</span><p className="font-medium">{product.language}</p></div>}
                {product.pages > 0 && <div><span className="text-muted-foreground">Páginas</span><p className="font-medium">{product.pages}</p></div>}
                {product.year > 0 && <div><span className="text-muted-foreground">Ano</span><p className="font-medium">{product.year}</p></div>}
              </div>
            )}

            <div className="flex items-baseline gap-3 mb-8">
              <span className="text-4xl font-bold text-primary">{price}</span>
              {selectedVariant?.sale_price_in_cents && (
                <span className="text-2xl text-muted-foreground line-through">{originalPrice}</span>
              )}
            </div>

            {product.description && (
              <div className="prose prose-sm max-w-none text-muted-foreground mb-8" dangerouslySetInnerHTML={{ __html: sanitizeHtml(product.description) }} />
            )}

            {Array.isArray(product.benefit_bullets) && product.benefit_bullets.length > 0 && (
              <div className="mb-8 p-4 rounded-xl bg-[#0ea5c9]/5 border border-[#0ea5c9]/15">
                <p className="font-semibold mb-3 text-foreground">Porquê este livro?</p>
                <ul className="space-y-2">
                  {product.benefit_bullets.map((b, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <CheckCircle className="h-4 w-4 text-[#0ea5c9] shrink-0 mt-0.5" />
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {product.target_audience && (
              <p className="text-sm text-muted-foreground mb-8">
                <span className="font-medium text-foreground">Ideal para:</span> {product.target_audience}
              </p>
            )}

            {product.variants.length > 1 && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold mb-3 text-foreground">Edição</h3>
                <div className="flex flex-wrap gap-2">
                  {product.variants.map(variant => (
                    <Button
                      key={variant.id}
                      variant={selectedVariant?.id === variant.id ? 'default' : 'outline'}
                      onClick={() => handleVariantSelect(variant)}
                      className={`transition-all ${selectedVariant?.id === variant.id ? 'btn-primary' : 'border-border hover:border-primary'}`}
                    >
                      {variant.title}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center gap-4 mb-8">
              <div className="flex items-center border border-border rounded-lg">
                <Button onClick={() => handleQuantityChange(-1)} variant="ghost" size="icon" className="rounded-l-lg hover:bg-muted">
                  <Minus size={18} />
                </Button>
                <span className="w-12 text-center font-semibold text-foreground">{quantity}</span>
                <Button onClick={() => handleQuantityChange(1)} variant="ghost" size="icon" className="rounded-r-lg hover:bg-muted">
                  <Plus size={18} />
                </Button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <Button
                onClick={handleBuyNow}
                size="lg"
                className="flex-1 btn-primary text-lg py-6"
                disabled={!canAddToCart || !product.purchasable}
              >
                <ShoppingCartIcon className="mr-2 h-5 w-5" />
                Comprar Agora
              </Button>
              <Button
                onClick={() => handleAddToCart(false)}
                size="lg"
                variant="outline"
                className="flex-1 text-lg py-6 border-[#0ea5c9] text-[#0ea5c9] hover:bg-[#0ea5c9]/10"
                disabled={!canAddToCart || !product.purchasable}
              >
                Adicionar ao Carrinho
              </Button>
            </div>
            {(settings.whatsapp || settings.contact_phone) && (
              <Button
                variant="outline"
                className="w-full mb-4 border-green-500/40 text-green-700 hover:bg-green-50"
                onClick={() => shareBookOnWhatsApp(product, settings.whatsapp || settings.contact_phone)}
              >
                <MessageCircle className="mr-2 h-5 w-5" />
                Partilhar / Pedir via WhatsApp
              </Button>
            )}

            {isStockManaged && canAddToCart && product.purchasable && (
              <p className="text-sm text-primary flex items-center justify-center gap-2 mb-4">
                <CheckCircle size={16} /> {availableStock} em stock
              </p>
            )}

            {isStockManaged && !canAddToCart && product.purchasable && (
              <p className="text-sm text-destructive flex items-center justify-center gap-2 mb-4">
                <XCircle size={16} /> Stock insuficiente. Apenas {availableStock} disponível{availableStock !== 1 ? 'eis' : ''}.
              </p>
            )}

            {!product.purchasable && (
              <p className="text-sm text-destructive flex items-center justify-center gap-2 mb-4">
                <XCircle size={16} /> Indisponível no momento
              </p>
            )}

            {product.additional_info?.length > 0 && (
              <div className="mt-8 space-y-6">
                {product.additional_info
                  .sort((a, b) => a.order - b.order)
                  .map((info) => (
                    <div key={info.id} className="border-l-2 border-primary/30 pl-4">
                      <h3 className="text-lg font-semibold mb-2 text-foreground">{info.title}</h3>
                      <div className="prose prose-sm max-w-none text-muted-foreground" dangerouslySetInnerHTML={{ __html: sanitizeHtml(info.description) }} />
                    </div>
                  ))}
              </div>
            )}
          </motion.div>
        </div>

        <div className="mt-16 border-t border-border pt-10">
          <Tabs defaultValue="details">
            <TabsList className="mb-8 flex-wrap h-auto gap-1">
              <TabsTrigger value="details"><BookOpen className="h-4 w-4 mr-1.5" />Detalhes</TabsTrigger>
              {product.preview_enabled && product.sample_pages?.length > 0 && (
                <TabsTrigger value="preview"><Eye className="h-4 w-4 mr-1.5" />Pré-visualização</TabsTrigger>
              )}
              {(product.author_bio || product.author_photo) && (
                <TabsTrigger value="author"><User className="h-4 w-4 mr-1.5" />Sobre o Autor</TabsTrigger>
              )}
              {product.variants?.length > 1 && (
                <TabsTrigger value="versions"><Layers className="h-4 w-4 mr-1.5" />Versões</TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="details" className="max-w-3xl">
              {product.description ? (
                <div className="prose max-w-none text-muted-foreground" dangerouslySetInnerHTML={{ __html: sanitizeHtml(product.description) }} />
              ) : (
                <p className="text-muted-foreground">Sem descrição disponível.</p>
              )}
            </TabsContent>

            {product.preview_enabled && product.sample_pages?.length > 0 && (
              <TabsContent value="preview">
                <p className="text-sm text-muted-foreground mb-6">Explore as primeiras páginas antes de comprar.</p>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {product.sample_pages.map((page, i) => {
                    const url = typeof page === 'string' ? page : page.url;
                    return (
                      <div key={i} className="rounded-xl overflow-hidden border shadow-sm bg-muted/30">
                        <img src={url} alt={`Página ${i + 1}`} className="w-full h-auto object-contain" />
                        <p className="text-xs text-center py-2 text-muted-foreground">Página {i + 1}</p>
                      </div>
                    );
                  })}
                </div>
              </TabsContent>
            )}

            {(product.author_bio || product.author_photo) && (
              <TabsContent value="author">
                <div className="flex flex-col sm:flex-row gap-6 max-w-3xl">
                  {product.author_photo && (
                    <img src={product.author_photo} alt={product.subtitle} className="w-32 h-32 rounded-full object-cover ring-4 ring-[#0ea5c9]/20 shrink-0" />
                  )}
                  <div>
                    <h3 className="text-2xl font-bold mb-2">{product.subtitle}</h3>
                    {product.author_bio ? (
                      <div className="prose prose-sm max-w-none text-muted-foreground" dangerouslySetInnerHTML={{ __html: sanitizeHtml(product.author_bio) }} />
                    ) : (
                      <p className="text-muted-foreground">Informação sobre o autor em breve.</p>
                    )}
                  </div>
                </div>
              </TabsContent>
            )}

            {product.variants?.length > 1 && (
              <TabsContent value="versions">
                <div className="grid sm:grid-cols-2 gap-4 max-w-3xl">
                  {product.variants.map((v) => (
                    <div
                      key={v.id}
                      role="button"
                      tabIndex={0}
                      className={`p-4 rounded-xl border cursor-pointer transition-all ${selectedVariant?.id === v.id ? 'ring-2 ring-[#0ea5c9] border-[#0ea5c9]/40' : 'hover:border-[#0ea5c9]/30'}`}
                      onClick={() => handleVariantSelect(v)}
                      onKeyDown={(e) => e.key === 'Enter' && handleVariantSelect(v)}
                    >
                      <p className="font-semibold">{v.title}</p>
                      {v.format && <p className="text-sm text-muted-foreground">{v.format}</p>}
                      {v.isbn && <p className="text-xs font-mono text-muted-foreground mt-1">ISBN: {v.isbn}</p>}
                      <p className="text-[#0ea5c9] font-bold mt-2">{v.sale_price_formatted || v.price_formatted}</p>
                      <p className="text-xs text-muted-foreground mt-1">{v.inventory_quantity} em stock</p>
                    </div>
                  ))}
                </div>
              </TabsContent>
            )}
          </Tabs>
        </div>

        <RelatedProducts products={relatedProducts} author={product.subtitle} onCartOpen={() => setIsCartOpen(true)} />
      </main>

      <Footer />
    </>
  );
}

export default ProductDetailPage;