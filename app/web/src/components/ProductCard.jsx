import React, { useState, useEffect, memo } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingCart, Loader2, Eye, MessageCircle, Heart, Star, AlertTriangle, Check } from 'lucide-react';
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

function ProductCard({ product, onCartOpen, index = 0, viewMode = 'grid', onQuickView }) {
  const { addToCart } = useCart();
  const { toast } = useToast();
  const { settings } = useSiteSettings();
  const [adding, setAdding] = useState(false);
  // Confirmação no próprio botão, logo onde o dedo esteve. O aviso que sobe do fundo do
  // ecrã diz a mesma coisa, mas longe do sítio onde se carregou — e em telemóvel pode ficar
  // tapado pelo teclado ou pela barra do sistema.
  const [added, setAdded] = useState(false);
  const { isInWishlist, toggleWishlist } = useWishlist();
  const isWish = isInWishlist(product.id);

  const variant = product.variants?.[0];
  const inStock = product.purchasable && (variant?.inventory_quantity ?? 0) > 0;
  const qty = variant?.inventory_quantity ?? 0;
  // A marca vem da base de dados, com o limite definido em Configurações → Regras da loja.
  const isLowStock = inStock && !!product.stock_low;
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
      setAdded(true);
    } catch (err) {
      toast({ variant: 'destructive', title: 'Stock insuficiente', description: err.message });
    } finally {
      setAdding(false);
    }
  };

  // Volta ao normal sozinho. O temporizador é limpo se o cartão sair do ecrã antes disso —
  // sem a limpeza, o React avisa que se tentou mexer num componente já desmontado.
  useEffect(() => {
    if (!added) return undefined;
    const t = setTimeout(() => setAdded(false), 1600);
    return () => clearTimeout(t);
  }, [added]);

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

  const cardActions = (
    // Os botões medem 32px mas a .tap-target estende-os a 44 num ecrã de toque. Com os
    // 4px de intervalo que tinham, essas áreas invisíveis entravam 8px umas nas outras e
    // um toque entre dois ícones calhava ao vizinho. 12px põem o passo exactamente nos
    // 44 — encostadas, nunca sobrepostas. A partir de sm os botões já medem 40 e os 4px
    // originais chegam para o mesmo passo.
    <div className={`flex items-center gap-3 sm:gap-1 ${isList ? 'justify-start' : 'justify-center px-2 pt-3'}`}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => toggleWishlist(product)}
            className="tap-target h-8 w-8 rounded-full border bg-background shadow-sm hover:bg-muted control-press sm:h-10 sm:w-10"
            aria-label={isWish ? 'Remover dos Favoritos' : 'Adicionar aos Favoritos'}
          >
            <Heart className={`mx-auto h-4 w-4 transition-colors ${isWish ? 'text-red-500 fill-red-500' : 'text-muted-foreground hover:text-red-500'}`} />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">
          {isWish ? 'Remover dos Favoritos' : 'Adicionar aos Favoritos'}
        </TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={handleQuickView}
            className="tap-target h-8 w-8 rounded-full border bg-background shadow-sm hover:bg-muted control-press sm:h-10 sm:w-10"
            aria-label="Visualizar"
          >
            <Eye className="mx-auto h-4 w-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">Visualização Rápida</TooltipContent>
      </Tooltip>
      {waPhone && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={handleShare}
              className="tap-target h-8 w-8 rounded-full bg-green-700 text-white shadow-sm hover:bg-green-800 control-press sm:h-10 sm:w-10"
              aria-label="Partilhar no WhatsApp"
            >
              <MessageCircle className="mx-auto h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">Partilhar no WhatsApp</TooltipContent>
        </Tooltip>
      )}
    </div>
  );

  return (
    <div className={`group h-full flex ${isList ? 'flex-row gap-4' : 'flex-col'}`}>
      <div className={`bg-card rounded-xl overflow-hidden surface-raise border border-border h-full flex flex-1 ${isList ? 'flex-row' : 'flex-col'}`}>
          <div className={`relative overflow-hidden bg-muted shrink-0 ${isList ? 'w-28 h-36' : 'aspect-[2/3] sm:aspect-[3/4]'}`}>
            <Link to={`/product/${product.id}`} onClick={handleQuickView} className="block h-full">
            <img
              src={product.image || PLACEHOLDER}
              alt={product.title}
              className="media-zoom w-full h-full object-cover"
              /* As primeiras da grelha carregam já — uma delas é o maior elemento visível e
                 define o LCP, e adiá-la seria atrasar justamente o que se quer medir. As
                 restantes esperam por chegar perto do ecrã: eram 24 capas a disputar a rede
                 ao mesmo tempo, e a maioria fica abaixo da dobra. */
              loading={index < 6 ? 'eager' : 'lazy'}
              decoding="async"
              onError={(e) => { e.target.onerror = null; e.target.src = PLACEHOLDER; }}
            />
            </Link>
            {/* Ícones, não autocolantes de texto: o mesmo cartão chegava a dizer o stock
                quatro vezes (marca na imagem, faixa do admin, etiqueta do preço e "últimas N").
                Fica uma marca por estado aqui, e o número aparece uma única vez, junto ao
                preço. A faixa do admin só aparece quando não há aviso de stock, para não
                empilhar três marcas no canto. */}
            <div className="absolute top-2 left-2 flex items-center gap-1.5 z-10 pointer-events-none">
              {product.featured && (
                <span
                  className="h-6 w-6 rounded-full bg-amber-400 text-amber-950 shadow-sm flex items-center justify-center"
                  title="Destaque"
                >
                  <Star className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
                  <span className="sr-only">Destaque</span>
                </span>
              )}
              {isLowStock && (
                <span
                  className="h-6 w-6 rounded-full bg-rose-500 text-white shadow-sm flex items-center justify-center"
                  title={qty > 0 ? `Últimas ${qty} unidades` : 'Poucas unidades'}
                >
                  <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="sr-only">{qty > 0 ? `Últimas ${qty} unidades` : 'Poucas unidades'}</span>
                </span>
              )}
              {/* A faixa do admin só acrescenta quando não repete a estrela: muitos livros
                  têm ribbon_text "Destaque", e ficavam com a estrela e o rótulo a dizer o
                  mesmo. "Destaque da semana" ou outro texto continua a aparecer. */}
              {product.ribbon_text && inStock && !isLowStock
                && product.ribbon_text.trim().toLowerCase() !== 'destaque' && (
                <span className="bg-primary text-white text-[10px] font-semibold px-2 py-0.5 rounded-full shadow-sm">
                  {product.ribbon_text}
                </span>
              )}
            </div>
            {!inStock && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10">
                <span className="bg-destructive text-white text-xs font-bold px-3 py-1 rounded-full">Esgotado</span>
              </div>
            )}
          </div>
          {!isList && cardActions}
          <div className={`p-4 flex flex-col flex-grow ${isList ? 'justify-center' : ''}`}>
            {isList && cardActions}
            <Link to={`/product/${product.id}`} onClick={handleQuickView} className="flex flex-col flex-grow">
              {product.book_code && <code className="text-[10px] text-brand-ink font-mono mb-1">{product.book_code}</code>}
              <h3 className="font-semibold text-foreground mb-0.5 line-clamp-2 group-hover:text-primary transition-colors">
                {product.title}
              </h3>
              {product.subtitle && (
                <p className="text-xs text-muted-foreground mb-1 line-clamp-1">{product.subtitle}</p>
              )}
              {product.type?.value && (
                <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full w-fit mb-2">{product.type.value}</span>
              )}
              <div className="mt-auto pt-2 flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <p className="text-brand-ink font-bold">{price}</p>
                  {originalPrice && <p className="text-xs text-muted-foreground line-through">{originalPrice}</p>}
                </div>
                {inStock && isLowStock && qty > 0 && (
                  <span className="text-xs font-medium text-orange-700 dark:text-orange-400 whitespace-nowrap">Restam {qty}</span>
                )}
              </div>
            </Link>
          </div>
      </div>
      {inStock && !isList && (
        // Num cartão de 160 px os dois botões lado a lado precisavam de 209 px e
        // transbordavam. Em ecrã estreito fica só "Comprar": tocar no cartão já abre o livro.
        <div className="flex gap-2 mt-2">
          <Button
            size="sm"
            variant="outline"
            className={`h-11 sm:h-8 flex-1 rounded-lg text-xs ${added ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : 'border-primary/30 hover:bg-primary/10'}`}
            onClick={handleAddToCart}
            disabled={adding}
          >
            {adding
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : added
                ? <Check className="h-4 w-4 mr-1" />
                : <ShoppingCart className="h-4 w-4 mr-1" />}
            {added ? 'No carrinho' : 'Comprar'}
          </Button>
          <Link to={`/product/${product.id}`} className="hidden sm:block flex-1">
            <Button size="sm" variant="secondary" className="h-11 sm:h-8 w-full rounded-lg text-xs hover:bg-primary/10 hover:text-primary">
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

/**
 * `memo` porque a grelha tem 24 cartões e o pai volta a renderizar por muitas razões que
 * não lhes dizem respeito: abrir o painel de filtros, mudar de página, escrever na busca.
 * Sem isto, cada uma dessas acções refazia os 24 — era o que punha o INP em 272 ms, com o
 * tempo todo na apresentação e nenhum no código do handler.
 *
 * Para `memo` servir de alguma coisa, as funções passadas têm de ser estáveis: ver os
 * `useCallback` em `ShopPage`. Uma função criada no JSX do pai muda de identidade a cada
 * render e anula a comparação.
 */
const MemoProductCard = memo(ProductCard);
export default MemoProductCard;

export function ProductGrid({ products, isLoading, onCartOpen, viewMode = 'grid', onQuickView }) {
  const [quickView, setQuickView] = useState(null);
  const handleQuickView = onQuickView || setQuickView;

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
            <MemoProductCard product={product} onCartOpen={onCartOpen} index={index} viewMode={viewMode} onQuickView={handleQuickView} />
          </motion.div>
        ))}
      </motion.div>
      {!onQuickView && (
        <QuickViewModal product={quickView} open={!!quickView} onClose={() => setQuickView(null)} onCartOpen={onCartOpen} />
      )}
    </>
  );
}
