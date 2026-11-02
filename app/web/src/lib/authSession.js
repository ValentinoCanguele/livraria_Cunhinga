/**
 * Arranque da sessão e destinos de redireccionamento.
 *
 * O problema que isto resolve: o `authStore` do `dataClient` só conhece a sessão depois de o
 * supabase-js terminar a inicialização (ler o armazenamento, renovar o token ou consumir o
 * `#access_token=…` que a Google devolve). Até lá `isValid` é `false`, e as páginas protegidas
 * mandavam o utilizador para `/login` mesmo com sessão válida — era o que acontecia sempre a
 * seguir ao login com a Google, que volta com a sessão no endereço e não no armazenamento.
 *
 * `createReadyGate()` dá um sinal único de "a sessão já é conhecida" (com ou sem utilizador),
 * para as guardas esperarem em vez de decidirem com informação incompleta.
 */

/** Tempo máximo à espera do arranque da sessão: sem rede, mais vale mostrar o ecrã de entrada. */
export const AUTH_READY_TIMEOUT_MS = 8000;

/**
 * Sinal de uma só passagem. `resolve()` pode ser chamado as vezes que for preciso: só a
 * primeira conta, por isso serve tanto para o primeiro evento de autenticação como para o
 * temporizador de recurso, sem ciclos nem corridas entre os dois.
 */
export function createReadyGate({ timeoutMs = AUTH_READY_TIMEOUT_MS, setTimer = setTimeout } = {}) {
  let done = false;
  const listeners = new Set();

  const gate = {
    get ready() {
      return done;
    },
    resolve() {
      if (done) return false;
      done = true;
      listeners.forEach((cb) => {
        try {
          cb();
        } catch {
          // um ouvinte partido não pode impedir os restantes
        }
      });
      listeners.clear();
      return true;
    },
    /** Avisa quando a sessão passa a ser conhecida; devolve a função que cancela a subscrição. */
    onReady(callback) {
      if (done) {
        callback();
        return () => {};
      }
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
  };

  if (timeoutMs > 0) setTimer(() => gate.resolve(), timeoutMs);
  return gate;
}

// Caracteres de controlo que alguns navegadores ignoram dentro de um endereço: permitiriam
// esconder `//evil.com` no meio de um caminho que parece interno.
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

/**
 * Valida um destino interno antes de lá redireccionar.
 *
 * Aceita só caminhos do próprio site (`/perfil`, `/shop?cat=1`). Recusa endereços absolutos
 * (`https://…`), caminhos sem barra inicial, e `//evil.com` ou `/\evil.com`, que os
 * navegadores tratam como sítio externo. Sem isto, `?redirect=` seria uma porta aberta para
 * levar quem acaba de entrar para fora da loja.
 */
export function safeInternalPath(value, fallback = '/') {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return fallback;
  if (!raw.startsWith('/')) return fallback;
  // `//host` e `/\host` saem do site; `/` sozinho é a página inicial e é válido.
  if (raw.length > 1 && (raw[1] === '/' || raw[1] === '\\')) return fallback;
  if (CONTROL_CHARS.test(raw)) return fallback;
  return raw;
}

/** Caminho actual (com busca e âncora) para voltar ao mesmo sítio depois de entrar. */
export function currentPathWithQuery(location) {
  if (!location) return '/';
  return safeInternalPath(`${location.pathname || '/'}${location.search || ''}${location.hash || ''}`);
}

/**
 * Decide o que fazer numa página protegida.
 *
 * Existe como função separada porque a regra é sempre a mesma (`/admin` e `/profile`) e porque
 * a ordem importa: `wait` tem de vir antes de tudo. Decidir sem esperar era o que mandava para
 * `/login` quem tinha sessão válida mas ainda não lida.
 *
 * - `wait`      — o arranque ainda não sabe se há sessão; não decidir nada
 * - `login`     — não há sessão; pedir autenticação
 * - `forbidden` — há sessão, mas sem a permissão necessária
 * - `allow`     — mostrar a página
 */
export function sessionDecision({ ready, isAuthed, allowed = true }) {
  if (!ready) return 'wait';
  if (!isAuthed) return 'login';
  if (!allowed) return 'forbidden';
  return 'allow';
}

/** Contas a que já se pediu o email de boas-vindas neste navegador. */
const WELCOME_KEY = 'livraria_welcome_sent';

/**
 * Pede o email de boas-vindas uma vez por conta.
 *
 * O Supabase Auth cria a conta sem passar pela nossa API, por isso não há gancho no servidor
 * para o registo: é o cliente que pede, no primeiro acesso com sessão. A marca local evita
 * pedidos repetidos a cada carregamento, e o servidor tem a palavra final — a chave de
 * idempotência dele garante um só envio mesmo que esta marca se perca (outro navegador,
 * armazenamento limpo).
 */
export async function requestWelcomeEmail(pb, userId) {
  if (!pb || !userId) return false;
  let seen = [];
  try {
    seen = JSON.parse(localStorage.getItem(WELCOME_KEY) || '[]');
    if (seen.includes(userId)) return false;
  } catch {
    seen = [];
  }
  try {
    await pb.send('/account/welcome', { method: 'POST', body: {} });
  } catch {
    // Falhar aqui não pode estragar a entrada na loja: o email é um extra, e o pedido
    // repete-se no acesso seguinte porque a marca só é guardada em caso de sucesso.
    return false;
  }
  try {
    localStorage.setItem(WELCOME_KEY, JSON.stringify([...seen, userId].slice(-20)));
  } catch {
    // armazenamento indisponível
  }
  return true;
}
