import React, { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { X, ShoppingCart, Eye, MessageCircle, BookOpen, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCart } from '@/hooks/useCart';
import { useToast } from '@/hooks/use-toast';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { shareBookOnWhatsApp } from '@/lib/whatsapp';
import { sanitizeHtml } from '@/lib/sanitizeHtml';
import { FloatingScrollTop } from '@/components/ui/FloatingScrollTop';

const PLACEHOLDER = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjMzc0MTUxIi8+CiAgPHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxOCIgZmlsbD0iIzlDQTNBRiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk5vIEltYWdlPC90ZXh0Pgo8L3N2Zz4K";

export default function QuickViewModal({ product, open, onClose, onCartOpen }) {
  const { addToCart } = useCart();
  const { toast } = useToast();
  const { settings } = useSiteSettings();
  const [readingMode, setReadingMode] = useState(false);
  const readingScrollRef = useRef(null);

  if (!open || !product) return null;

  const variant = product.variants?.[0];
  const inStock = product.purchasable && (variant?.inventory_quantity ?? 0) > 0;
  const price = variant?.sale_price_formatted || variant?.price_formatted;

  const handleAdd = async () => {
    if (!variant || !inStock) return;
    try {
      await addToCart(product, variant, 1, variant.inventory_quantity);
      toast({ title: 'Adicionado ao carrinho', description: product.title });
      onClose();
      onCartOpen?.();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erro', description: err.message });
    }
  };

  const descriptionText = (product.description || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

  if (readingMode) {
    return (
      <div className="fixed inset-0 z-[60] bg-[#faf8f5] text-[#1c1917] flex flex-col">
        <header className="flex items-center justify-between px-5 py-4 border-b border-stone-200 shrink-0 bg-white/80 backdrop-blur">
          <div className="min-w-0 pr-4">
            <p className="text-xs uppercase tracking-widest text-[#0ea5c9] font-medium">Modo Leitura</p>
            <h2 className="font-serif text-xl md:text-2xl font-bold leading-tight">{product.title}</h2>
            {product.subtitle && <p className="text-stone-500 text-sm mt-0.5">{product.subtitle}</p>}
          </div>
          <Button variant="outline" size="sm" onClick={() => setReadingMode(false)}>
            <Minimize2 className="h-4 w-4 mr-1" /> Sair
          </Button>
        </header>
        <article ref={readingScrollRef} className="flex-1 overflow-y-auto relative px-5 md:px-16 py-8 md:py-12 max-w-3xl mx-auto w-full">
          <p className="text-2xl md:text-3xl font-bold text-[#0ea5c9] mb-8">{price}</p>
          <div
            className="prose prose-lg md:prose-xl max-w-none text-stone-700 leading-relaxed font-serif"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(product.description || '<p>Sem descrição disponível.</p>') }}
          />
          <FloatingScrollTop
            mode="container"
            containerRef={readingScrollRef}
            threshold={120}
            positionClass="absolute bottom-6 right-6 z-10"
          />
        </article>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-background rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center p-4 border-b">
          <h3 className="font-bold">Visualização Rápida</h3>
          <div className="flex items-center gap-2">
            {descriptionText && (
              <Button size="sm" variant="outline" onClick={() => setReadingMode(true)}>
                <BookOpen className="h-4 w-4 mr-1" /> Modo Leitura
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={onClose}><X className="h-5 w-5" /></Button>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-0">
          <div className="bg-muted aspect-[3/4] sm:aspect-auto">
            <img src={product.image || PLACEHOLDER} alt={product.title} className="w-full h-full object-cover" />
          </div>
          <div className="p-6 flex flex-col">
            {product.marketing_hook && <p className="text-sm text-[#0ea5c9] font-medium mb-1">{product.marketing_hook}</p>}
            <h2 className="text-xl font-bold mb-1">{product.title}</h2>
            {product.subtitle && <p className="text-muted-foreground text-sm mb-3">{product.subtitle}</p>}
            <p className="text-2xl font-bold text-[#0ea5c9] mb-4">{price}</p>
            <p className="text-sm text-muted-foreground line-clamp-4 mb-4 flex-1" dangerouslySetInnerHTML={{ __html: sanitizeHtml(product.description || '').replace(/<[^>]+>/g, ' ').slice(0, 200) }} />
            <div className="flex flex-col gap-2">
              {inStock ? (
                <Button className="btn-primary w-full" onClick={handleAdd}>
                  <ShoppingCart className="h-4 w-4 mr-2" /> Adicionar ao Carrinho
                </Button>
              ) : (
                <p className="text-destructive text-sm text-center">Esgotado</p>
              )}
              <Button variant="outline" asChild className="w-full">
                <Link to={`/product/${product.id}`} onClick={onClose}>
                  <Eye className="h-4 w-4 mr-2" /> Ver Página Completa
                </Link>
              </Button>
              {(settings.whatsapp || settings.contact_phone) && (
                <Button variant="outline" className="w-full border-green-500/30 text-green-700 hover:bg-green-50" onClick={() => shareBookOnWhatsApp(product, settings.whatsapp || settings.contact_phone)}>
                  <MessageCircle className="h-4 w-4 mr-2" /> Partilhar no WhatsApp
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
