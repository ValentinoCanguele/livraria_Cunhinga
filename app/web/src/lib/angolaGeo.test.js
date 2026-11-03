import { describe, expect, it } from 'vitest';
import {
  ANGOLA_PROVINCES_2024,
  CAPITAIS_DE_PROVINCIA,
  avisoDeCoordenadas,
  provinciaMaisPerto,
} from '@/lib/angolaGeo';
import { distanciaKm } from '@/lib/localizacao';

// Coordenadas reais que estavam guardadas nas três lojas, lidas da loja em produção.
const GUARDADO_HUAMBO = { latitude: -12.779196, longitude: 15.760069 };
const GUARDADO_LUBANGO = { latitude: -12.5763, longitude: 13.4055 };
const GUARDADO_CATUMBELA = { latitude: -8.9094, longitude: 13.184 };

describe('CAPITAIS_DE_PROVINCIA', () => {
  it('cobre as 21 províncias da lista canónica, sem sobrar nenhuma', () => {
    expect(Object.keys(CAPITAIS_DE_PROVINCIA).sort())
      .toEqual([...ANGOLA_PROVINCES_2024].sort());
  });

  it('todas as capitais caem dentro de Angola', () => {
    // Angola vai de cerca de -4,4 a -18,0 de latitude e de 11,6 a 24,1 de longitude.
    for (const [provincia, c] of Object.entries(CAPITAIS_DE_PROVINCIA)) {
      expect(c.latitude, provincia).toBeGreaterThan(-18.1);
      expect(c.latitude, provincia).toBeLessThan(-4.3);
      expect(c.longitude, provincia).toBeGreaterThan(11.5);
      expect(c.longitude, provincia).toBeLessThan(24.2);
    }
  });
});

describe('provinciaMaisPerto', () => {
  it('reconhece onde cada coordenada guardada fica mesmo', () => {
    expect(provinciaMaisPerto(GUARDADO_HUAMBO, distanciaKm).provincia).toBe('Huambo');
    expect(provinciaMaisPerto(GUARDADO_LUBANGO, distanciaKm).provincia).toBe('Benguela');
    expect(provinciaMaisPerto(GUARDADO_CATUMBELA, distanciaKm).provincia).toBe('Luanda');
  });

  it('devolve também a distância à capital que encontrou', () => {
    const r = provinciaMaisPerto(GUARDADO_HUAMBO, distanciaKm);
    expect(r.distancia).toBeLessThan(5);
  });

  it('não se engasga sem coordenadas', () => {
    expect(provinciaMaisPerto({ latitude: null, longitude: null }, distanciaKm)).toBeNull();
  });
});

describe('avisoDeCoordenadas', () => {
  it('apanha as duas lojas que estavam na província errada', () => {
    // Era o caso real: o mapa e o "Como chegar" mandavam o cliente a centenas de
    // quilómetros do sítio, e nada no painel dizia nada.
    const lubango = avisoDeCoordenadas({ ...GUARDADO_LUBANGO, province: 'Huíla' }, distanciaKm);
    expect(lubango).not.toBeNull();
    expect(lubango.provinciaProvavel).toBe('Benguela');
    expect(lubango.distanciaAoDeclarado).toBeGreaterThan(200);
    expect(lubango.mensagem).toContain('Benguela');

    const catumbela = avisoDeCoordenadas({ ...GUARDADO_CATUMBELA, province: 'Benguela' }, distanciaKm);
    expect(catumbela).not.toBeNull();
    expect(catumbela.provinciaProvavel).toBe('Luanda');
    expect(catumbela.distanciaAoDeclarado).toBeGreaterThan(350);
  });

  it('cala-se com a loja que está certa', () => {
    expect(avisoDeCoordenadas({ ...GUARDADO_HUAMBO, province: 'Huambo' }, distanciaKm)).toBeNull();
  });

  it('cala-se em cima de cada capital', () => {
    for (const [provincia, c] of Object.entries(CAPITAIS_DE_PROVINCIA)) {
      expect(avisoDeCoordenadas({ ...c, province: provincia }, distanciaKm), provincia).toBeNull();
    }
  });

  it('não incomoda quem está perto de uma fronteira', () => {
    // A 60 km da capital da sua província, ainda que a de outra calhe mais perto: numa
    // zona de fronteira isso é normal e um aviso só seria ruído.
    const naFronteira = { latitude: -12.80, longitude: 14.20 };
    const aviso = avisoDeCoordenadas({ ...naFronteira, province: 'Benguela' }, distanciaKm);
    if (aviso) expect(aviso.distanciaAoDeclarado).toBeGreaterThan(80);
  });

  it('cala-se quando a província não é das 21, ou falta', () => {
    expect(avisoDeCoordenadas({ ...GUARDADO_CATUMBELA, province: 'Lisboa' }, distanciaKm)).toBeNull();
    expect(avisoDeCoordenadas({ ...GUARDADO_CATUMBELA, province: '' }, distanciaKm)).toBeNull();
  });

  it('cala-se sem coordenadas — é o caso de quem ainda não as preencheu', () => {
    expect(avisoDeCoordenadas({ latitude: null, longitude: null, province: 'Luanda' }, distanciaKm)).toBeNull();
    expect(avisoDeCoordenadas({ latitude: '', longitude: '', province: 'Huíla' }, distanciaKm)).toBeNull();
  });

  it('diz quantos quilómetros, para quem edita poder julgar', () => {
    const aviso = avisoDeCoordenadas({ ...GUARDADO_CATUMBELA, province: 'Huíla' }, distanciaKm);
    expect(aviso.mensagem).toMatch(/\d+ km/);
  });
});
