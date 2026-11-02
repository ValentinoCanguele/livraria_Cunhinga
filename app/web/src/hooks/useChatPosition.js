/**
 * Posição fixa do assistente — canto inferior esquerdo.
 *
 * O afastamento ao fundo soma a área segura do sistema. Com `viewport-fit=cover` no
 * `index.html`, a página estende-se para baixo da barra de gestos do telemóvel: 24px fixos
 * deixavam o botão por baixo dela, onde o toque vai para o sistema e não para a página.
 * `env()` devolve zero em quem não tem barra nenhuma, por isso não é preciso distinguir
 * equipamentos.
 */
export function useChatPosition() {
  const fixedStyle = {
    position: 'fixed',
    zIndex: 45,
    bottom: 'calc(24px + env(safe-area-inset-bottom, 0px))',
    left: 'calc(24px + env(safe-area-inset-left, 0px))',
  };

  return { fixedStyle };
}
