import { useEffect, useState } from 'react';

/** Quantos pixels é preciso descer para o cabeçalho entrar. Uns poucos, para que o
 *  ressalto do iOS no topo e um toque sem intenção não o ponham a piscar. */
export const REVEAL_AT = 24;

/**
 * Decide se o cabeçalho deve estar à vista. Função pura, à parte do hook, para se poder
 * testar sem montar nada.
 *
 * Fica à vista à força em dois casos. Com `forceVisible` — menu ou pesquisa abertos, ou o
 * foco do teclado lá dentro: esconder o que está a ser usado tirava o tapete a quem o usa,
 * e um link invisível mas ainda focável é uma armadilha para quem navega por tabulação.
 * E com `scrollable` falso, numa página curta demais para se deslocar, onde senão não
 * haveria maneira nenhuma de lá chegar — sem isto, uma página de erro ficava sem navegação.
 */
export function shouldReveal({ scrollY = 0, forceVisible = false, scrollable = true } = {}) {
  if (forceVisible) return true;
  if (!scrollable) return true;
  return scrollY > REVEAL_AT;
}

/**
 * No topo da página o cabeçalho sai de cena, para a imagem de entrada ficar inteira;
 * à primeira descida volta. Devolve `true` quando deve estar à vista.
 */
export function useHeaderReveal(forceVisible = false) {
  const [scrollY, setScrollY] = useState(0);
  const [scrollable, setScrollable] = useState(true);

  useEffect(() => {
    let frame = 0;
    // O evento de deslocamento dispara a cada fotograma; ler a posição é barato, mas
    // marcar o estado a cada um não é. O pedido de fotograma junta as rajadas numa só.
    const read = () => {
      frame = 0;
      setScrollY(window.scrollY);
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(read);
    };
    // Uma leitura directa à entrada: o navegador pode repor o deslocamento de uma visita
    // anterior, e aí a página abre a meio sem que nenhum evento chegue a disparar.
    read();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    // A altura da página muda depois de carregar (capas, listas), por isso não chega
    // medir uma vez: o observador volta a medir quando o conteúdo cresce ou encolhe.
    const measure = () => {
      setScrollable(document.documentElement.scrollHeight > window.innerHeight + REVEAL_AT);
    };
    measure();
    window.addEventListener('resize', measure);
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null;
    if (observer && document.body) observer.observe(document.body);
    return () => {
      window.removeEventListener('resize', measure);
      observer?.disconnect();
    };
  }, []);

  return shouldReveal({ scrollY, forceVisible, scrollable });
}

export default useHeaderReveal;
