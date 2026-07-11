import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { X, ShoppingCart, Eye, MessageCircle, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCart } from '@/hooks/useCart';
import { useToast } from '@/hooks/use-toast';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { shareBookOnWhatsApp } from '@/lib/whatsapp';
import { sanitizeHtml } from '@/lib/sanitizeHtml';
import BookPreviewModal from '@/components/BookPreviewModal';

const PLACEHOLDER = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjMzc0MTUxIi8+CiAgPHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxOCIgZmlsbD0iIzlDQTNBRiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk5vIEltYWdlPC90ZXh0Pgo8L3N2Zz4K";

export default function QuickViewModal({ product, open, onClose, onCartOpen }) {
  const { addToCart } = useCart();
  const { toast } = useToast();
  const { settings } = useSiteSettings();
  const [showPreview, setShowPreview] = useState(false);

  if (!open || !product) return null;

  const variant = product.variants?.[0];
  const inStock = product.purchasable && (variant?.inventory_quantity ?? 0) > 0;
  const price = variant?.sale_price_formatted || variant?.price_formatted;

  const handleAdd = async () => {
    if (!variant || !inStock) return;
    try {
      await addToCart(product, variant, 1, variant.inventory_quantity, { silent: true });
      toast({
        variant: 'cart-success',
        product,
        onCartOpen
      });
      if (onCartOpen) onCartOpen();
      onClose();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erro', description: err.message });
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-background rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center p-4 border-b">
          <h3 className="font-bold">Visualização Rápida</h3>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="h-5 w-5" /></Button>
        </div>
        <div className="grid sm:grid-cols-2 gap-0">
          <div className="bg-muted aspect-[3/4] sm:aspect-auto">
            <img src={product.image || PLACEHOLDER} alt={product.title} className="w-full h-full object-cover" />
          </div>
          <div className="p-6 flex flex-col max-h-[75vh] overflow-y-auto">
            {product.marketing_hook && <p className="text-sm text-primary font-medium mb-1">{product.marketing_hook}</p>}
            <h2 className="text-xl font-bold mb-1 text-foreground">{product.title}</h2>
            {product.subtitle && <p className="text-muted-foreground text-sm mb-3">{product.subtitle}</p>}
            <p className="text-2xl font-bold text-primary mb-4">{price}</p>
            <div className="text-sm text-muted-foreground mb-4 pr-1 overflow-y-auto max-h-48 scrollbar-thin scrollbar-thumb-muted-foreground/20">
              <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(product.description || '') }} />
            </div>
            <div className="flex flex-col gap-2 mt-auto">
              {inStock ? (
                <Button className="btn-primary w-full" onClick={handleAdd}>
                  <ShoppingCart className="h-4 w-4 mr-2" /> Adicionar ao Carrinho
                </Button>
              ) : (
                <p className="text-destructive text-sm text-center">Esgotado</p>
              )}
              <Button variant="outline" className="w-full border-primary/40 text-primary hover:bg-primary/5" onClick={() => setShowPreview(true)}>
                <BookOpen className="h-4 w-4 mr-2" /> Ler Amostra Grátis
              </Button>
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
      <BookPreviewModal product={product} open={showPreview} onClose={() => setShowPreview(false)} onCartOpen={onCartOpen} />
    </div>
  );
}
