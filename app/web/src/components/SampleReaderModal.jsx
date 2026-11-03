import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, ChevronLeft, ChevronRight, BookOpen, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FloatingScrollTop } from '@/components/ui/FloatingScrollTop';

export default function SampleReaderModal({ pages = [], title = 'Amostra', open, onClose }) {
  const [readingMode, setReadingMode] = useState(false);
  const [pageIndex, setPageIndex] = useState(0);
  const gridScrollRef = useRef(null);

  const urls = pages.map((p) => (typeof p === 'string' ? p : p.url)).filter(Boolean);

  useEffect(() => {
    if (!open) {
      setReadingMode(false);
      setPageIndex(0);
    }
  }, [open]);

  const goPrev = useCallback(() => setPageIndex((i) => Math.max(0, i - 1)), []);
  const goNext = useCallback(() => setPageIndex((i) => Math.min(urls.length - 1, i + 1)), [urls.length]);

  useEffect(() => {
    if (!open || !readingMode) return;
    const onKey = (e) => {
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'ArrowRight') goNext();
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, readingMode, goPrev, goNext, onClose]);

  if (!open || !urls.length) return null;

  if (readingMode) {
    return (
      <div className="fixed inset-0 z-[60] bg-[#1a1a18] text-[#f5f0e8] flex flex-col">
        <header className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-widest text-white/50">Modo Leitura</p>
            <h2 className="font-serif text-lg truncate">{title}</h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-white/60 hidden sm:inline">
              Página {pageIndex + 1} de {urls.length}
            </span>
            <Button variant="ghost" size="sm" className="text-white/80 hover:text-white hover:bg-white/10" onClick={() => setReadingMode(false)}>
              <Minimize2 className="h-4 w-4 mr-1" /> Sair
            </Button>
            <Button variant="ghost" size="icon" className="text-white/80 hover:text-white" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>
        </header>

        <div className="flex-1 flex items-center justify-center p-4 md:p-8 overflow-hidden">
          <Button variant="ghost" size="icon" className="hidden md:flex text-white/70 hover:text-white shrink-0" onClick={goPrev} disabled={pageIndex === 0}>
            <ChevronLeft className="h-8 w-8" />
          </Button>
          <div className="flex-1 max-w-3xl h-full flex items-center justify-center">
            <img
              src={urls[pageIndex]}
              alt={`Página ${pageIndex + 1}`}
              className="max-h-[calc(100vh-8rem)] w-auto max-w-full object-contain shadow-2xl rounded-sm"
            />
          </div>
          <Button variant="ghost" size="icon" className="hidden md:flex text-white/70 hover:text-white shrink-0" onClick={goNext} disabled={pageIndex >= urls.length - 1}>
            <ChevronRight className="h-8 w-8" />
          </Button>
        </div>

        <footer className="flex items-center justify-between px-4 py-3 border-t border-white/10 shrink-0">
          <Button variant="outline" size="sm" className="border-white/20 text-white bg-transparent hover:bg-white/10" onClick={goPrev} disabled={pageIndex === 0}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
          </Button>
          <p className="text-sm text-white/50 md:hidden">{pageIndex + 1} / {urls.length}</p>
          <Button variant="outline" size="sm" className="border-white/20 text-white bg-transparent hover:bg-white/10" onClick={goNext} disabled={pageIndex >= urls.length - 1}>
            Seguinte <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </footer>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-background rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center p-4 border-b gap-3">
          <div>
            <h3 className="font-bold">Pré-visualização — {title}</h3>
            <p className="text-xs text-muted-foreground">{urls.length} página(s) de amostra</p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" className="bg-primary hover:bg-[#0ea5c9]/90 text-white" onClick={() => setReadingMode(true)}>
              <BookOpen className="h-4 w-4 mr-1.5" /> Modo Leitura
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose}><X className="h-5 w-5" /></Button>
          </div>
        </div>
        <div ref={gridScrollRef} className="overflow-y-auto relative p-4 grid sm:grid-cols-2 gap-4 max-h-[70vh]">
          {urls.map((url, i) => (
            <button
              key={i}
              type="button"
              className="rounded-xl overflow-hidden border hover:border-[#0ea5c9]/50 transition-all text-left"
              onClick={() => { setPageIndex(i); setReadingMode(true); }}
            >
              <img src={url} alt={`Página ${i + 1}`} className="w-full h-auto object-contain bg-muted/30" />
              <p className="text-xs text-center py-2 text-muted-foreground">Página {i + 1}</p>
            </button>
          ))}
          <FloatingScrollTop
            mode="container"
            containerRef={gridScrollRef}
            threshold={100}
            positionClass="absolute bottom-4 right-4 z-10"
          />
        </div>
      </div>
    </div>
  );
}
