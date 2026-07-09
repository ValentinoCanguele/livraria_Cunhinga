import React from 'react';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, Layers, BookOpen, Package } from 'lucide-react';
import { BOOK_LANGUAGES } from '@/lib/bookConstants';

const FilterPanel = ({
  availableFilters,
  activeFilters,
  updateFilter,
  updateOptionFilter,
  clearFilters,
  filterCount,
  bookCollections = [],
}) => {
  const handleOptionToggle = (optionName, value) => {
    const currentOptions = activeFilters.options[optionName] || [];
    const updated = currentOptions.includes(value)
      ? currentOptions.filter((item) => item !== value)
      : [...currentOptions, value];
    updateOptionFilter(optionName, updated);
  };

  const handleCategoryToggle = (category) => {
    const currentCategories = activeFilters.categories || [];
    const isCurrentlySelected = currentCategories.some((c) => c.toLowerCase() === category.toLowerCase());
    const updated = isCurrentlySelected
      ? currentCategories.filter((c) => c.toLowerCase() !== category.toLowerCase())
      : [...currentCategories, category];
    updateFilter('categories', updated);
  };

  const displayMinPrice = activeFilters.minPrice;
  const displayMaxPrice = activeFilters.maxPrice === Infinity
    ? (availableFilters.maxPrice || 5000)
    : activeFilters.maxPrice;

  const genres = availableFilters.genres || [];

  return (
    <div className="space-y-7">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-foreground">Refinar catálogo</h2>
        {filterCount > 0 && (
          <span className="bg-[rgb(var(--brand-primary-rgb)/0.1)] text-[var(--brand-primary)] text-xs font-medium px-2.5 py-0.5 rounded-full">
            {filterCount} activo{filterCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Disponibilidade */}
      <div>
        <h3 className="text-sm font-medium mb-3 text-foreground flex items-center gap-1.5">
          <Package className="h-3.5 w-3.5 text-[var(--brand-primary)]" /> Disponibilidade
        </h3>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Checkbox
              id="in-stock"
              checked={activeFilters.inStockOnly}
              onCheckedChange={(v) => updateFilter('inStockOnly', !!v)}
            />
            <Label htmlFor="in-stock" className="text-sm cursor-pointer">Apenas com stock</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="featured-only"
              checked={activeFilters.featuredOnly}
              onCheckedChange={(v) => updateFilter('featuredOnly', !!v)}
            />
            <Label htmlFor="featured-only" className="text-sm cursor-pointer">Em destaque</Label>
          </div>
        </div>
      </div>

      {/* Coleções */}
      {bookCollections.length > 0 && (
        <div>
          <h3 className="text-sm font-medium mb-3 text-foreground flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5 text-[var(--brand-primary)]" /> Coleção
          </h3>
          <Select
            value={activeFilters.collection || '_all'}
            onValueChange={(v) => updateFilter('collection', v === '_all' ? '' : v)}
          >
            <SelectTrigger className="h-9"><SelectValue placeholder="Todas as coleções" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">Todas as coleções</SelectItem>
              {bookCollections.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Géneros */}
      {genres.length > 0 && (
        <div>
          <h3 className="text-sm font-medium mb-3 text-foreground flex items-center gap-1.5">
            <BookOpen className="h-3.5 w-3.5 text-[var(--brand-primary)]" /> Género
          </h3>
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {genres.map((cat) => {
              const isChecked = (activeFilters.categories || []).some(
                (c) => c.toLowerCase() === cat.toLowerCase()
              );
              const id = `cat-${cat}`;
              return (
                <div key={cat} className="flex items-center">
                  <Checkbox id={id} checked={isChecked} onCheckedChange={() => handleCategoryToggle(cat)} />
                  <Label htmlFor={id} className="ml-2 text-sm font-normal cursor-pointer">{cat}</Label>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Idioma */}
      {(availableFilters.languages?.length > 0) && (
        <div>
          <h3 className="text-sm font-medium mb-3 text-foreground">Idioma</h3>
          <Select
            value={activeFilters.language || '_all'}
            onValueChange={(v) => updateFilter('language', v === '_all' ? '' : v)}
          >
            <SelectTrigger className="h-9"><SelectValue placeholder="Todos" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">Todos</SelectItem>
              {BOOK_LANGUAGES.filter((l) => availableFilters.languages.includes(l)).map((l) => (
                <SelectItem key={l} value={l}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Preço */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-foreground">Preço (Kz)</h3>
          <span className="text-xs text-muted-foreground font-medium">
            {displayMinPrice.toLocaleString('pt-AO')} – {displayMaxPrice.toLocaleString('pt-AO')} Kz
          </span>
        </div>
        <Slider
          value={[displayMinPrice, displayMaxPrice]}
          onValueChange={(val) => {
            updateFilter('minPrice', val[0]);
            updateFilter('maxPrice', val[1]);
          }}
          min={availableFilters.minPrice || 0}
          max={availableFilters.maxPrice || 5000}
          step={10}
          className="mb-4"
        />
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1">
            <Label className="text-xs text-muted-foreground mb-1 block">Mínimo</Label>
            <Input
              type="number"
              value={displayMinPrice}
              onChange={(e) => updateFilter('minPrice', parseInt(e.target.value, 10) || 0)}
              className="h-9 text-sm"
            />
          </div>
          <div className="flex-1">
            <Label className="text-xs text-muted-foreground mb-1 block">Máximo</Label>
            <Input
              type="number"
              value={displayMaxPrice}
              onChange={(e) => updateFilter('maxPrice', parseInt(e.target.value, 10) || 0)}
              className="h-9 text-sm"
            />
          </div>
        </div>
      </div>

      {availableFilters.options && Object.entries(availableFilters.options).map(([optionName, values]) => {
        if (!values?.length) return null;
        return (
          <div key={optionName}>
            <h3 className="text-sm font-medium mb-3 text-foreground">{optionName}</h3>
            <div className="space-y-2">
              {values.map((val) => {
                const isChecked = (activeFilters.options[optionName] || []).includes(val);
                const id = `opt-${optionName}-${val}`;
                return (
                  <div key={val} className="flex items-center">
                    <Checkbox id={id} checked={isChecked} onCheckedChange={() => handleOptionToggle(optionName, val)} />
                    <Label htmlFor={id} className="ml-2 text-sm font-normal cursor-pointer">{val}</Label>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {filterCount > 0 && (
        <Button onClick={clearFilters} variant="outline" className="w-full text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4 mr-2" />
          Limpar todos os filtros
        </Button>
      )}
    </div>
  );
};

export default FilterPanel;
