import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, Bot, Sparkles, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const QUICK_ACTIONS = [
  'Recomendar Livros 📚',
  'Como comprar? 💳',
  'Custo de Envio? 🚚',
  'Contacto WhatsApp 📱'
];

export default function ChatBot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: 'model',
      text: 'Olá! Sou o Assistente Inteligente da **Livraria Adventista**. Como posso enriquecer a sua leitura hoje? Posso sugerir livros do nosso catálogo, explicar as formas de pagamento ou dar informações sobre entregas em Angola!'
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [isOpen, messages, loading]);

  const handleSend = async (textToSend) => {
    const text = textToSend || input.trim();
    if (!text) return;

    if (!textToSend) setInput('');

    // Append user message
    const userMessage = { role: 'user', text };
    setMessages((prev) => [...prev, userMessage]);
    setLoading(true);

    try {
      // Prepare history for Gemini
      // Format history into role + text parts
      const history = messages.slice(1).map((m) => ({
        role: m.role,
        text: m.text
      }));

      const res = await fetch('/api/app/chatbot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history })
      });

      const data = await res.json();
      
      setMessages((prev) => [
        ...prev,
        { role: 'model', text: data.response || 'Desculpe, tive um problema ao receber a resposta.' }
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'model',
          text: 'Não consegui ligar-me ao servidor. Verifique a sua ligação à internet ou tente novamente mais tarde.'
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Simple formatter for bold text and list items
  const formatMessage = (txt) => {
    if (!txt) return '';
    // Format bold **text**
    let html = txt.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // Format bullet points starting with * or -
    html = html.replace(/^\s*[-*]\s+(.*?)$/gm, '• $1');
    // Format line breaks
    return html.split('\n').map((line, idx) => (
      <p key={idx} className="mb-1 last:mb-0" dangerouslySetInnerHTML={{ __html: line }} />
    ));
  };

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col items-end" id="app-chatbot-container">
      {/* Chat Window */}
      {isOpen && (
        <div 
          className="bg-background border border-border shadow-2xl rounded-2xl w-[350px] sm:w-[380px] h-[500px] flex flex-col mb-4 overflow-hidden animate-in fade-in slide-in-from-bottom-5 duration-300"
          id="chatbot-window"
        >
          {/* Header */}
          <div className="bg-primary text-primary-foreground p-4 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-2.5">
              <div className="bg-white/10 p-2 rounded-lg">
                <Bot className="h-5 w-5 text-white animate-pulse" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-white">Assistência Inteligente</h4>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                  <p className="text-[10px] text-white/80 font-medium">Online • IA Ativa</p>
                </div>
              </div>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setIsOpen(false)}
              className="text-white hover:bg-white/10 rounded-full h-8 w-8"
              aria-label="Fechar assistente"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Messages Container */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-muted-foreground/10 bg-slate-50/50">
            {messages.map((m, idx) => (
              <div 
                key={idx} 
                className={`flex gap-2.5 max-w-[85%] ${m.role === 'user' ? 'ml-auto flex-row-reverse' : ''}`}
              >
                {m.role === 'model' && (
                  <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 border border-primary/10 mt-0.5">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                )}
                <div 
                  className={`rounded-2xl p-3 text-sm shadow-sm leading-relaxed ${
                    m.role === 'user' 
                      ? 'bg-primary text-primary-foreground rounded-tr-none' 
                      : 'bg-card border border-border text-foreground rounded-tl-none'
                  }`}
                >
                  {formatMessage(m.text)}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex gap-2.5 max-w-[85%]">
                <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="h-4 w-4 text-primary animate-bounce" />
                </div>
                <div className="bg-card border border-border rounded-2xl rounded-tl-none p-3 shadow-sm flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Actions */}
          {messages.length === 1 && !loading && (
            <div className="px-4 py-2 bg-slate-50 border-t border-border/40 flex flex-wrap gap-1.5">
              {QUICK_ACTIONS.map((action, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(action)}
                  className="text-xs bg-card hover:bg-slate-100 border border-border text-muted-foreground hover:text-primary font-medium px-2.5 py-1 rounded-full transition-all active:scale-95 shadow-xs shrink-0 cursor-pointer"
                >
                  {action}
                </button>
              ))}
            </div>
          )}

          {/* Footer Input */}
          <form 
            onSubmit={(e) => { e.preventDefault(); handleSend(); }} 
            className="p-3 border-t border-border bg-background flex gap-2 items-center"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Pergunte sobre livros, envios..."
              disabled={loading}
              className="flex-1 rounded-full bg-muted/40 border-border focus-visible:ring-primary focus-visible:ring-offset-0 placeholder:text-muted-foreground/60 text-sm"
              aria-label="Mensagem do chat"
            />
            <Button 
              type="submit" 
              size="icon" 
              disabled={loading || !input.trim()} 
              className="rounded-full shrink-0 h-9 w-9 btn-primary"
              aria-label="Enviar mensagem"
            >
              <Send className="h-4 w-4 text-white" />
            </Button>
          </form>
        </div>
      )}

      {/* Floating Action Button and Welcome Badge */}
      <div className="flex items-center gap-3">
        {!isOpen && (
          <motion.div
            initial={{ opacity: 0, x: 20, scale: 0.8 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            transition={{ delay: 1, duration: 0.5 }}
            className="hidden sm:flex items-center gap-1.5 bg-[#1b365d] text-white text-xs font-semibold px-3 py-2 rounded-xl shadow-xl border border-white/10 select-none"
            style={{ boxShadow: '0 4px 20px rgba(27, 54, 93, 0.4)' }}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Assistente IA 🌟</span>
          </motion.div>
        )}

        <Button
          onClick={() => setIsOpen(!isOpen)}
          className="rounded-full h-14 w-14 shadow-2xl p-0 hover:scale-110 active:scale-95 transition-all duration-300 flex items-center justify-center text-white border border-white/10"
          style={{
            boxShadow: '0 8px 30px rgba(27, 54, 93, 0.5), inset 0 2px 4px rgba(255, 255, 255, 0.2)',
            backgroundColor: '#1b365d'
          }}
          aria-expanded={isOpen}
          aria-controls={isOpen ? "chatbot-window" : undefined}
          aria-label="Abrir assistente inteligente"
          id="chatbot-floating-button"
        >
          {isOpen ? (
            <X className="h-6 w-6 text-white" />
          ) : (
            <div className="relative flex items-center justify-center">
              <Sparkles className="h-6 w-6 text-cyan-300 absolute -top-1 -right-1 animate-pulse" />
              <MessageSquare className="h-6 w-6 text-white" />
              <span className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full bg-emerald-400 border-2 border-[#1b365d] animate-ping" />
            </div>
          )}
        </Button>
      </div>
    </div>
  );
}
