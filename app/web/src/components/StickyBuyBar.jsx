import React, { useEffect, useState } from 'react';
import { ShoppingCart as ShoppingCartIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Barra de compra presa ao fundo, só em telemóvel.
 *
 * A ficha de um livro mede quase 6000px num ecrã de telemóvel, e os botões de compra ficam
 * a mais de mil do topo: quem desce a ler a descrição e as avaliações deixa de ter como
 * comprar sem voltar atrás.
 *
 * **Aparece só quando os botões reais já passaram para cima.** Uma barra permanente taparia
 * conteúdo durante toda a leitura para repetir um botão que ainda está à vista, e no topo da
 * página estaria a insistir numa compra que ninguém chegou a considerar.
 *
 * Mede no deslocamento e não com `IntersectionObserver`. O observador seria o instrumento
 * indicado, e isolado comportava-se bem, mas dentro deste ecrã avisava à entrada dos botões
 * e não à saída — e uma barra que depende de um aviso que pode não chegar é pior do que uma
 * medição simples. Uma leitura por fotograma, agendada com `requestAnimationFrame` e só
 * enquanto a página se move, custa pouco: é um `getBoundingClientRect` sobre um elemento.
 *
 * Recebe o **elemento** e não um objecto `ref`: assim é uma dependência a sério do efeito,
 * que volta a correr assim que o elemento aparece em vez de ficar preso a um `ref` vazio.
 */
/** Altura da barra, para quem flutua no fundo se afastar dela. */
const ALTURA_BARRA = 72;

export default function StickyBuyBar({ alvo, price, originalPrice, onBuy, disabled = false, label = 'Comprar' }) {
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    if (!alvo) return undefined;
    let agendado = false;

    const medir = () => {
      agendado = false;
      // Já passou para cima: o fundo do bloco de botões está acima do topo do ecrã.
      setVisivel(alvo.getBoundingClientRect().bottom < 0);
    };

    const aoMover = () => {
      if (agendado) return;
      agendado = true;
      requestAnimationFrame(medir);
    };

    // Posição de entrada: quem chega por uma âncora, ou a quem o navegador restaura o
    // deslocamento, já pode estar abaixo dos botões sem nunca ter deslocado nada.
    medir();
    window.addEventListener('scroll', aoMover, { passive: true });
    window.addEventListener('resize', aoMover, { passive: true });
    return () => {
      window.removeEventListener('scroll', aoMover);
      window.removeEventListener('resize', aoMover);
    };
  }, [alvo]);

  // Avisa o resto da página da altura que esta barra ocupa, para o assistente e o botão de
  // subir se afastarem em vez de ficarem por cima dela. Uma variável no documento mantém
  // isto desacoplado: nenhum desses componentes precisa de saber que esta barra existe.
  useEffect(() => {
    const raiz = document.documentElement;
    raiz.style.setProperty('--barra-compra', visivel ? `${ALTURA_BARRA}px` : '0px');
    return () => raiz.style.setProperty('--barra-compra', '0px');
  }, [visivel]);

  if (!visivel) return null;

  return (
    <div
      className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur-sm sm:hidden"
      style={{ boxShadow: '0 -4px 16px -6px rgb(0 0 0 / 0.14)' }}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-bold text-primary">{price}</p>
          {/* Só quando há mesmo promoção: sem ela, `originalPrice` é igual ao preço e a
              barra mostrava o mesmo valor duas vezes, uma delas riscada. */}
          {originalPrice && originalPrice !== price && (
            <p className="truncate text-xs text-muted-foreground line-through">{originalPrice}</p>
          )}
        </div>
        <Button onClick={onBuy} disabled={disabled} className="btn-primary h-12 shrink-0 px-6 text-base">
          <ShoppingCartIcon className="mr-2 h-5 w-5" aria-hidden />
          {label}
        </Button>
      </div>
    </div>
  );
}
