import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, X, Send, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FAQ_QUICK_REPLIES } from '@/lib/faqData';
import { useSiteSettings } from '@/hooks/useSiteSettings';

function findFaqAnswer(text) {
  const q = text.trim().toLowerCase();
  if (!q) return null;
  const hit = FAQ_QUICK_REPLIES.find((f) =>
    f.question.toLowerCase().includes(q) || q.includes(f.question.toLowerCase().slice(0, 12)),
  );
  if (hit) return hit.answer;
  if (q.includes('envio') || q.includes('entrega')) return FAQ_QUICK_REPLIES.find((f) => f.question.includes('entrega'))?.answer;
  if (q.includes('grátis') || q.includes('gratis')) return FAQ_QUICK_REPLIES.find((f) => f.question.includes('grátis'))?.answer;
  if (q.includes('pagamento') || q.includes('pagar')) return FAQ_QUICK_REPLIES.find((f) => f.question.toLowerCase().includes('pagamento'))?.answer;
  if (q.includes('devol')) return FAQ_QUICK_REPLIES.find((f) => f.question.includes('devolução'))?.answer;
  if (q.includes('rastrear') || q.includes('encomenda')) return 'Use a página Rastrear Encomenda com o número e email da compra.';
  return null;
}

const STARTERS = [
  'Envio grátis?',
  'Tempo de entrega',
  'Formas de pagamento',
  'Rastrear encomenda',
];

export default function LivrariaAssistant() {
  const { pathname } = useLocation();
  const { settings } = useSiteSettings();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([
    { role: 'bot', text: 'Olá! Sou o assistente da livraria. Posso ajudar com envios, pagamentos e encomendas. Escolha uma pergunta rápida ou escreva a sua dúvida.' },
  ]);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, open]);

  if (pathname === '/login' || pathname.startsWith('/admin')) return null;

  const send = (text) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setMessages((m) => [...m, { role: 'user', text: trimmed }]);
    setInput('');
    const answer = findFaqAnswer(trimmed);
    setTimeout(() => {
      setMessages((m) => [...m, {
        role: 'bot',
        text: answer || `Não encontrei uma resposta exacta. A nossa equipa pode ajudar em Contactos ou por WhatsApp${settings.whatsapp ? ` (${settings.whatsapp})` : ''}.`,
      }]);
    }, 400);
  };

  return (
    <>
      <AnimatePresence>
        {!open && (
          <motion.button
            type="button"
            initial={{ opacity: 0, scale: 0.8, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 10 }}
            onClick={() => setOpen(true)}
            className="fixed bottom-6 left-6 z-40 flex items-center gap-2 pl-4 pr-3.5 py-3.5 bg-[#0c4a6e] hover:bg-[#0a3d5c] text-white rounded-full shadow-[0_4px_20px_rgba(12,74,110,0.45)] border border-white/10 focus:outline-none focus:ring-2 focus:ring-[#0ea5c9] group"
            aria-label="Assistente da livraria"
            whileHover={{ y: -3 }}
            whileTap={{ scale: 0.9 }}
          >
            <span className="text-xs font-semibold hidden sm:inline max-w-0 overflow-hidden group-hover:max-w-[100px] transition-all duration-300 whitespace-nowrap">
              Ajuda
            </span>
            <MessageCircle className="h-5 w-5 shrink-0" />
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-6 left-6 z-40 w-[min(100vw-2rem,380px)] rounded-2xl border bg-card shadow-2xl overflow-hidden flex flex-col max-h-[min(70vh,520px)]"
          >
            <header className="flex items-center justify-between px-4 py-3 bg-[#0c4a6e] text-white">
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4" />
                <span className="font-semibold text-sm">Assistente Livraria</span>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="p-1 rounded-md hover:bg-white/10" aria-label="Fechar">
                <X className="h-4 w-4" />
              </button>
            </header>

            <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2 bg-muted/20">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${msg.role === 'user' ? 'bg-[#0ea5c9] text-white rounded-br-md' : 'bg-card border rounded-bl-md'}`}>
                    {msg.text}
                  </div>
                </div>
              ))}
            </div>

            <div className="p-2 border-t bg-card flex flex-wrap gap-1">
              {STARTERS.map((s) => (
                <button key={s} type="button" onClick={() => send(s)} className="text-[10px] px-2 py-1 rounded-full border hover:bg-muted transition-colors">
                  {s}
                </button>
              ))}
            </div>

            <form
              className="flex gap-2 p-3 border-t"
              onSubmit={(e) => { e.preventDefault(); send(input); }}
            >
              <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="A sua pergunta..." className="h-9 text-sm" />
              <Button type="submit" size="icon" className="shrink-0 h-9 w-9 btn-primary">
                <Send className="h-4 w-4" />
              </Button>
            </form>

            <p className="text-[10px] text-center text-muted-foreground pb-2">
              <Link to="/faq" className="text-[#0ea5c9] hover:underline">FAQ completo</Link>
              {' · '}
              <Link to="/contact" className="text-[#0ea5c9] hover:underline">Contactar</Link>
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
