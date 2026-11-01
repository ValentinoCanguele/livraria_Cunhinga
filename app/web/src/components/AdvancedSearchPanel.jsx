import React, { useState, useEffect } from 'react';
import { Search, SlidersHorizontal, X, BookOpen, Hash, Sparkles, Filter, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { BOOK_GENRES, BOOK_LANGUAGES } from '@/lib/bookConstants';

export default function AdvancedSearchPanel({
  activeFilters,
  updateFilter,
  onSearch,
  className,
  variant = 'default',
  bookCollections = [],
  publishers = [],
  resultCount,
  filterCount = 0,
  quickGenres = [],
}) {
  const [expanded, setExpanded] = useState(false);
  const [local, setLocal] = useState({
    search: activeFilters.search || '',
    author: activeFilters.author || '',
    isbn: activeFilters.isbn || '',
    publisher: activeFilters.publisher || '',
    language: activeFilters.language || '',
    collection: activeFilters.collection || '',
    yearFrom: activeFilters.yearFrom || '',
    yearTo: activeFilters.yearTo || '',
    featuredOnly: activeFilters.featuredOnly || false,
    inStockOnly: activeFilters.inStockOnly || false,
  });

  useEffect(() => {
    setLocal({
      search: activeFilters.search || '',
      author: activeFilters.author || '',
      isbn: activeFilters.isbn || '',
      publisher: activeFilters.publisher || '',
      language: activeFilters.language || '',
      collection: activeFilters.collection || '',
      yearFrom: activeFilters.yearFrom || '',
      yearTo: activeFilters.yearTo || '',
      featuredOnly: activeFilters.featuredOnly || false,
      inStockOnly: activeFilters.inStockOnly || false,
    });
  }, [activeFilters]);

  // Real-time debounce for the search filter
  useEffect(() => {
    const timer = setTimeout(() => {
      if (local.search !== activeFilters.search) {
        updateFilter('search', local.search);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [local.search, updateFilter, activeFilters.search]);

  const apply = () => {
    Object.entries(local).forEach(([k, v]) => updateFilter(k, v));
    onSearch?.();
    if (variant !== 'hero') setExpanded(false);
  };

  const clear = () => {
    const empty = {
      search: '', author: '', isbn: '', publisher: '', language: '', collection: '',
      yearFrom: '', yearTo: '', featuredOnly: false, inStockOnly: false,
    };
    setLocal(empty);
    Object.entries(empty).forEach(([k, v]) => updateFilter(k, v));
  };

  const hasAdvanced = local.author || local.isbn || local.publisher || local.language || local.collection
    || local.yearFrom || local.yearTo || local.featuredOnly || local.inStockOnly;

  const isHero = variant === 'hero';
  const inputClass = isHero
    ? 'pl-10 rounded-full bg-white/15 border-white/25 text-white placeholder:text-white/60 focus-visible:ring-white/40 backdrop-blur-sm'
    : 'pl-9 rounded-full bg-muted/40 border-border/60 glass-surface';

  const advancedCount = [
    local.author, local.isbn, local.publisher, local.language, local.collection,
    local.yearFrom, local.yearTo,
  ].filter(Boolean).length + (local.featuredOnly ? 1 : 0) + (local.inStockOnly ? 1 : 0);

  return (
    <div className={className}>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 ${isHero ? 'text-white/70' : 'text-muted-foreground'}`} />
          <Input
            value={local.search}
            onChange={(e) => setLocal((s) => ({ ...s, search: e.target.value }))}
            onKeyDown={(e) => e.key === 'Enter' && apply()}
            placeholder="Título, autor, ISBN, código..."
            className={inputClass}
          />
        </div>
        <Button onClick={apply} className={`rounded-full px-5 shrink-0 ${isHero ? 'bg-white text-[var(--brand-dark)] hover:bg-white/90' : 'btn-primary'}`}>
          Pesquisar
        </Button>
        <Button
          variant="outline"
          size="icon"
          className={`rounded-full shrink-0 relative ${expanded ? 'border-[var(--brand-primary)] bg-[rgb(var(--brand-primary-rgb)/0.1)]' : ''} ${isHero ? 'border-white/30 text-white hover:bg-white/10' : ''}`}
          onClick={() => setExpanded(!expanded)}
          title="Filtros avançados"
          type="button"
        >
          <SlidersHorizontal className="h-4 w-4" />
          {(advancedCount > 0 || filterCount > 0) && (
            <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-full bg-[var(--brand-primary)] text-white text-[10px] font-bold flex items-center justify-center">
              {advancedCount || filterCount}
            </span>
          )}
        </Button>
      </div>

      {typeof resultCount === 'number' && (local.search || filterCount > 0) && (
        <p className={`text-xs mt-2 ${isHero ? 'text-white/75' : 'text-muted-foreground'}`}>
          <strong className={isHero ? 'text-white' : 'text-foreground'}>{resultCount}</strong>
          {' '}livro{resultCount !== 1 ? 's' : ''} encontrado{resultCount !== 1 ? 's' : ''}
        </p>
      )}

      {isHero && !expanded && (quickGenres.length > 0 || BOOK_GENRES.length > 0) && (
        <div className="flex flex-wrap gap-2 mt-3">
          {(quickGenres.length > 0 ? quickGenres : BOOK_GENRES).slice(0, 8).map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => { updateFilter('categories', [g]); updateFilter('search', ''); }}
              className="text-xs px-3 py-1 rounded-full bg-white/10 hover:bg-white/20 text-white/90 border border-white/15 transition-colors"
            >
              {g}
            </button>
          ))}
        </div>
      )}

      {expanded && (
        <div className={`mt-4 p-5 rounded-2xl border space-y-4 animate-in slide-in-from-top-2 ${isHero ? 'bg-black/30 border-white/20 backdrop-blur-md text-white' : 'bg-card glass-surface'}`}>
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold flex items-center gap-2">
              <Sparkles className={`h-4 w-4 ${isHero ? 'text-white' : 'text-[var(--brand-primary)]'}`} />
              Pesquisa Avançada
            </p>
            {(hasAdvanced || local.search) && (
              <Button variant="ghost" size="sm" onClick={clear} className={`text-xs h-7 ${isHero ? 'text-white/80 hover:text-white' : ''}`}>
                <X className="h-3 w-3 mr-1" /> Limpar
              </Button>
            )}
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className={`text-xs flex items-center gap-1 ${isHero ? 'text-white/80' : ''}`}><BookOpen className="h-3 w-3" /> Autor</Label>
              <Input value={local.author} onChange={(e) => setLocal((s) => ({ ...s, author: e.target.value }))} placeholder="Ex: Ellen G. White" className="h-9" onKeyDown={(e) => e.key === 'Enter' && apply()} />
            </div>
            <div className="space-y-1.5">
              <Label className={`text-xs flex items-center gap-1 ${isHero ? 'text-white/80' : ''}`}><Hash className="h-3 w-3" /> ISBN / Código</Label>
              <Input value={local.isbn} onChange={(e) => setLocal((s) => ({ ...s, isbn: e.target.value }))} placeholder="LA-XXXX" className="h-9 font-mono text-sm" onKeyDown={(e) => e.key === 'Enter' && apply()} />
            </div>
            <div className="space-y-1.5">
              <Label className={`text-xs ${isHero ? 'text-white/80' : ''}`}>Editora</Label>
              {publishers.length > 0 ? (
                <Select value={local.publisher || '_all'} onValueChange={(v) => setLocal((s) => ({ ...s, publisher: v === '_all' ? '' : v }))}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Todas" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">Todas</SelectItem>
                    {publishers.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <Input value={local.publisher} onChange={(e) => setLocal((s) => ({ ...s, publisher: e.target.value }))} className="h-9" />
              )}
            </div>
            {bookCollections.length > 0 && (
              <div className="space-y-1.5">
                <Label className={`text-xs flex items-center gap-1 ${isHero ? 'text-white/80' : ''}`}><Layers className="h-3 w-3" /> Coleção</Label>
                <Select value={local.collection || '_all'} onValueChange={(v) => setLocal((s) => ({ ...s, collection: v === '_all' ? '' : v }))}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Todas" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">Todas as coleções</SelectItem>
                    {bookCollections.map((c) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label className={`text-xs ${isHero ? 'text-white/80' : ''}`}>Idioma</Label>
              <Select value={local.language || '_all'} onValueChange={(v) => setLocal((s) => ({ ...s, language: v === '_all' ? '' : v }))}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">Todos</SelectItem>
                  {BOOK_LANGUAGES.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className={`text-xs ${isHero ? 'text-white/80' : ''}`}>Ano (de)</Label>
              <Input type="number" value={local.yearFrom} onChange={(e) => setLocal((s) => ({ ...s, yearFrom: e.target.value }))} className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className={`text-xs ${isHero ? 'text-white/80' : ''}`}>Ano (até)</Label>
              <Input type="number" value={local.yearTo} onChange={(e) => setLocal((s) => ({ ...s, yearTo: e.target.value }))} className="h-9" />
            </div>
          </div>

          <div className="flex flex-wrap gap-4">
            <div className={`flex items-center gap-3 p-3 rounded-lg border flex-1 min-w-[200px] ${isHero ? 'border-white/20 bg-white/5' : 'bg-muted/30'}`}>
              <Switch checked={local.featuredOnly} onCheckedChange={(v) => setLocal((s) => ({ ...s, featuredOnly: v }))} />
              <Label className="text-sm">Apenas destaques</Label>
            </div>
            <div className={`flex items-center gap-3 p-3 rounded-lg border flex-1 min-w-[200px] ${isHero ? 'border-white/20 bg-white/5' : 'bg-muted/30'}`}>
              <Switch checked={local.inStockOnly} onCheckedChange={(v) => setLocal((s) => ({ ...s, inStockOnly: v }))} />
              <Label className="text-sm">Só com stock</Label>
            </div>
          </div>

          <Button onClick={apply} className={`w-full ${isHero ? 'bg-white text-[var(--brand-dark)] hover:bg-white/90' : 'btn-primary'}`}>
            <Filter className="h-4 w-4 mr-2" /> Aplicar Filtros
          </Button>
        </div>
      )}
    </div>
  );
}
