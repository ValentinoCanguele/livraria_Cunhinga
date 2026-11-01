import React, { useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { createPainelApi } from '@/painel-vendas/adapter';
import { mountPainel } from '@/painel-vendas/painel.js';
import css from '@/painel-vendas/painel.css?inline';
import markup from '@/painel-vendas/painel.html?raw';
import logoUrl from '@/painel-vendas/logo-ministerio-publicacoes.png';

const FONTS_HREF = 'https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Lora:wght@600;700&display=swap';

// Dentro de um Shadow DOM as fontes só funcionam se forem carregadas no documento.
function loadFonts() {
  if (document.querySelector(`link[href="${FONTS_HREF}"]`)) return;
  document.head.appendChild(Object.assign(document.createElement('link'), { rel: 'stylesheet', href: FONTS_HREF }));
}

/**
 * Separador "Vendas Huambo" do Painel Admin: o painel do pacote painel-vendas-huambo com o design original.
 * Corre num Shadow DOM, para que o Tailwind do sistema não altere o painel e o CSS do painel não altere o sistema.
 * Ler exige papel de administrador ou gestor e gravar exige administrador (RLS em vendas_anos e painel_vendas_docs).
 */
const VendasHuamboTab = () => {
  const hostRef = useRef(null);
  const { user } = useAuth();
  const { theme } = useTheme();
  const userId = user?.id;
  const role = user?.role;

  useEffect(() => {
    loadFonts();
    const host = hostRef.current;
    const root = host.shadowRoot || host.attachShadow({ mode: 'open' });
    root.innerHTML = `<style>${css}</style>${markup.replace('__LOGO__', logoUrl)}`;
    const unmount = mountPainel(root, createPainelApi({ id: userId, role }));
    return () => {
      unmount();
      root.replaceChildren();
    };
  }, [userId, role]);

  // O painel segue o tema claro/escuro do sistema.
  return <div ref={hostRef} data-theme={theme === 'dark' ? 'dark' : 'light'} />;
};

export default VendasHuamboTab;
