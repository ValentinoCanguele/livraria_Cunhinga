import { describe, expect, it } from 'vitest';
import { contrastRatio, ensureContrastOnWhite, hexToRgb, relativeLuminance } from '@/lib/shopTheme';

const BRANCO = { r: 255, g: 255, b: 255 };
const PRETO = { r: 0, g: 0, b: 0 };

const razaoSobreBranco = (hex) => contrastRatio(hexToRgb(hex), BRANCO);

describe('relativeLuminance', () => {
  it('vai de 0 no preto a 1 no branco', () => {
    expect(relativeLuminance(PRETO)).toBe(0);
    expect(relativeLuminance(BRANCO)).toBeCloseTo(1, 5);
  });
});

describe('contrastRatio', () => {
  it('preto sobre branco dá o máximo de 21', () => {
    expect(contrastRatio(PRETO, BRANCO)).toBeCloseTo(21, 1);
  });

  it('a mesma cor dá 1', () => {
    expect(contrastRatio(BRANCO, BRANCO)).toBeCloseTo(1, 5);
  });

  it('não depende da ordem', () => {
    const a = hexToRgb('#0ea5c9');
    expect(contrastRatio(a, BRANCO)).toBeCloseTo(contrastRatio(BRANCO, a), 5);
  });

  it('confirma o problema que originou isto', () => {
    // A cor da marca desta loja sobre branco: era a cor dos preços.
    expect(razaoSobreBranco('#0ea5c9')).toBeLessThan(4.5);
    expect(razaoSobreBranco('#0ea5c9')).toBeCloseTo(2.9, 1);
  });
});

describe('ensureContrastOnWhite', () => {
  it('escurece até passar o mínimo, com folga', () => {
    // Mira acima dos 4,5 da WCAG: nem todos os fundos da loja são branco puro, e sobre o
    // cinzento claro da faixa de livros a mesma cor media 4,41 — falhava por nove centésimas.
    const corrigida = ensureContrastOnWhite('#0ea5c9');
    expect(razaoSobreBranco(corrigida)).toBeGreaterThanOrEqual(4.8);
  });

  it('mantém o tom — continua o mesmo azul, só mais fundo', () => {
    // Escurecer proporcionalmente preserva a relação entre canais: o canal com mais força
    // continua a ser o mesmo, por isso a cor não muda de família.
    const original = hexToRgb('#0ea5c9');
    const corrigida = hexToRgb(ensureContrastOnWhite('#0ea5c9'));
    expect(corrigida.b).toBeGreaterThan(corrigida.g);
    expect(corrigida.g).toBeGreaterThan(corrigida.r);
    expect(original.b).toBeGreaterThan(original.g);
    expect(original.g).toBeGreaterThan(original.r);
    // E é mesmo mais escura.
    expect(relativeLuminance(corrigida)).toBeLessThan(relativeLuminance(original));
  });

  it('não mexe no que já passa', () => {
    // Um azul-escuro que já cumpre fica exactamente como estava.
    const escuro = '#1b365d';
    expect(razaoSobreBranco(escuro)).toBeGreaterThanOrEqual(4.5);
    expect(ensureContrastOnWhite(escuro)).toBe(escuro);
  });

  it('funciona com qualquer cor que configurem no painel', () => {
    // É por isto que se calcula em vez de fixar um valor: a cor da marca é editável.
    for (const hex of ['#0ea5c9', '#22c55e', '#facc15', '#f97316', '#ec4899', '#84cc16']) {
      const corrigida = ensureContrastOnWhite(hex);
      expect(razaoSobreBranco(corrigida), `${hex} → ${corrigida}`).toBeGreaterThanOrEqual(4.79);
    }
  });

  it('aceita um mínimo diferente', () => {
    // 3:1 é o que a WCAG pede a texto grande e a elementos gráficos.
    const paraIcone = ensureContrastOnWhite('#0ea5c9', 3);
    expect(razaoSobreBranco(paraIcone)).toBeGreaterThanOrEqual(3);
    // E dá uma cor mais clara do que a exigência de 4,5.
    expect(relativeLuminance(hexToRgb(paraIcone)))
      .toBeGreaterThan(relativeLuminance(hexToRgb(ensureContrastOnWhite('#0ea5c9', 4.5))));
  });

  it('devolve preto quando nem escurecer chega', () => {
    // Amarelo puro só passa 4,5 muito escuro; o preto é o limite seguro.
    const corrigida = ensureContrastOnWhite('#ffff00', 15);
    expect(razaoSobreBranco(corrigida)).toBeGreaterThanOrEqual(15);
  });

  it('aguenta entradas estranhas', () => {
    expect(() => ensureContrastOnWhite(null)).not.toThrow();
    expect(() => ensureContrastOnWhite('')).not.toThrow();
    expect(() => ensureContrastOnWhite('#abc')).not.toThrow();
  });
});
