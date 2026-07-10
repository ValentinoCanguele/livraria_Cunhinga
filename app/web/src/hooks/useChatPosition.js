/** Posição fixa do assistente — canto inferior esquerdo */
export function useChatPosition() {
  const fixedStyle = {
    position: 'fixed',
    zIndex: 45,
    bottom: 24,
    left: 24,
  };

  return { fixedStyle };
}
