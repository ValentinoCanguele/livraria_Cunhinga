import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { clearRecentlyViewed, getRecentlyViewed, recentExcluding } from '@/lib/recentlyViewed';

const PLACEHOLDER = '/images/site/capa-indisponivel.webp';

/**
 * Fila dos livros vistos há pouco.
 *
 * Lê do navegador no primeiro desenho e não volta a ler: a lista só muda ao abrir a ficha de
 * um livro, e nessa altura a página já é outra. Verificá-la a cada render seria ir ao
 * armazenamento dezenas de vezes sem nada mudar.
 *
 * Não aparece com menos de dois livros — um só não é histórico nenhum, e a secção vazia
 * ocuparia espaço a dizer o quê.
 */
export default function RecentlyViewed({ currentId = null, title = 'Vistos há pouco', className = '' }) {
  const [itens, setItens] = useState([]);

  useEffect(() => {
    setItens(recentExcluding(getRecentlyViewed(), currentId));
  }, [currentId]);

  if (itens.length < 2) return null;

  return (
    <section className={`border-t border-border bg-muted/10 ${className}`} aria-labelledby="vistos-titulo">
      <div className="container-custom py-8">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 id="vistos-titulo" className="flex items-center gap-2 text-lg font-bold">
            <Clock className="h-4 w-4 text-muted-foreground" aria-hidden />
            {title}
          </h2>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground"
            onClick={() => setItens(clearRecentlyViewed())}
          >
            <X className="mr-1 h-3.5 w-3.5" aria-hidden />
            Limpar
          </Button>
        </div>

        {/* Fila que desliza com o dedo. `snap` para cada capa parar alinhada em vez de ficar
            cortada a meio, e `-mx-4 px-4` para a primeira e a última encostarem à margem da
            página em vez de ficarem presas dentro do contentor. */}
        <ul className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:thin]">
          {itens.map((item) => (
            <li key={item.id} className="w-28 shrink-0 snap-start sm:w-32">
              <Link
                to={`/product/${item.id}`}
                className="surface-raise block overflow-hidden rounded-xl border border-border bg-card"
              >
                <div className="aspect-[3/4] overflow-hidden bg-muted">
                  <img
                    src={item.image || PLACEHOLDER}
                    alt={item.title}
                    loading="lazy"
                    decoding="async"
                    className="media-zoom h-full w-full object-cover"
                    onError={(e) => { e.target.onerror = null; e.target.src = PLACEHOLDER; }}
                  />
                </div>
                <div className="p-2">
                  <p className="line-clamp-2 text-xs font-semibold leading-snug">{item.title}</p>
                  {item.price && <p className="mt-1 text-xs text-brand-ink">{item.price}</p>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
