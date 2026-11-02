/**
 * Interruptores dos refinamentos visuais.
 *
 * Cada efeito acrescentado entra por um destes. Serve três coisas:
 *
 * 1. **Reverter sem publicar outra vez.** Se um efeito se portar mal num equipamento ou
 *    numa página, desliga-se pelo endereço, na hora, sem esperar por um deploy.
 * 2. **Comparar medições.** Com e sem o efeito, na mesma máquina e na mesma rede, é a única
 *    forma de saber quanto é que ele custou de facto em LCP, CLS e resposta ao toque.
 * 3. **Degradar sozinho.** Quem pediu menos movimento no sistema operativo, ou está num
 *    equipamento fraco, recebe a versão sem efeitos sem ter de fazer nada.
 *
 * O estado vai para atributos `data-ff-*` no `<html>`, para o CSS reagir sem re-render:
 * um efeito liga-se e desliga-se sem o React voltar a desenhar nada.
 */

/** Os refinamentos e o que cada um liga. `true` = activo por omissão. */
export const FLAG_DEFAULTS = {
  /** Sombras em camadas e elevação ao passar o rato ou tocar nos cartões. */
  elevacao: true,
  /** Transições de estado nos botões e controlos. */
  transicoes: true,
  /** Zoom progressivo das capas dentro do cartão. */
  zoomImagem: true,
};

export const FLAG_NAMES = Object.keys(FLAG_DEFAULTS);

const STORAGE_KEY = 'livraria_ff';

const truthy = (v) => v === '1' || v === 'true' || v === 'on' || v === 'sim';
const falsy = (v) => v === '0' || v === 'false' || v === 'off' || v === 'nao' || v === 'não';

/**
 * Lê os desvios ao que está por omissão.
 *
 * Pelo endereço: `?ff=elevacao:0` ou `?ff=elevacao:0,zoomImagem:0`. Fica guardado para as
 * páginas seguintes — quem está a testar não quer repetir o parâmetro em cada clique.
 * `?ff=reset` limpa e volta ao normal.
 */
export function readFlagOverrides({ search = '', storage } = {}) {
  const out = {};
  let store = null;
  try {
    store = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
  } catch {
    store = null; // armazenamento indisponível (modo privado, cookies bloqueados)
  }

  try {
    const guardado = store?.getItem(STORAGE_KEY);
    if (guardado) Object.assign(out, JSON.parse(guardado));
  } catch {
    // valor corrompido: segue-se com o que está por omissão
  }

  const param = new URLSearchParams(search).get('ff');
  if (param === 'reset') {
    try { store?.removeItem(STORAGE_KEY); } catch { /* ignorado */ }
    return {};
  }
  if (param) {
    for (const parte of param.split(',')) {
      const [nome, valor = '1'] = parte.split(':').map((s) => s.trim());
      if (!FLAG_NAMES.includes(nome)) continue;
      if (truthy(valor)) out[nome] = true;
      else if (falsy(valor)) out[nome] = false;
    }
    try { store?.setItem(STORAGE_KEY, JSON.stringify(out)); } catch { /* ignorado */ }
  }

  // Só nomes conhecidos: um valor antigo no armazenamento não pode ressuscitar um efeito
  // que já não existe, nem inventar um que nunca existiu.
  return Object.fromEntries(Object.entries(out).filter(([k]) => FLAG_NAMES.includes(k)));
}

/**
 * Estado final de cada interruptor.
 *
 * `reducedMotion` desliga os que são movimento — quem pediu menos animação no sistema não
 * tem de a desligar outra vez aqui. A elevação fica: é sombra e profundidade, não movimento,
 * e tirá-la só tornaria a página mais pobre sem acalmar nada.
 */
export function resolveFlags({ search = '', storage, reducedMotion = false } = {}) {
  const overrides = readFlagOverrides({ search, storage });
  const flags = { ...FLAG_DEFAULTS, ...overrides };
  if (reducedMotion) {
    flags.transicoes = false;
    flags.zoomImagem = false;
  }
  return flags;
}

/** Põe o estado no `<html>`, para o CSS poder reagir sem passar por nenhum componente. */
export function applyFlagsToDocument(flags, root) {
  const el = root ?? (typeof document !== 'undefined' ? document.documentElement : null);
  if (!el) return;
  for (const nome of FLAG_NAMES) {
    el.setAttribute(`data-ff-${nome.toLowerCase()}`, flags[nome] ? '1' : '0');
  }
}

/** `true` se o sistema do utilizador pede menos movimento. */
export function prefersReducedMotion() {
  try {
    return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/** Lê, resolve e aplica. Chamado uma vez no arranque. */
export function initFeatureFlags() {
  const flags = resolveFlags({
    search: typeof location !== 'undefined' ? location.search : '',
    reducedMotion: prefersReducedMotion(),
  });
  applyFlagsToDocument(flags);
  return flags;
}
