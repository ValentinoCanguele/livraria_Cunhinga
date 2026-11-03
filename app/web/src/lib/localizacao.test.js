import { describe, expect, it } from 'vitest';
import {
  GEO_PERMISSAO_NEGADA,
  GEO_POSICAO_INDISPONIVEL,
  GEO_TEMPO_ESGOTADO,
  distanciaKm,
  formatarDistancia,
  iniciaisDaLoja,
  mensagemDeErro,
  ordenarPorDistancia,
  precisaoLegivel,
} from '@/lib/localizacao';

// Coordenadas reais das cidades onde a loja tem casa.
const LUANDA = { latitude: -8.8383, longitude: 13.2344 };
const CATUMBELA = { latitude: -12.4333, longitude: 13.5464 };
const HUAMBO = { latitude: -12.7761, longitude: 15.7392 };
const LUBANGO = { latitude: -14.9177, longitude: 13.4925 };

describe('distanciaKm', () => {
  it('bate com a distância conhecida entre duas cidades', () => {
    // Luanda–Lubango são cerca de 675 km em linha recta.
    expect(distanciaKm(LUANDA, LUBANGO)).toBeGreaterThan(660);
    expect(distanciaKm(LUANDA, LUBANGO)).toBeLessThan(690);
  });

  it('dá zero para o mesmo ponto', () => {
    expect(distanciaKm(LUANDA, LUANDA)).toBeCloseTo(0, 6);
  });

  it('não depende da ordem', () => {
    expect(distanciaKm(LUANDA, HUAMBO)).toBeCloseTo(distanciaKm(HUAMBO, LUANDA), 9);
  });

  it('devolve nulo quando falta uma coordenada', () => {
    expect(distanciaKm(LUANDA, null)).toBeNull();
    expect(distanciaKm(LUANDA, { latitude: -12.4 })).toBeNull();
    expect(distanciaKm(LUANDA, { latitude: 'perto', longitude: 13 })).toBeNull();
  });

  it('não confunde coordenada em falta com o zero', () => {
    // `Number(null)` e `Number('')` dão zero: por aí uma loja sem GPS ganhava latitude 0 e
    // aparecia no Golfo da Guiné, com uma distância que parecia verdadeira.
    expect(distanciaKm(LUANDA, { latitude: null, longitude: null })).toBeNull();
    expect(distanciaKm(LUANDA, { latitude: '', longitude: '' })).toBeNull();
    expect(distanciaKm(LUANDA, { latitude: null, longitude: 13.5 })).toBeNull();
  });

  it('aceita coordenadas em texto, como vêm da base de dados', () => {
    const emTexto = distanciaKm(LUANDA, { latitude: '-12.4333', longitude: '13.5464' });
    expect(emTexto).toBeCloseTo(distanciaKm(LUANDA, CATUMBELA), 6);
  });

  it('aguenta pontos antípodas sem estourar na raiz', () => {
    // Com arredondamento, o argumento do arco-seno pode passar de 1 — metade da
    // circunferência da Terra é o máximo possível.
    const antipoda = { latitude: 8.8383, longitude: 13.2344 - 180 };
    const d = distanciaKm(LUANDA, antipoda);
    expect(Number.isFinite(d)).toBe(true);
    expect(d).toBeLessThanOrEqual(20016);
  });
});

describe('formatarDistancia', () => {
  it('abaixo de um quilómetro dá metros arredondados à dezena', () => {
    expect(formatarDistancia(0.32)).toBe('320 m');
    expect(formatarDistancia(0.317)).toBe('320 m');
    expect(formatarDistancia(0.94)).toBe('940 m');
  });

  it('nunca anuncia menos de 10 m', () => {
    // O GPS de um telemóvel não distingue 3 m de 8 m; dizê-lo seria prometer precisão
    // que não existe.
    expect(formatarDistancia(0.001)).toBe('10 m');
    expect(formatarDistancia(0)).toBe('10 m');
  });

  it('entre 1 e 10 km usa uma casa decimal, com vírgula', () => {
    expect(formatarDistancia(1.44)).toBe('1,4 km');
    expect(formatarDistancia(9.96)).toBe('10,0 km');
  });

  it('acima de 10 km arredonda ao quilómetro', () => {
    expect(formatarDistancia(12.4)).toBe('12 km');
    expect(formatarDistancia(674.8)).toBe('675 km');
  });

  it('devolve nulo para o que não é distância', () => {
    expect(formatarDistancia(null)).toBeNull();
    expect(formatarDistancia(-3)).toBeNull();
    expect(formatarDistancia('longe')).toBeNull();
  });
});

describe('precisaoLegivel', () => {
  it('cala-se quando a precisão é a normal de um GPS', () => {
    expect(precisaoLegivel(12)).toBeNull();
    expect(precisaoLegivel(49)).toBeNull();
  });

  it('mostra em metros quando já se nota', () => {
    expect(precisaoLegivel(180)).toBe('±180 m');
    expect(precisaoLegivel(184)).toBe('±180 m');
  });

  it('passa a quilómetros acima dos mil metros', () => {
    expect(precisaoLegivel(2400)).toBe('±2,4 km');
  });

  it('cala-se quando a estimativa é grosseira de mais para servir', () => {
    // Acima de 20 km a posição veio do endereço de rede, não do GPS.
    expect(precisaoLegivel(45000)).toBeNull();
    expect(precisaoLegivel(null)).toBeNull();
  });
});

describe('mensagemDeErro', () => {
  it('diz o que fazer em cada caso, e são mensagens diferentes', () => {
    const negada = mensagemDeErro(GEO_PERMISSAO_NEGADA);
    const indisponivel = mensagemDeErro(GEO_POSICAO_INDISPONIVEL);
    const tempo = mensagemDeErro(GEO_TEMPO_ESGOTADO);
    expect(negada).toMatch(/autoriz/i);
    expect(indisponivel).toMatch(/GPS/);
    expect(tempo).toMatch(/demorar|demora/i);
    expect(new Set([negada, indisponivel, tempo]).size).toBe(3);
  });

  it('tem uma saída para códigos que não conhece', () => {
    expect(mensagemDeErro(99)).toBeTruthy();
    expect(mensagemDeErro(undefined)).toBeTruthy();
  });
});

describe('ordenarPorDistancia', () => {
  const LOJAS = [
    { id: 'lubango', name: 'Lubango', ...LUBANGO },
    { id: 'catumbela', name: 'Catumbela', ...CATUMBELA },
    { id: 'sem-gps', name: 'Sem coordenadas' },
    { id: 'huambo', name: 'Huambo', ...HUAMBO },
  ];

  it('põe a mais perto à frente', () => {
    const r = ordenarPorDistancia(LOJAS, CATUMBELA);
    expect(r[0].id).toBe('catumbela');
    expect(r[0].distancia).toBeCloseTo(0, 5);
  });

  it('a ordem muda com quem pergunta', () => {
    expect(ordenarPorDistancia(LOJAS, LUBANGO)[0].id).toBe('lubango');
    expect(ordenarPorDistancia(LOJAS, HUAMBO)[0].id).toBe('huambo');
  });

  it('a loja sem coordenadas fica no fim, mas fica', () => {
    const r = ordenarPorDistancia(LOJAS, CATUMBELA);
    expect(r).toHaveLength(4);
    expect(r[r.length - 1].id).toBe('sem-gps');
    expect(r[r.length - 1].distancia).toBeNull();
  });

  it('sem posição devolve a ordem original e nenhuma distância', () => {
    const r = ordenarPorDistancia(LOJAS, null);
    expect(r.map((x) => x.id)).toEqual(['lubango', 'catumbela', 'sem-gps', 'huambo']);
    expect(r.every((x) => x.distancia === null)).toBe(true);
  });

  it('não mexe na lista que recebeu', () => {
    const copia = LOJAS.map((x) => ({ ...x }));
    ordenarPorDistancia(LOJAS, CATUMBELA);
    expect(LOJAS).toEqual(copia);
  });

  it('aguenta lista em falta', () => {
    expect(ordenarPorDistancia(null, CATUMBELA)).toEqual([]);
    expect(ordenarPorDistancia(undefined, null)).toEqual([]);
  });

  it('ignora o (0,0) que fica de um campo por preencher', () => {
    const comZeros = [{ id: 'zeros', latitude: 0, longitude: 0 }, { id: 'huambo', ...HUAMBO }];
    const r = ordenarPorDistancia(comZeros, CATUMBELA);
    expect(r[0].id).toBe('huambo');
    expect(r.find((x) => x.id === 'zeros').distancia).toBeNull();
  });
});

describe('iniciaisDaLoja', () => {
  it('fica com o que distingue a loja, não com o nome da marca', () => {
    // As quatro lojas começam por "Livraria Adventista": por aí eram todas "LA".
    expect(iniciaisDaLoja('Livraria Adventista — Catumbela')).toBe('CA');
    expect(iniciaisDaLoja('Livraria Adventista - Huambo')).toBe('HU');
    expect(iniciaisDaLoja('Livraria Adventista — Lubango')).toBe('LU');
  });

  it('junta a primeira e a última quando sobram várias palavras', () => {
    expect(iniciaisDaLoja('Livraria Adventista Benguela Centro')).toBe('BC');
  });

  it('usa o nome todo quando não há mais nada que o distinga', () => {
    expect(iniciaisDaLoja('Livraria Adventista')).toBe('LA');
    expect(iniciaisDaLoja('Livraria')).toBe('LI');
  });

  it('aguenta nomes vazios', () => {
    expect(iniciaisDaLoja('')).toBe('?');
    expect(iniciaisDaLoja(null)).toBe('?');
    expect(iniciaisDaLoja('   ')).toBe('?');
  });
});
