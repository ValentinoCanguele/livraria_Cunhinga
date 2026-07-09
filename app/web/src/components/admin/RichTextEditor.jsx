import React, { useRef, useEffect } from 'react';
import { Bold, Italic, List, ListOrdered, Link2, Heading2, Quote } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const TOOLS = [
  { cmd: 'bold', icon: Bold, label: 'Negrito' },
  { cmd: 'italic', icon: Italic, label: 'Itálico' },
  { cmd: 'formatBlock', icon: Heading2, label: 'Título', value: 'h3' },
  { cmd: 'insertUnorderedList', icon: List, label: 'Lista' },
  { cmd: 'insertOrderedList', icon: ListOrdered, label: 'Numerada' },
  { cmd: 'formatBlock', icon: Quote, label: 'Citação', value: 'blockquote' },
];

export default function RichTextEditor({ value = '', onChange, placeholder, className }) {
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== (value || '')) {
      ref.current.innerHTML = value || '';
    }
  }, [value]);

  const exec = (cmd, val = null) => {
    document.execCommand(cmd, false, val);
    ref.current?.focus();
    onChange?.(ref.current?.innerHTML || '');
  };

  const addLink = () => {
    const url = window.prompt('URL do link:', 'https://');
    if (url) exec('createLink', url);
  };

  return (
    <div className={cn('border rounded-xl overflow-hidden bg-background', className)}>
      <div className="flex flex-wrap gap-0.5 p-2 border-b bg-muted/30">
        {TOOLS.map((t) => (
          <Button
            key={t.label}
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            title={t.label}
            onClick={() => exec(t.cmd, t.value || undefined)}
          >
            <t.icon className="h-4 w-4" />
          </Button>
        ))}
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" title="Link" onClick={addLink}>
          <Link2 className="h-4 w-4" />
        </Button>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        className="min-h-[120px] max-h-[280px] overflow-y-auto p-4 text-sm prose prose-sm max-w-none focus:outline-none"
        data-placeholder={placeholder}
        onInput={() => onChange?.(ref.current?.innerHTML || '')}
        onBlur={() => onChange?.(ref.current?.innerHTML || '')}
      />
      <style>{`
        [contenteditable]:empty:before {
          content: attr(data-placeholder);
          color: hsl(var(--muted-foreground));
          pointer-events: none;
        }
      `}</style>
    </div>
  );
}

export const SLIDE_TEMPLATES = [
  { id: 'classic', label: 'Clássico', description: 'Texto à esquerda, imagem de fundo' },
  { id: 'book_promo', label: 'Promoção de Livro', description: 'Capa do livro + preço em destaque' },
  { id: 'split', label: 'Dividido', description: 'Imagem e texto lado a lado' },
  { id: 'minimal', label: 'Minimalista', description: 'Texto centrado, overlay suave' },
];
