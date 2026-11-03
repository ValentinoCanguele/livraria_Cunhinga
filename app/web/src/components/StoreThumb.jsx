import React, { useEffect, useState } from 'react';
import { Store } from 'lucide-react';
import { iniciaisDaLoja } from '@/lib/localizacao';

/**
 * A miniatura de uma loja — ou o que fica no lugar dela.
 *
 * Nenhuma das lojas tem fotografia carregada, e o que aparecia era um quadrado cinzento com
 * o mesmo ícone em todas: quatro cartões indistinguíveis à primeira vista. O lugar reservado
 * passa a trazer as iniciais que distinguem a loja sobre a tinta da marca — reconhece-se de
 * relance e continua a ler-se como um lugar vazio, não como a fachada que ninguém fotografou.
 *
 * Uma imagem que não carrega cai no mesmo lugar reservado. Antes, o `onError` escondia-a e
 * deixava o quadrado vazio: o caso mais provável — endereço errado ou rede fraca — era
 * justamente o que ficava pior.
 */
export default function StoreThumb({ store, className = '' }) {
  const url = store?.image_url;
  const [falhou, setFalhou] = useState(false);

  // Trocar de loja não deve herdar a falha da anterior.
  useEffect(() => { setFalhou(false); }, [url]);

  if (url && !falhou) {
    return (
      <div className={`overflow-hidden bg-muted ${className}`}>
        <img
          src={url}
          alt=""
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover"
          onError={() => setFalhou(true)}
        />
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col items-center justify-center gap-1 overflow-hidden bg-gradient-to-br from-primary/15 via-primary/5 to-transparent ${className}`}
      aria-hidden="true"
    >
      <span className="text-base font-bold leading-none tracking-wider text-primary/85">
        {iniciaisDaLoja(store?.name)}
      </span>
      <Store className="h-3.5 w-3.5 text-primary/45" />
    </div>
  );
}
