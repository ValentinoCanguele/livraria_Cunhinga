import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingCart, Loader2, Eye, MessageCircle, Grid3X3, List, Heart } from 'lucide-react';
import { motion } from 'framer-motion';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { useCart } from '@/hooks/useCart';
import { useToast } from '@/hooks/use-toast';
import { useWishlist } from '@/hooks/useWishlist';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { shareBookOnWhatsApp } from '@/lib/whatsapp';
import QuickViewModal from '@/components/QuickViewModal';

const PLACEHOLDER = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjMzc0MTUxIi8+CiAgPHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxOCIgZmlsbD0iIzlDQTNBRiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk5vIEltYWdlPC90ZXh0Pgo8L3N2Zz4K";

export default function ProductCard({ product, onCartOpen, index = 0, viewMode = 'grid', onQuickView }) {
  const { addToCart } = useCart();
  const { toast } = useToast();
  const { settings } = useSiteSettings();
  const [adding, setAdding] = useState(false);
  const { isInWishlist, toggleWishlist } = useWishlist();
  const isWish = isInWishlist(product.id);

  const variant = product.variants?.[0];
  const inStock = product.purchasable && (variant?.inventory_quantity ?? 0) > 0;
  const price = variant?.sale_price_formatted || variant?.price_formatted;
  const originalPrice = variant?.sale_price_formatted ? variant?.price_formatted : null;
  const waPhone = settings.whatsapp || settings.contact_phone;

  const handleAddToCart = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!variant || !inStock) return;
    setAdding(true);
    try {
      await addToCart(product, variant, 1, variant.inventory_quantity, { silent: true });
      toast({
        variant: 'cart-success',
        product,
        onCartOpen
      });
      if (onCartOpen) onCartOpen();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Stock insuficiente', description: err.message });
    } finally {
      setAdding(false);
    }
  };

  const handleShare = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (waPhone) shareBookOnWhatsApp(product, waPhone);
  };

  const handleQuickView = (e) => {
    if (onQuickView) {
      e.preventDefault();
      e.stopPropagation();
      onQuickView(product);
    }
  };

  const isList = viewMode === 'list';

  return (
    <div className={`group h-full flex ${isList ? 'flex-row gap-4' : 'flex-col'}`}>
      <Link to={`/product/${product.id}`} onClick={handleQuickView} className={`block flex-1 ${isList ? 'flex flex-row gap-4' : ''}`}>
        <div className={`bg-card rounded-xl overflow-hidden card-hover border border-border h-full flex ${isList ? 'flex-row flex-1' : 'flex-col'}`}>
          <div className={`relative overflow-hidden bg-muted shrink-0 ${isList ? 'w-28 h-36' : 'aspect-[3/4]'}`}>
            <img
              src={product.image || PLACEHOLDER}
              alt={product.title}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              onError={(e) => { e.target.onerror = null; e.target.src = PLACEHOLDER; }}
            />
            <div className="absolute top-2 left-2 flex flex-col gap-1.5 z-10 pointer-events-none">
              {product.featured && (
                <span className="bg-amber-400 text-amber-950 text-[9px] font-extrabold px-2.5 py-0.5 rounded-full shadow-sm uppercase tracking-wider">
                  ★ Destaque
                </span>
              )}
              {product.ribbon_text && inStock && (
                <span className="bg-[#0ea5c9] text-white text-[9px] font-extrabold px-2.5 py-0.5 rounded-full shadow-sm uppercase tracking-wider">
                  {product.ribbon_text}
                </span>
              )}
              {inStock && variant?.inventory_quantity > 0 && variant?.inventory_quantity < 5 && (
                <span className="bg-rose-500 text-white text-[9px] font-extrabold px-2.5 py-0.5 rounded-full shadow-sm flex items-center gap-1 uppercase tracking-wider animate-pulse">
                  <span className="w-1.5 h-1.5 bg-white rounded-full"></span>
                  Baixo Estoque ({variant.inventory_quantity})
                </span>
              )}
            </div>
            {/* Wishlist Heart Button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    toggleWishlist(product);
                  }}
                  className="absolute top-2 right-2 p-1.5 rounded-full bg-background/95 shadow-md hover:bg-background z-20 transition-colors cursor-pointer"
                  aria-label={isWish ? "Remover dos Favoritos" : "Adicionar aos Favoritos"}
                >
                  <Heart className={`h-4 w-4 transition-colors ${isWish ? 'text-red-500 fill-red-500' : 'text-muted-foreground hover:text-red-500'}`} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="left">
                {isWish ? "Remover dos Favoritos" : "Adicionar aos Favoritos"}
              </TooltipContent>
            </Tooltip>
            {!inStock && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10">
                <span className="bg-destructive text-white text-xs font-bold px-3 py-1 rounded-full">Esgotado</span>
              </div>
            )}
            <div className="absolute bottom-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" onClick={handleQuickView} className="p-1.5 rounded-full bg-background/90 shadow hover:bg-background" aria-label="Visualizar">
                    <Eye className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">Visualização Rápida</TooltipContent>
              </Tooltip>
              {waPhone && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" onClick={handleShare} className="p-1.5 rounded-full bg-green-500 text-white shadow hover:bg-green-600" aria-label="Partilhar no WhatsApp">
                      <MessageCircle className="h-3.5 w-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top">Partilhar no WhatsApp</TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>
          <div className={`p-4 flex flex-col flex-grow ${isList ? 'justify-center' : ''}`}>
            {product.book_code && <code className="text-[10px] text-primary font-mono mb-1">{product.book_code}</code>}
            <h3 className="font-semibold text-foreground mb-0.5 line-clamp-2 group-hover:text-primary transition-colors">
              {product.title}
            </h3>
            {product.subtitle && (
              <p className="text-xs text-muted-foreground mb-1 line-clamp-1">{product.subtitle}</p>
            )}
            {product.type?.value && (
              <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full w-fit mb-2">{product.type.value}</span>
            )}
            <div className="mt-auto pt-2 flex items-center justify-between gap-2">
              <div>
                <p className="text-primary font-bold">{price}</p>
                {originalPrice && <p className="text-xs text-muted-foreground line-through">{originalPrice}</p>}
              </div>
              {inStock && variant?.inventory_quantity <= 5 && (
                <span className="text-[10px] text-orange-600 font-medium">Últimas {variant.inventory_quantity}</span>
              )}
            </div>
          </div>
        </div>
      </Link>
      {inStock && !isList && (
        <div className="flex gap-2 mt-2">
          <Button size="sm" variant="outline" className="flex-1 rounded-lg border-primary/30 hover:bg-primary/10 text-xs" onClick={handleAddToCart} disabled={adding}>
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingCart className="h-4 w-4 mr-1" />}
            Comprar
          </Button>
          <Link to={`/product/${product.id}`} className="flex-1">
            <Button size="sm" variant="secondary" className="w-full rounded-lg text-xs hover:bg-primary/10 hover:text-primary">
              Ver Detalhes
            </Button>
          </Link>
        </div>
      )}
      {!inStock && !isList && (
        <div className="flex gap-2 mt-2 w-full">
          <Link to={`/product/${product.id}`} className="w-full">
            <Button size="sm" variant="outline" className="w-full rounded-lg text-xs border-primary/30 hover:bg-primary/10 hover:text-primary">
              Ver Detalhes
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}

const gridContainerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.04,
    }
  }
};

const gridItemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 150,
      damping: 20
    }
  }
};

export function ProductGrid({ products, isLoading, onCartOpen, viewMode = 'grid' }) {
  const [quickView, setQuickView] = useState(null);

  if (isLoading) {
    return (
      <div className={`product-grid grid gap-6 ${viewMode === 'list' ? 'grid-cols-1' : 'grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'}`}>
        {[...Array(8)].map((_, i) => (
          <div key={i} className="animate-pulse bg-muted rounded-xl aspect-[3/4]" />
        ))}
      </div>
    );
  }

  return (
    <>
      <motion.div
        variants={gridContainerVariants}
        initial="hidden"
        animate="show"
        className={`product-grid grid gap-6 ${viewMode === 'list' ? 'grid-cols-1' : 'grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'}`}
      >
        {products.map((product, index) => (
          <motion.div key={product.id} variants={gridItemVariants}>
            <ProductCard product={product} onCartOpen={onCartOpen} index={index} viewMode={viewMode} onQuickView={setQuickView} />
          </motion.div>
        ))}
      </motion.div>
      <QuickViewModal product={quickView} open={!!quickView} onClose={() => setQuickView(null)} onCartOpen={onCartOpen} />
    </>
  );
}
