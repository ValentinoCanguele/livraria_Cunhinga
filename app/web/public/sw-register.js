/**
 * Registo do service worker.
 *
 * Em ficheiro e não dentro do HTML para a política de segurança de conteúdo poder proibir
 * scripts embutidos por completo. Com o script no HTML, a única alternativa era autorizar
 * `unsafe-inline` — que abre a porta a qualquer script injectado — ou fixar o hash deste
 * bloco, que parte em silêncio na primeira vez que alguém lhe mexer num espaço.
 */
if ('serviceWorker' in navigator) {
	const isLocalDev = ['localhost', '127.0.0.1'].includes(location.hostname);
	if (isLocalDev) {
		// Em desenvolvimento, limpar SW/cache antigo que causa tela branca com Vite
		navigator.serviceWorker.getRegistrations().then((regs) => {
			regs.forEach((r) => r.unregister());
		});
		caches.keys().then((keys) => {
			keys.forEach((k) => caches.delete(k));
		});
	} else {
		window.addEventListener('load', () => {
			navigator.serviceWorker.register('/sw.js').catch(() => {});
		});
	}
}
