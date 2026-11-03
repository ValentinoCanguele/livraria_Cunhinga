import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageCircle, X, Send, BookOpen, Sparkles, Loader2, Bell,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { useAuth } from '@/hooks/useAuth';
import { useChatPosition } from '@/hooks/useChatPosition';
import { fetchChatConfig, sendChatMessage } from '@/lib/assistantApi';
import ChatRichMessage from '@/components/assistant/ChatRichMessage';
import SupportCenter from '@/components/SupportCenter';

const DEFAULT_WELCOME = 'Olá! Sou o assistente da livraria. Posso ajudar com catálogo, envios, pagamentos e rastreio. Escolha uma sugestão abaixo ou escreva a sua pergunta.';

const STARTERS = [
  'Ver catálogo',
  'Envio grátis?',
  'Rastrear encomenda',
  'Falar com a equipa',
];

function toApiHistory(messages) {
  return messages
    .filter((m) => m.text)
    .map((m) => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: m.text,
    }));
}

export default function LivrariaAssistant() {
  const { pathname } = useLocation();
  const { isAuthed, isAdmin, hasPermission } = useAuth();
  const { settings } = useSiteSettings();
  const { fixedStyle } = useChatPosition();

  const canUseStaffInbox = isAdmin || hasPermission('manage_orders');
  const canUseSupport = isAuthed && (canUseStaffInbox || pathname !== '/login');
  const [open, setOpen] = useState(false);
  const [activePanel, setActivePanel] = useState('assistant');
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [chatConfig, setChatConfig] = useState({ enabled: true, ai: false, provider: 'faq' });
  const [messages, setMessages] = useState([{ role: 'bot', text: DEFAULT_WELCOME }]);
  const scrollRef = useRef(null);

  useEffect(() => {
    fetchChatConfig().then((cfg) => {
      setChatConfig(cfg);
      if (cfg.welcome) {
        setMessages([{ role: 'bot', text: cfg.welcome }]);
      }
    });
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, open, loading]);

  const send = useCallback(async (text) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const userMsg = { role: 'user', text: trimmed };
    setMessages((m) => [...m, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const history = toApiHistory(messages);
      const data = await sendChatMessage({
        message: trimmed,
        history,
        page: pathname,
      });
      setMessages((m) => [...m, {
        role: 'bot',
        text: data.reply || 'Desculpe, não consegui responder agora.',
        suggestions: data.suggestions,
        links: data.links,
        products: data.products,
        ai: data.ai,
      }]);
    } catch (err) {
      const wa = settings?.whatsapp ? ` (${settings.whatsapp})` : '';
      setMessages((m) => [...m, {
        role: 'bot',
        text: err.message || `Ocorreu um erro. Tente novamente ou contacte-nos${wa}.`,
        links: [
          { label: 'Contacto', path: '/contact' },
          { label: 'FAQ', path: '/faq' },
        ],
      }]);
    } finally {
      setLoading(false);
    }
  }, [loading, messages, pathname, settings?.whatsapp]);

  if (pathname === '/login' || (pathname.startsWith('/admin') && !canUseStaffInbox)) return null;
  if (chatConfig.enabled === false && !canUseSupport) return null;
  const showAssistant = chatConfig.enabled !== false && !pathname.startsWith('/admin');
  const showSupportTab = canUseSupport;
  const supportPanelLabel = canUseStaffInbox ? 'Atendimento' : 'Notificações';

  return (
    <div style={fixedStyle} className="flex flex-col items-start gap-2 pointer-events-none">
      <AnimatePresence>
        {!open && (
          <motion.button
            type="button"
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            onClick={() => setOpen(true)}
            className="pointer-events-auto flex items-center gap-2 pl-3.5 pr-4 py-3.5 bg-[#0c4a6e] hover:bg-[#0a3d5c] text-white rounded-full shadow-[0_4px_24px_rgba(12,74,110,0.5)] border border-white/10 focus:outline-none focus:ring-2 focus:ring-[#0ea5c9]"
            aria-label={showSupportTab ? 'Ajuda, notificações e atendimento' : 'Assistente da livraria'}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.92 }}
          >
            <span className="text-xs font-semibold hidden sm:inline">Ajuda</span>
            {showSupportTab ? (
              <span className="relative">
                <MessageCircle className="h-5 w-5 shrink-0" />
                <Bell className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-[#0c4a6e] text-white" />
              </span>
            ) : chatConfig.ai ? (
              <Sparkles className="h-5 w-5 shrink-0" />
            ) : (
              <MessageCircle className="h-5 w-5 shrink-0" />
            )}
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            className="pointer-events-auto w-[min(100vw-2rem,400px)] rounded-2xl border bg-card/95 backdrop-blur-md shadow-2xl overflow-hidden flex flex-col max-h-[min(72vh,560px)]"
          >
            <header className="flex items-center justify-between px-3 py-2.5 bg-[#0c4a6e] text-white">
              <div className="flex items-center gap-2 min-w-0">
                <BookOpen className="h-4 w-4 shrink-0" />
                <div className="min-w-0">
                  <span className="font-semibold text-sm block truncate">
                    {pathname.startsWith('/admin') ? 'Atendimento da Livraria' : 'Assistente Livraria'}
                  </span>
                  {chatConfig.ai && (
                    <span className="text-[10px] text-white/70 truncate block">
                      {chatConfig.provider === 'deepseek' ? 'DeepSeek' : 'Gemini'}
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-md hover:bg-white/10 shrink-0"
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            {(showAssistant && showSupportTab) && (
              <nav className="flex gap-1 border-b bg-card px-2 pt-2" aria-label="Assistente e notificações">
                <Button
                  type="button"
                  size="sm"
                  variant={activePanel === 'assistant' ? 'default' : 'ghost'}
                  onClick={() => setActivePanel('assistant')}
                >
                  <Sparkles className="mr-1.5 h-3.5 w-3.5" /> Assistente
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={activePanel === 'support' ? 'default' : 'ghost'}
                  onClick={() => setActivePanel('support')}
                >
                  <MessageCircle className="mr-1.5 h-3.5 w-3.5" /> {supportPanelLabel}
                </Button>
              </nav>
            )}

            {showSupportTab && (!showAssistant || activePanel === 'support') ? (
              <div className="min-h-0 flex-1 overflow-y-auto bg-muted/15 p-3">
                <SupportCenter compact />
              </div>
            ) : showAssistant ? (
              <>
                <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3 bg-muted/15 min-h-[200px]">
                  {messages.map((msg, i) => (
                    <ChatRichMessage
                      key={i}
                      message={msg}
                      onSuggestionClick={send}
                    />
                  ))}
                  {loading && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground pl-9">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      A pensar…
                    </div>
                  )}
                </div>

                <div className="p-2 border-t bg-card flex flex-wrap gap-1">
                  {STARTERS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      disabled={loading}
                      onClick={() => send(s)}
                      className="text-[10px] px-2 py-1 rounded-full border hover:bg-muted transition-colors disabled:opacity-50"
                    >
                      {s}
                    </button>
                  ))}
                </div>

                <form
                  className="flex gap-2 p-3 border-t bg-card"
                  onSubmit={(e) => { e.preventDefault(); send(input); }}
                >
                  <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Pergunte sobre livros, envios, pagamentos…"
                    className="h-9 text-sm"
                    disabled={loading}
                    maxLength={800}
                  />
                  <Button type="submit" size="icon" className="shrink-0 h-9 w-9 btn-primary" disabled={loading || !input.trim()}>
                    <Send className="h-4 w-4" />
                  </Button>
                </form>

                <p className="text-[10px] text-center text-muted-foreground pb-2 px-2">
                  <Link to="/faq" className="text-primary hover:underline">FAQ</Link>
                  {' · '}
                  <Link to="/contact" className="text-primary hover:underline">Contacto</Link>
                  {' · '}
                  <Link to="/shop" className="text-primary hover:underline">Catálogo</Link>
                </p>
              </>
            ) : (
              <div className="p-6 text-center text-sm text-muted-foreground">
                O assistente está temporariamente indisponível.
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
