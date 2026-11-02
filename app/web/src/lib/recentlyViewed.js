/**
 * Livros vistos há pouco, guardados no navegador de quem visita.
 *
 * Fica tudo no `localStorage` e nada vai para o servidor: é um atalho para voltar a um livro
 * que se esteve a ver, não um registo de hábitos de leitura. Quem limpar os dados do
 * navegador apaga-o, e quem usar outro equipamento não o leva consigo — que é o
 * comportamento certo para uma coisa destas.
 *
 * Guarda-se o mínimo para desenhar um cartão (identificação, título, capa, preço já
 * formatado). Não se guarda o objecto do produto inteiro: o armazenamento do navegador é
 * pequeno e partilhado, e os dados ficariam velhos — um preço que mudou entretanto
 * apareceria errado para sempre.
 */

const STORAGE_KEY = 'livraria_vistos';

/** Quantos se guardam. O suficiente para uma fila, sem encher o armazenamento. */
export const MAX_RECENT = 12;

/** Reduz um produto ao que o cartão precisa. `null` se não houver identificação. */
export function toRecentEntry(product) {
  if (!product || !product.id) return null;
  const variant = product.variants?.[0];
  return {
    id: String(product.id),
    title: String(product.title || ''),
    image: String(product.image || ''),
    price: String(variant?.sale_price_formatted || variant?.price_formatted || ''),
    author: String(product.author || ''),
    at: Date.now(),
  };
}

function ler(storage) {
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    const lista = raw ? JSON.parse(raw) : [];
    // Um valor estranho no armazenamento não pode derrubar a página que o lê.
    return Array.isArray(lista) ? lista.filter((e) => e && typeof e.id === 'string') : [];
  } catch {
    return [];
  }
}

function escrever(storage, lista) {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(lista));
    return true;
  } catch {
    // Armazenamento cheio ou bloqueado: perde-se o histórico, não a navegação.
    return false;
  }
}

/** Os livros vistos, do mais recente para o mais antigo. */
export function getRecentlyViewed({ storage } = {}) {
  const store = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
  return ler(store);
}

/**
 * Regista uma visita e devolve a lista actualizada.
 *
 * Rever um livro põe-no à frente em vez de o repetir: uma lista com o mesmo título cinco
 * vezes não é um histórico, é ruído.
 */
export function addRecentlyViewed(product, { storage } = {}) {
  const store = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
  const entrada = toRecentEntry(product);
  if (!entrada) return ler(store);
  const lista = [entrada, ...ler(store).filter((e) => e.id !== entrada.id)].slice(0, MAX_RECENT);
  escrever(store, lista);
  return lista;
}

/** Esquece tudo. */
export function clearRecentlyViewed({ storage } = {}) {
  const store = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
  try {
    store?.removeItem(STORAGE_KEY);
  } catch {
    // nada a fazer
  }
  return [];
}

/**
 * O que mostrar numa página: o histórico sem o livro que se está a ver.
 *
 * Sem isto, a ficha de um livro mostrava-o a si própria na fila dos vistos há pouco — o que
 * não ajuda ninguém a chegar a lado nenhum.
 */
export function recentExcluding(lista, idActual) {
  const actual = idActual == null ? '' : String(idActual);
  return (lista || []).filter((e) => e.id !== actual);
}
