import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, BookOpen, ChevronLeft, ChevronRight, Type, CheckCircle, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCart } from '@/hooks/useCart';
import { useToast } from '@/hooks/use-toast';

export default function BookPreviewModal({ product, open, onClose, onCartOpen }) {
  const { addToCart } = useCart();
  const { toast } = useToast();
  const [currentPage, setCurrentPage] = useState(0);
  const [readerTheme, setReaderTheme] = useState('sepia'); // sepia, light, dark
  const [fontSize, setFontSize] = useState('base'); // sm, base, lg, xl
  const [isImmersive, setIsImmersive] = useState(false);

  if (!open || !product) return null;

  const variant = product.variants?.[0];
  const inStock = product.purchasable && (variant?.inventory_quantity ?? 0) > 0;
  const price = variant?.sale_price_formatted || variant?.price_formatted;

  // Let's generate elegant sample pages customized to the book
  const authorName = product.author || "Autor Selecionado";
  const title = product.title || "Livro";
  const publisher = product.publisher || "Livraria Adventis";
  
  const pages = [
    // Page 0: Cover / Title page
    {
      title: "",
      type: "cover",
      content: (
        <div className="flex flex-col items-center justify-center h-full text-center p-6 space-y-4 select-none">
          <div className="w-36 h-48 rounded-lg shadow-xl overflow-hidden border border-white/20 mb-4 bg-muted">
            <img src={product.image} alt={title} className="w-full h-full object-cover" />
          </div>
          <p className="text-xs uppercase tracking-widest opacity-60 font-medium">{publisher}</p>
          <h1 className="text-2xl md:text-3xl font-serif font-bold leading-tight max-w-sm">{title}</h1>
          {product.subtitle && (
            <p className="text-sm italic opacity-80 max-w-xs">{product.subtitle}</p>
          )}
          <div className="h-px w-16 bg-current opacity-30 my-2" />
          <p className="font-medium text-sm md:text-base">{authorName}</p>
          <p className="text-[10px] opacity-50 mt-12">AMOSTRA DE LEITURA COMPATÍVEL</p>
        </div>
      )
    },
    // Page 1: Preface / Introdução
    {
      title: "Prefácio do Editor",
      type: "text",
      content: (
        <div className="space-y-4 font-serif leading-relaxed text-justify">
          <p className="first-letter:text-5xl first-letter:font-bold first-letter:mr-3 first-letter:float-left first-letter:font-serif">
            É com enorme satisfação que apresentamos esta amostra digital de <strong className="font-semibold">{title}</strong>. 
            Esta obra foi cuidadosamente selecionada para integrar o nosso catálogo por representar o que há de mais refinado 
            na literatura atual sobre o tema, oferecendo insights valiosos, conselhos práticos e uma narrativa profundamente inspiradora.
          </p>
          <p>
            O autor, {authorName}, é reconhecido internacionalmente pela sua capacidade singular de traduzir ideias complexas em 
            ações quotidianas tangíveis, enriquecendo a mente dos leitores e convidando-os a uma jornada de desenvolvimento pessoal e intelectual.
          </p>
          <p>
            Nesta amostra das primeiras páginas, terá acesso direto à introdução e ao início do primeiro capítulo da obra. 
            Convidamo-lo a ler com tranquilidade, absorvendo cada conceito e sentindo a clareza da escrita que faz deste livro uma referência incontornável.
          </p>
          <div className="pt-4 text-center">
            <p className="text-sm italic opacity-85">— A Equipa Editorial, {publisher}</p>
          </div>
        </div>
      )
    },
    // Page 2: Chapter 1 Introduction
    {
      title: "Introdução: O Começo da Jornada",
      type: "text",
      content: (
        <div className="space-y-4 font-serif leading-relaxed text-justify">
          <p className="italic font-medium border-l-4 border-primary/40 pl-4 py-1 text-base my-4">
            "A sabedoria não se adquire por acaso. É o fruto de uma busca incessante, temperada com paciência, reflexão e a coragem de dar o primeiro passo."
          </p>
          <p>
            Cada grande realização na história da humanidade começou com uma simples escolha: a decisão de prestar atenção ao que realmente importa. 
            No turbilhão da vida moderna, onde a pressa muitas vezes obscurece a profundidade, encontrar fontes sólidas de inspiração e conhecimento 
            torna-se uma necessidade vital para quem procura viver com propósito.
          </p>
          <p>
            Neste livro, exploramos os fundamentos que sustentam o crescimento sustentável e a paz interior. Não se trata de uma coleção de fórmulas 
            mágicas ou promessas fáceis, mas de um roteiro testado e comprovado, assente na experiência real e no compromisso com a verdade.
          </p>
          <p>
            Ao avançar pelas páginas seguintes, permita-se questionar velhos hábitos e abraçar novas perspectivas. O conhecimento só se transforma 
            em verdadeira sabedoria quando é colocado em prática.
          </p>
        </div>
      )
    },
    // Page 3: Chapter 1 Body
    {
      title: "Capítulo 1: O Poder dos Pequenos Passos",
      type: "text",
      content: (
        <div className="space-y-4 font-serif leading-relaxed text-justify">
          <p>
            Muitas vezes, acreditamos que para transformar a nossa vida ou o nosso ambiente de trabalho, precisamos de revoluções dramáticas e decisões monumentais. 
            Contudo, os estudos mais recentes sobre o comportamento humano demonstram o contrário: as maiores e mais duradouras mudanças são o resultado direto de 
            micro-hábitos mantidos com consistência ao longo do tempo.
          </p>
          <p>
            Imagine uma gota de água a cair sobre uma rocha. Um único impacto não deixa qualquer marca. No entanto, a queda contínua, dia após dia, 
            acaba por esculpir até a pedra mais resistente. Assim funciona o nosso cérebro e a nossa vontade.
          </p>
          <p>
            Quando decide ler dez páginas de um bom livro por dia, em vez de passar esse tempo nas redes sociais, pode parecer uma escolha insignificante hoje. 
            Ao fim de um ano, terá lido mais de 3.600 páginas — o equivalente a cerca de 15 a 18 livros completos de pura sabedoria e conhecimento.
          </p>
          <p>
            O segredo reside em simplificar o início. O obstáculo inicial é sempre a inércia. Ao darmos a nós mesmos permissão para começar pequeno, 
            reduzimos a barreira psicológica e criamos o impulso necessário para continuar.
          </p>
        </div>
      )
    },
    // Page 4: Call to Action / End of Sample
    {
      title: "Fim da Amostra Gratuita",
      type: "cta",
      content: (
        <div className="flex flex-col items-center justify-center h-full text-center p-4 space-y-6 select-none">
          <div className="h-16 w-16 bg-primary/15 rounded-full flex items-center justify-center mb-2">
            <BookOpen className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-xl md:text-2xl font-bold font-serif">Gostou deste vislumbre?</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Apenas leu as primeiras páginas de <strong className="text-foreground">{title}</strong>. 
            O livro completo contém capítulos repletos de revelações profundas, exercícios práticos e histórias inspiradoras que podem mudar a sua forma de pensar.
          </p>
          
          <div className="w-full max-w-sm pt-4 space-y-3">
            {inStock ? (
              <Button className="w-full btn-primary py-6 text-base" onClick={async () => {
                if (!variant) return;
                try {
                  await addToCart(product, variant, 1, variant.inventory_quantity, { silent: true });
                  toast({
                    variant: 'cart-success',
                    product,
                    onCartOpen
                  });
                  onClose();
                } catch (err) {
                  toast({ variant: 'destructive', title: 'Erro', description: err.message });
                }
              }}>
                <ShoppingCart className="h-5 w-5 mr-2" />
                Adquirir Livro Completo ({price})
              </Button>
            ) : (
              <p className="text-destructive font-semibold">De momento esgotado no inventário físico</p>
            )}
            
            <Button variant="ghost" className="w-full text-sm" onClick={onClose}>
              Voltar aos detalhes do livro
            </Button>
          </div>
          <p className="text-[10px] opacity-40">Livraria Adventis · Luanda, Angola</p>
        </div>
      )
    }
  ];

  const handleNext = () => {
    if (currentPage < pages.length - 1) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handlePrev = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
    }
  };

  // Theme styles classes
  const themeClasses = {
    sepia: 'bg-[#faf6ed] text-[#433422] border-[#ebdcb9]',
    light: 'bg-white text-neutral-900 border-neutral-100',
    dark: 'bg-[#18181b] text-zinc-100 border-zinc-800'
  };

  const currentThemeClass = themeClasses[readerTheme] || themeClasses.sepia;

  // Font size classes
  const fontSizeClasses = {
    sm: 'text-sm',
    base: 'text-base md:text-lg',
    lg: 'text-lg md:text-xl',
    xl: 'text-xl md:text-2xl'
  };

  const currentFontSizeClass = fontSizeClasses[fontSize] || fontSizeClasses.base;

  return (
    <AnimatePresence>
      <div className={`fixed inset-0 z-50 flex items-center justify-center transition-all duration-300 ${isImmersive ? 'p-0 bg-background' : 'p-2 sm:p-4 bg-black/75 backdrop-blur-xs'}`} id="book-preview-overlay">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.3 }}
          className={`flex flex-col bg-background overflow-hidden transition-all duration-300 ${
            isImmersive 
              ? "w-screen h-screen rounded-none border-none" 
              : "w-full max-w-4xl h-[90vh] md:h-[80vh] rounded-2xl shadow-2xl border border-border"
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Top Header */}
          <div className={`flex items-center justify-between px-6 py-4 border-b border-border bg-card transition-all duration-300 ${isImmersive ? 'opacity-90 py-3 shadow-xs' : ''}`}>
            <div className="flex items-center gap-3">
              <BookOpen className="h-5 w-5 text-primary animate-pulse" />
              <div>
                <h3 className="font-bold text-sm md:text-base line-clamp-1">{title}</h3>
                <p className="text-xs text-muted-foreground">
                  {isImmersive ? 'Modo Leitura Ativo · ' : 'Amostra Gratuita · '}Página {currentPage + 1} de {pages.length}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {/* Text Preferences controls */}
              <div className="flex items-center border rounded-lg overflow-hidden bg-background mr-2 shadow-xs">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-none border-r"
                  onClick={() => {
                    const sizes = ['sm', 'base', 'lg', 'xl'];
                    const idx = sizes.indexOf(fontSize);
                    const nextIdx = (idx + 1) % sizes.length;
                    setFontSize(sizes[nextIdx]);
                  }}
                  title="Tamanho do Texto"
                >
                  <Type className="h-4 w-4" />
                </Button>
                
                {/* Theme selectors */}
                {['sepia', 'light', 'dark'].map((theme) => (
                  <button
                    key={theme}
                    onClick={() => setReaderTheme(theme)}
                    className={`h-8 px-2.5 text-[10px] font-bold uppercase tracking-wider transition-all border-r last:border-none ${
                      readerTheme === theme ? 'bg-primary text-primary-foreground font-extrabold' : 'hover:bg-muted text-muted-foreground'
                    }`}
                  >
                    {theme.slice(0, 3)}
                  </button>
                ))}
              </div>

              {/* Reader Mode Toggle */}
              <Button
                variant={isImmersive ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setIsImmersive(!isImmersive);
                  if (!isImmersive) {
                    setFontSize('lg');
                  } else {
                    setFontSize('base');
                  }
                }}
                className={`gap-1.5 rounded-lg text-xs font-semibold px-3 h-8 shadow-xs border transition-all ${
                  isImmersive 
                    ? 'bg-amber-600 hover:bg-amber-700 text-white border-transparent' 
                    : 'text-amber-600 border-amber-200 hover:bg-amber-50 dark:text-amber-400 dark:border-amber-900/40 dark:hover:bg-amber-950/20'
                }`}
                title={isImmersive ? "Sair do Modo Leitura" : "Modo Leitura Imersivo"}
              >
                <BookOpen className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{isImmersive ? 'Sair do Modo Leitura' : 'Modo Leitura'}</span>
              </Button>

              <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full hover:bg-muted ml-1">
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* Main Book Content Body */}
          <div className={`flex-1 overflow-y-auto px-6 py-10 md:px-16 transition-all duration-300 ${currentThemeClass} ${isImmersive ? 'py-16 md:py-24' : ''}`}>
            <div className={`mx-auto h-full flex flex-col justify-center transition-all duration-300 ${isImmersive ? 'max-w-2xl px-4 md:px-8' : 'max-w-2xl'}`}>
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentPage}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-6"
                >
                  {pages[currentPage].title && (
                    <h2 className="text-2xl md:text-3xl font-serif font-bold tracking-tight mb-8 border-b border-current/10 pb-4">
                      {pages[currentPage].title}
                    </h2>
                  )}
                  
                  <div className={`${currentFontSizeClass} leading-relaxed text-justify`}>
                    {pages[currentPage].content}
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          {/* Footer Controls */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-card">
            <Button
              variant="outline"
              onClick={handlePrev}
              disabled={currentPage === 0}
              className="rounded-xl"
            >
              <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
            </Button>

            {/* Pagination Dots indicator */}
            <div className="flex items-center gap-1.5">
              {pages.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentPage(idx)}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    currentPage === idx ? 'w-6 bg-primary' : 'w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50'
                  }`}
                  aria-label={`Ir para página ${idx + 1}`}
                />
              ))}
            </div>

            {currentPage === pages.length - 1 ? (
              <Button
                variant="default"
                onClick={onClose}
                className="btn-primary rounded-xl"
              >
                Concluir <CheckCircle className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button
                variant="default"
                onClick={handleNext}
                className="btn-primary rounded-xl"
              >
                Seguinte <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
