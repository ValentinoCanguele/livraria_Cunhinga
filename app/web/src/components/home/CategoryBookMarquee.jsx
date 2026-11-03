import React, { useRef, useState, useCallback, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Pause, Play, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ProductCard from '@/components/ProductCard';
import { buildMarqueeTrack, MARQUEE_MAX_ITEMS } from '@/lib/catalogCategories';

const PLACEHOLDER = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjMzc0MTUxIi8+CiAgPHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxOCIgZmlsbD0iIzlDQTNBRiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk5vIEltYWdlPC90ZXh0Pgo8L3N2Zz4K";

const GRID_PREVIEW = 8;

/**
 * `accent` continua a pintar a barra lateral e o contorno — elementos gráficos, onde a cor
 * da marca chega. O código e o preço usam `text-brand-ink`, a variante escurecida: a cor da
 * marca dá 2,83 de contraste sobre branco, contra os 4,5 que a WCAG pede para texto, e o
 * preço é o que mais precisa de se ler num cartão de livro.
 */
function MarqueeBookCard({ product, onSelect, accent }) {
  const variant = product.variants?.[0];
  const price = variant?.sale_price_formatted || variant?.price_formatted;
  const inStock = product.purchasable && (variant?.inventory_quantity ?? 0) > 0;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onSelect(product);
      }}
      className="flex-shrink-0 w-[132px] sm:w-40 text-left group/card focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0ea5c9] rounded-xl"
    >
      <div
        className="relative aspect-[3/4] rounded-xl overflow-hidden border bg-card shadow-md transition-all duration-300 group-hover/card:scale-[1.03] group-hover/card:shadow-lg group-active/card:scale-100"
        style={{ borderColor: `${accent}33` }}
      >
        <img
          src={product.image || PLACEHOLDER}
          alt={product.title}
          className="w-full h-full object-cover pointer-events-none"
          loading="lazy"
          draggable={false}
          onError={(e) => { e.target.onerror = null; e.target.src = PLACEHOLDER; }}
        />
        {!inStock && (
          <span className="absolute inset-x-2 bottom-2 text-[9px] font-bold text-center bg-destructive/90 text-white px-2 py-0.5 rounded-full">
            Esgotado
          </span>
        )}
        {product.featured && inStock && (
          <span className="absolute top-1.5 left-1.5 text-[8px] font-bold bg-amber-400 text-amber-900 px-1.5 py-0.5 rounded-full">
            ★
          </span>
        )}
      </div>
      {product.book_code && (
        <code className="text-brand-ink text-[9px] font-mono mt-2 block">{product.book_code}</code>
      )}
      <p className="text-xs font-semibold mt-0.5 line-clamp-2 leading-snug group-hover/card:text-primary transition-colors">
        {product.title}
      </p>
      {product.subtitle && (
        <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">{product.subtitle}</p>
      )}
      <p className="text-brand-ink text-xs font-bold mt-1">{price}</p>
    </button>
  );
}

/**
 * Lugar reservado para a faixa, enquanto os livros não chegam.
 *
 * Sem isto a faixa nascia já com os dados e empurrava 480px de página para baixo a meio do
 * carregamento — era a maior parte do CLS de 0,32 medido em `/shop` em telemóvel.
 *
 * Repete a marcação da faixa a sério em vez de fixar uma altura: as medidas mudam com a
 * largura do ecrã (`sm:w-40`, `md:py-10`, `md:gap-5`) e um número escrito à mão só acertaria
 * numa delas. O cabeçalho leva o texto verdadeiro, e não barras cinzentas, porque o título e
 * a descrição são conhecidos antes dos dados: assim a altura dele sai igual sozinha — a
 * descrição desta faixa ocupa duas linhas em 375px e uma em ecrã largo — e quem espera já lê
 * o que vem a seguir. Fica neste ficheiro de propósito, ao lado do que copia, para que mexer
 * num obrigue a olhar para o outro.
 */
export function CategoryBookMarqueeSkeleton({ title, description, accent = '#0ea5c9', cartoes = 6 }) {
  return (
    <section className="py-8 md:py-10" aria-busy="true">
      <div className="container-custom flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-5">
        <div className="flex gap-3 items-start">
          <div className="w-1 self-stretch rounded-full shrink-0 min-h-[3rem]" style={{ background: accent }} />
          <div>
            <h3 className="text-xl md:text-2xl font-bold tracking-tight">{title}</h3>
            <p className="text-sm text-muted-foreground mt-1">{description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="h-10 sm:h-8 w-[88px] rounded-md border border-border bg-muted/60" />
          <div className="h-10 sm:h-8 w-[107px] rounded-md bg-muted/60" />
        </div>
      </div>

      <div className="relative overflow-hidden" aria-hidden="true">
        <div className="flex gap-4 md:gap-5 w-max">
          {Array.from({ length: cartoes }, (_, i) => (
            <div key={i} className="flex-shrink-0 w-[132px] sm:w-40">
              <div className="aspect-[3/4] rounded-xl border bg-muted" />
              {/* Uma linha de código, duas de título, uma de preço — as mesmas classes do
                  cartão a sério, para a altura vir da tipografia e não de um número. */}
              <code className="text-[9px] font-mono mt-2 block">
                <span className="block w-12 rounded bg-muted/60">&nbsp;</span>
              </code>
              <p className="text-xs font-semibold mt-0.5 leading-snug">
                <span className="block rounded bg-muted/60">&nbsp;</span>
                <span className="mt-0.5 block w-2/3 rounded bg-muted/60">&nbsp;</span>
              </p>
              {/* O subtítulo é opcional no cartão a sério, mas basta um livro o ter para
                  ser ele a fixar a altura da fila — por isso conta aqui. */}
              <p className="text-[10px] mt-0.5">
                <span className="block w-1/2 rounded bg-muted/60">&nbsp;</span>
              </p>
              <p className="text-xs font-bold mt-1">
                <span className="block w-16 rounded bg-muted/60">&nbsp;</span>
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function CategoryBookMarquee({
  id,
  title,
  description,
  accent = '#0ea5c9',
  products,
  direction = 'ltr',
  viewMode = 'marquee',
  onBookSelect,
  onCartOpen,
  categoryFilter,
}) {
  const [paused, setPaused] = useState(false);
  const [gridExpanded, setGridExpanded] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const dragRef = useRef({ active: false, startX: 0 });

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const handler = (e) => setReducedMotion(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // A duração acompanha o número de títulos que a faixa mostra de facto, e não o total da
  // lista: o track é mais curto, por isso percorrê-lo no tempo antigo seria andar depressa
  // de mais. Assim a velocidade aparente mantém-se.
  const duration = Math.max(55, Math.min(products.length, MARQUEE_MAX_ITEMS) * 4.5);
  const animClass = direction === 'rtl' ? 'catalog-marquee-rtl' : 'catalog-marquee-ltr';
  const track = useMemo(() => buildMarqueeTrack(products), [products]);

  const shopLink = categoryFilter
    ? `/shop?${categoryFilter}`
    : `/shop?category=${encodeURIComponent(title)}`;

  const gridItems = gridExpanded ? products : products.slice(0, GRID_PREVIEW);
  const hasMoreGrid = products.length > GRID_PREVIEW;

  const handlePointerDown = useCallback((e) => {
    if (e.button !== 0) return;
    dragRef.current = { active: true, startX: e.clientX };
    setPaused(true);
  }, []);

  const handlePointerUp = useCallback(() => {
    dragRef.current.active = false;
    setPaused(false);
  }, []);

  if (!products.length) return null;

  const sectionId = id || title.toLowerCase().replace(/\s+/g, '-');

  return (
    <section
      id={`cat-${sectionId}`}
      className="py-8 md:py-10 scroll-mt-24"
      style={{ scrollMarginTop: '5rem' }}
    >
      <div className="container-custom flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-5">
        <div className="flex gap-3 items-start">
          <div className="w-1 self-stretch rounded-full shrink-0 min-h-[3rem]" style={{ background: accent }} />
          <div>
            <h3 className="text-xl md:text-2xl font-bold tracking-tight">{title}</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {description || `${products.length} título${products.length !== 1 ? 's' : ''}`}
              {viewMode === 'marquee' && !reducedMotion && ' · Toque para pausar'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {viewMode === 'marquee' && !reducedMotion && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-10 sm:h-8 gap-1.5 text-xs"
              onClick={() => setPaused((p) => !p)}
            >
              {paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
              {paused ? 'Continuar' : 'Pausar'}
            </Button>
          )}
          <Link to={shopLink}>
            <Button variant="ghost" size="sm" className="text-primary hover:text-[#0c4a6e]">
              Ver todos <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </Link>
        </div>
      </div>

      {viewMode === 'grid' ? (
        <div className="container-custom">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-5">
            {gridItems.map((product, i) => (
              <ProductCard
                key={product.id}
                product={product}
                index={i}
                onCartOpen={onCartOpen}
                onQuickView={onBookSelect}
              />
            ))}
          </div>
          {hasMoreGrid && (
            <div className="text-center mt-6">
              <Button variant="outline" size="sm" onClick={() => setGridExpanded((e) => !e)}>
                {gridExpanded ? (
                  <>Mostrar menos <ChevronUp className="h-4 w-4 ml-1" /></>
                ) : (
                  <>Ver mais {products.length - GRID_PREVIEW} livros <ChevronDown className="h-4 w-4 ml-1" /></>
                )}
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div
          className="relative overflow-hidden select-none"
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          <div className="pointer-events-none absolute inset-y-0 left-0 w-16 md:w-28 bg-gradient-to-r from-background via-background/90 to-transparent z-10" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-16 md:w-28 bg-gradient-to-l from-background via-background/90 to-transparent z-10" />

          {paused && !reducedMotion && (
            <div className="absolute top-2 right-4 z-20 text-[10px] font-medium px-2 py-1 rounded-full bg-background/90 border shadow-sm text-muted-foreground flex items-center gap-1">
              <Pause className="h-3 w-3" /> Pausado
            </div>
          )}

          <div
            className={`flex gap-4 md:gap-5 w-max will-change-transform ${reducedMotion ? '' : animClass}`}
            style={reducedMotion ? undefined : {
              animationDuration: `${duration}s`,
              animationPlayState: paused ? 'paused' : 'running',
            }}
          >
            {(reducedMotion ? products : track).map((item, i) => {
              const product = reducedMotion ? item : item.product;
              const key = reducedMotion ? product.id : `${product.id}-${item.copy}`;
              return (
                <MarqueeBookCard
                  key={key}
                  product={product}
                  onSelect={onBookSelect}
                  accent={accent}
                />
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
