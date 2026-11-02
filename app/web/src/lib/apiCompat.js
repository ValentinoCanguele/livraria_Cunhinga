/**
 * Compatibilidade com a Edge Function publicada.
 *
 * O site e a Edge Function são publicados por caminhos diferentes: o site pelo Cloudflare
 * Pages, a função pelo Supabase. Entre um deploy e o outro há sempre uma janela em que o
 * site novo fala com a função antiga — e hoje essa janela está aberta há dias, porque o
 * GitHub Actions está bloqueado por facturação e a função publicada é anterior a várias
 * rotas que já existem no repositório (verificado: `/health` responde 200 e
 * `/admin/orders/payment-status` responde 404).
 *
 * Quem chamar uma rota nova tem de saber distinguir "esta rota ainda não existe" de "correu
 * mal": a primeira pede um caminho alternativo, a segunda é um erro a mostrar.
 */

/** Mensagem exacta com que a Edge Function recusa um caminho que não conhece. */
const UNKNOWN_ROUTE_MESSAGE = 'rota não encontrada';

/**
 * `true` quando o erro é de uma rota que a função publicada ainda não tem.
 *
 * Testa a mensagem e não só o código: as rotas devolvem 404 também quando o registo pedido
 * não existe ("Encomenda não encontrada."), e tratar esse caso como rota em falta esconderia
 * um erro verdadeiro.
 */
export function isMissingRoute(err) {
  if (!err || err.status !== 404) return false;
  const message = String(err.message || '').toLowerCase();
  return message.includes(UNKNOWN_ROUTE_MESSAGE);
}

/** Aviso a mostrar quando uma funcionalidade depende de uma rota ainda não publicada. */
export const EDGE_FUNCTION_DESACTUALIZADA =
  'A API da loja publicada é anterior a esta funcionalidade. Publique a Edge Function "app" para a activar.';
