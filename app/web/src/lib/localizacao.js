/** Localização do visitante e distância às lojas físicas. */

import { hasCoords } from '@/lib/stores';

const RAIO_TERRA_KM = 6371;
const rad = (graus) => (graus * Math.PI) / 180;

/**
 * Número a sério, ou nada.
 *
 * Não serve `Number(v)` sozinho: `Number(null)` e `Number('')` dão **zero**, e por aí uma
 * coordenada em falta passava por latitude 0 — uma loja sem GPS aparecia no Golfo da Guiné,
 * a 600 km da costa, e com distância a sério ao lado. Aceita texto porque a base de dados
 * devolve as coordenadas como cadeias.
 */
const numero = (v) => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

/**
 * Distância em linha recta, em quilómetros (fórmula de Haversine).
 *
 * Não é a distância a percorrer — essa depende das ruas e só o serviço de mapas a sabe.
 * Serve para ordenar as lojas e dar uma ideia de quão perto fica cada uma; quem quiser o
 * percurso carrega em "Como chegar".
 */
export function distanciaKm(a, b) {
  const aLat = numero(a?.latitude); const aLng = numero(a?.longitude);
  const bLat = numero(b?.latitude); const bLng = numero(b?.longitude);
  if (aLat === null || aLng === null || bLat === null || bLng === null) return null;

  const dLat = rad(bLat - aLat);
  const dLng = rad(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  return RAIO_TERRA_KM * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Distância para ler, em português.
 *
 * Abaixo de um quilómetro dá metros arredondados à dezena — "320 m" diz mais do que
 * "0,3 km" a quem vai a pé. Acima, o número de casas decimais desce à medida que a
 * distância sobe: a precisão ao decímetro de quilómetro não interessa a ninguém a 40 km.
 */
export function formatarDistancia(km) {
  const n = numero(km);
  if (n === null || n < 0) return null;
  if (n < 0.95) return `${Math.max(10, Math.round((n * 1000) / 10) * 10)} m`;
  if (n < 10) return `${n.toFixed(1).replace('.', ',')} km`;
  return `${Math.round(n)} km`;
}

/**
 * Precisão do sinal, quando vale a pena mostrá-la.
 *
 * Abaixo de 50 m não acrescenta nada — é o que se espera de um GPS. Acima de 20 km o
 * valor vem de uma estimativa pelo endereço de rede e dizer "±35 km" só confundiria:
 * nesse caso é melhor não prometer precisão nenhuma.
 */
export function precisaoLegivel(metros) {
  const n = numero(metros);
  if (n === null || n < 50 || n > 20000) return null;
  return n < 1000 ? `±${Math.round(n / 10) * 10} m` : `±${(n / 1000).toFixed(1).replace('.', ',')} km`;
}

/** Códigos de `GeolocationPositionError`. */
export const GEO_PERMISSAO_NEGADA = 1;
export const GEO_POSICAO_INDISPONIVEL = 2;
export const GEO_TEMPO_ESGOTADO = 3;

/**
 * O que dizer ao visitante quando a localização falha.
 *
 * O navegador devolve um número; sem isto, o pedido falhava em silêncio e ficava um botão
 * que aparentemente não fazia nada. Cada caso tem saída diferente — autorizar, ligar o GPS,
 * ou simplesmente tentar outra vez —, por isso não serve uma mensagem só.
 */
export function mensagemDeErro(codigo) {
  switch (Number(codigo)) {
    case GEO_PERMISSAO_NEGADA:
      return 'Não autorizou o acesso à localização. Pode mudar isso nas definições do navegador e tentar de novo.';
    case GEO_POSICAO_INDISPONIVEL:
      return 'Não foi possível determinar onde está. Confirme que o GPS está ligado e tente outra vez.';
    case GEO_TEMPO_ESGOTADO:
      return 'A localização está a demorar. Em espaços fechados o sinal é fraco — experimente junto a uma janela.';
    default:
      return 'Não foi possível obter a sua localização. As lojas continuam todas aqui em baixo.';
  }
}

/**
 * Lojas ordenadas da mais perto para a mais longe, cada uma com a sua `distancia`.
 *
 * As que não têm coordenadas ficam no fim e com `distancia` nula — não são escondidas,
 * porque uma loja sem GPS registado continua a ser uma loja a que se pode ir. Sem posição
 * do visitante devolve a lista pela ordem em que veio.
 */
export function ordenarPorDistancia(lojas, posicao) {
  const lista = Array.isArray(lojas) ? lojas : [];
  if (!posicao || numero(posicao.latitude) === null || numero(posicao.longitude) === null) {
    return lista.map((loja) => ({ ...loja, distancia: null }));
  }
  return lista
    .map((loja) => ({
      ...loja,
      distancia: hasCoords(loja)
        ? distanciaKm(posicao, { latitude: loja.latitude, longitude: loja.longitude })
        : null,
    }))
    .sort((a, b) => (a.distancia ?? Infinity) - (b.distancia ?? Infinity));
}

/**
 * Iniciais para o lugar da fotografia que a loja não tem.
 *
 * Tira as palavras que todas as lojas repetem — o nome da marca e as ligações — e fica com
 * o que as distingue: "Livraria Adventista — Catumbela" dá "CA". Sem isto, quatro lojas
 * mostravam o mesmo "LA" e o lugar reservado não ajudava a distinguir nenhuma.
 */
const PALAVRAS_COMUNS = new Set(['livraria', 'adventista', 'loja', 'de', 'da', 'do', 'das', 'dos', 'e']);

export function iniciaisDaLoja(nome) {
  const limpo = String(nome || '').replace(/[—–-]/g, ' ');
  const palavras = limpo.split(/\s+/).map((p) => p.trim()).filter(Boolean);
  const distintas = palavras.filter((p) => !PALAVRAS_COMUNS.has(p.toLowerCase()));
  const base = distintas.length ? distintas : palavras;
  if (!base.length) return '?';
  if (base.length === 1) return base[0].slice(0, 2).toUpperCase();
  return (base[0][0] + base[base.length - 1][0]).toUpperCase();
}
