/**
 * 21 províncias de Angola conforme RGPH 2024 (INE).
 * Lista canónica para selects administrativos.
 */
export const ANGOLA_PROVINCES_2024 = [
  'Cabinda',
  'Zaire',
  'Uíge',
  'Bengo',
  'Luanda',
  'Icolo e Bengo',
  'Cuanza Norte',
  'Cuanza Sul',
  'Malanje',
  'Lunda Norte',
  'Lunda Sul',
  'Moxico',
  'Moxico Leste',
  'Bié',
  'Huambo',
  'Benguela',
  'Namibe',
  'Huíla',
  'Cunene',
  'Cubango',
  'Cuando',
];

export const ANGOLA_GEO_VERSION = 'RGPH-2024';

export function buildFullDeliveryAddress({
  street = '',
  locality = '',
  municipality = '',
  province = '',
  reference = '',
} = {}) {
  const parts = [street, locality, municipality, province].filter(Boolean);
  let full = parts.join(', ');
  if (reference) full += (full ? ' — ' : '') + `Ref: ${reference}`;
  if (full) full += ', Angola';
  return full;
}

/**
 * Capitais das 21 províncias, para confirmar que umas coordenadas ficam onde dizem ficar.
 *
 * Não são centróides: é a cidade capital de cada província, que é onde uma loja quase
 * sempre está. Serve para comparar, não para localizar.
 */
export const CAPITAIS_DE_PROVINCIA = {
  Cabinda: { latitude: -5.55, longitude: 12.20 },
  Zaire: { latitude: -6.27, longitude: 14.25 },
  'Uíge': { latitude: -7.61, longitude: 15.06 },
  Bengo: { latitude: -8.58, longitude: 13.66 },
  Luanda: { latitude: -8.84, longitude: 13.23 },
  'Icolo e Bengo': { latitude: -9.10, longitude: 13.70 },
  'Cuanza Norte': { latitude: -9.30, longitude: 14.91 },
  'Cuanza Sul': { latitude: -11.21, longitude: 13.84 },
  Malanje: { latitude: -9.54, longitude: 16.34 },
  'Lunda Norte': { latitude: -7.38, longitude: 20.83 },
  'Lunda Sul': { latitude: -9.66, longitude: 20.39 },
  Moxico: { latitude: -11.78, longitude: 19.92 },
  'Moxico Leste': { latitude: -11.90, longitude: 22.92 },
  'Bié': { latitude: -12.39, longitude: 16.93 },
  Huambo: { latitude: -12.78, longitude: 15.74 },
  Benguela: { latitude: -12.58, longitude: 13.41 },
  Namibe: { latitude: -15.19, longitude: 12.15 },
  'Huíla': { latitude: -14.92, longitude: 13.49 },
  Cunene: { latitude: -17.07, longitude: 15.73 },
  Cubango: { latitude: -14.66, longitude: 17.69 },
  Cuando: { latitude: -15.83, longitude: 20.35 },
};

/** Capital de província mais perto de um ponto, com a distância a ela. */
export function provinciaMaisPerto(ponto, distanciaKm) {
  let melhor = null;
  for (const [provincia, capital] of Object.entries(CAPITAIS_DE_PROVINCIA)) {
    const d = distanciaKm(ponto, capital);
    if (d === null) continue;
    if (!melhor || d < melhor.distancia) melhor = { provincia, distancia: d };
  }
  return melhor;
}

/**
 * Aviso quando as coordenadas de uma loja não batem certo com a província escolhida.
 *
 * Duas das três lojas estavam assim: a de Lubango com as coordenadas da Catumbela e a da
 * Catumbela com as de Luanda. O mapa e o "Como chegar" mandavam o cliente a centenas de
 * quilómetros do sítio. Nada no painel dizia nada, porque as coordenadas eram válidas —
 * só não eram as daquela loja.
 *
 * Compara em vez de medir contra um limite fixo: as províncias de Angola têm tamanhos
 * muito diferentes, e qualquer número em quilómetros acertava numas e falhava noutras. O
 * aviso só sai quando a capital de outra província está claramente mais perto — e nunca
 * para quem está mesmo ao lado de uma fronteira, onde isso é normal.
 *
 * É aviso e não bloqueio: quem conhece o terreno pode ter razão contra este cálculo.
 */
const MARGEM_DE_FRONTEIRA_KM = 80;
const QUANTAS_VEZES_MAIS_LONGE = 1.6;

export function avisoDeCoordenadas({ latitude, longitude, province }, distanciaKm) {
  const capitalDeclarada = CAPITAIS_DE_PROVINCIA[province];
  if (!capitalDeclarada) return null;

  const ponto = { latitude, longitude };
  const aoDeclarado = distanciaKm(ponto, capitalDeclarada);
  if (aoDeclarado === null) return null;
  if (aoDeclarado <= MARGEM_DE_FRONTEIRA_KM) return null;

  const perto = provinciaMaisPerto(ponto, distanciaKm);
  if (!perto || perto.provincia === province) return null;
  if (aoDeclarado < perto.distancia * QUANTAS_VEZES_MAIS_LONGE) return null;

  return {
    provinciaProvavel: perto.provincia,
    distanciaAoDeclarado: aoDeclarado,
    mensagem: `Estas coordenadas ficam a ${Math.round(aoDeclarado)} km de ${province} — parecem ser em ${perto.provincia}. Confirme antes de guardar.`,
  };
}
