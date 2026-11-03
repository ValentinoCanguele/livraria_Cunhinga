import React from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, BookOpen, Sparkles } from 'lucide-react';

function formatText(text) {
  if (!text) return null;
  const parts = String(text).split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

export default function ChatRichMessage({ message, onSuggestionClick }) {
  const isUser = message.role === 'user';

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[88%] rounded-2xl rounded-br-md px-3 py-2 text-sm bg-primary text-white shadow-sm">
          {message.text}
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start gap-2">
      <div className="h-7 w-7 rounded-full bg-[#0c4a6e]/10 flex items-center justify-center shrink-0 mt-0.5">
        <Sparkles className="h-3.5 w-3.5 text-[#0c4a6e]" />
      </div>
      <div className="max-w-[92%] space-y-2">
        <div className="rounded-2xl rounded-bl-md px-3 py-2.5 text-sm bg-card border shadow-sm leading-relaxed">
          {message.text && <p>{formatText(message.text)}</p>}
          {message.ai && (
            <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1">
              <Sparkles className="h-3 w-3" /> Resposta inteligente
            </p>
          )}
        </div>

        {message.products?.length > 0 && (
          <div className="space-y-2">
            {message.products.map((p) => (
              <Link
                key={p.id}
                to={`/product/${p.id}`}
                className="flex gap-2 p-2 rounded-xl border bg-background hover:border-[#0ea5c9]/50 transition-colors"
              >
                {p.cover ? (
                  <img src={p.cover} alt="" className="h-14 w-10 object-cover rounded-md shrink-0 bg-muted" />
                ) : (
                  <div className="h-14 w-10 rounded-md bg-muted flex items-center justify-center shrink-0">
                    <BookOpen className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold line-clamp-2">{p.title}</p>
                  <p className="text-[10px] text-muted-foreground line-clamp-1">{p.author}</p>
                  {p.price && <p className="text-xs text-primary font-bold mt-0.5">{p.price}</p>}
                </div>
              </Link>
            ))}
          </div>
        )}

        {message.links?.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {message.links.map((link, i) => {
              const internal = link.path?.startsWith('/');
              const label = link.label || link.path;
              const cls = 'inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full bg-[#0ea5c9]/10 text-[#0c4a6e] hover:bg-[#0ea5c9]/20 border border-[#0ea5c9]/20 transition-colors';
              return internal ? (
                <Link key={i} to={link.path} className={cls}>
                  {label}
                </Link>
              ) : (
                <a key={i} href={link.path || link.url} target="_blank" rel="noreferrer" className={cls}>
                  {label} <ExternalLink className="h-3 w-3" />
                </a>
              );
            })}
          </div>
        )}

        {message.suggestions?.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {message.suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onSuggestionClick?.(s)}
                className="text-[10px] px-2 py-1 rounded-full border border-dashed hover:bg-muted transition-colors text-left"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
