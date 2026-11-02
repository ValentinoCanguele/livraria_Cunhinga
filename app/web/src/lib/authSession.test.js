import { describe, expect, it, vi } from 'vitest';
import { createReadyGate, currentPathWithQuery, safeInternalPath, sessionDecision } from '@/lib/authSession';

describe('createReadyGate', () => {
  const noTimer = () => {};

  it('arranca por resolver e passa a resolvido numa só passagem', () => {
    const gate = createReadyGate({ setTimer: noTimer });
    expect(gate.ready).toBe(false);
    expect(gate.resolve()).toBe(true);
    expect(gate.ready).toBe(true);
    // A segunda chamada não conta: é o que permite ter o evento de autenticação e o
    // temporizador de recurso a competir sem avisar duas vezes.
    expect(gate.resolve()).toBe(false);
  });

  it('avisa os ouvintes uma única vez', () => {
    const gate = createReadyGate({ setTimer: noTimer });
    const spy = vi.fn();
    gate.onReady(spy);
    gate.resolve();
    gate.resolve();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('chama de imediato quem subscreve depois de resolvido', () => {
    const gate = createReadyGate({ setTimer: noTimer });
    gate.resolve();
    const spy = vi.fn();
    gate.onReady(spy);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('não avisa quem cancelou a subscrição', () => {
    const gate = createReadyGate({ setTimer: noTimer });
    const spy = vi.fn();
    gate.onReady(spy)();
    gate.resolve();
    expect(spy).not.toHaveBeenCalled();
  });

  it('um ouvinte que rebenta não impede os outros', () => {
    const gate = createReadyGate({ setTimer: noTimer });
    const spy = vi.fn();
    gate.onReady(() => { throw new Error('partido'); });
    gate.onReady(spy);
    expect(() => gate.resolve()).not.toThrow();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('o temporizador de recurso resolve quando a autenticação nunca responde', () => {
    let fn = null;
    const gate = createReadyGate({ timeoutMs: 8000, setTimer: (cb) => { fn = cb; } });
    expect(gate.ready).toBe(false);
    fn();
    // Sem isto, uma falha de rede no arranque deixava as páginas protegidas à espera
    // para sempre em vez de mostrarem o ecrã de entrada.
    expect(gate.ready).toBe(true);
  });
});

describe('safeInternalPath', () => {
  it('aceita caminhos internos', () => {
    expect(safeInternalPath('/profile')).toBe('/profile');
    expect(safeInternalPath('/shop?cat=biblias&page=2')).toBe('/shop?cat=biblias&page=2');
    expect(safeInternalPath('/reset-password#token=abc')).toBe('/reset-password#token=abc');
    expect(safeInternalPath('/')).toBe('/');
  });

  it('recusa destinos fora da loja', () => {
    // `//evil.com` e `/\evil.com` são lidos pelo navegador como outro sítio.
    expect(safeInternalPath('//evil.com')).toBe('/');
    expect(safeInternalPath('/\\evil.com')).toBe('/');
    expect(safeInternalPath('https://evil.com')).toBe('/');
    expect(safeInternalPath('http://evil.com')).toBe('/');
    expect(safeInternalPath('javascript:alert(1)')).toBe('/');
    expect(safeInternalPath('profile')).toBe('/');
  });

  it('recusa caracteres de controlo usados para esconder o destino real', () => {
    expect(safeInternalPath('/\n//evil.com')).toBe('/');
    expect(safeInternalPath('/\t/evil.com')).toBe('/');
    expect(safeInternalPath('/\u0000/evil.com')).toBe('/');
    expect(safeInternalPath('/\r//evil.com')).toBe('/');
  });

  it('devolve o valor de recurso indicado quando não há destino', () => {
    expect(safeInternalPath('', '/profile')).toBe('/profile');
    expect(safeInternalPath(null, '/profile')).toBe('/profile');
    expect(safeInternalPath(undefined, '')).toBe('');
    expect(safeInternalPath(42, '/profile')).toBe('/profile');
  });
});

describe('currentPathWithQuery', () => {
  it('junta caminho, busca e âncora', () => {
    expect(currentPathWithQuery({ pathname: '/shop', search: '?page=2', hash: '#top' }))
      .toBe('/shop?page=2#top');
  });

  it('funciona sem busca nem âncora', () => {
    expect(currentPathWithQuery({ pathname: '/profile' })).toBe('/profile');
  });

  it('devolve a raiz sem localização', () => {
    expect(currentPathWithQuery(null)).toBe('/');
  });
});

describe('sessionDecision', () => {
  it('espera enquanto o arranque não souber se há sessão', () => {
    // Este é o caso que estava em falta: com `ready` falso, `isAuthed` ainda é falso por
    // omissão e não por ausência de sessão. Quem decidisse aqui mandava para `/login` quem
    // tinha sessão válida — acontecia em todas as voltas do login com a Google.
    expect(sessionDecision({ ready: false, isAuthed: false })).toBe('wait');
    expect(sessionDecision({ ready: false, isAuthed: true })).toBe('wait');
    expect(sessionDecision({ ready: false, isAuthed: false, allowed: false })).toBe('wait');
  });

  it('pede autenticação quando não há sessão', () => {
    expect(sessionDecision({ ready: true, isAuthed: false })).toBe('login');
    // Sem sessão, a falta de permissão não é o motivo: o utilizador tem de entrar primeiro.
    expect(sessionDecision({ ready: true, isAuthed: false, allowed: false })).toBe('login');
  });

  it('distingue falta de sessão de falta de permissão', () => {
    expect(sessionDecision({ ready: true, isAuthed: true, allowed: false })).toBe('forbidden');
  });

  it('deixa passar quem tem sessão e permissão', () => {
    expect(sessionDecision({ ready: true, isAuthed: true, allowed: true })).toBe('allow');
    // Sem `allowed`, a página só exige sessão (é o caso de `/profile`).
    expect(sessionDecision({ ready: true, isAuthed: true })).toBe('allow');
  });
});
