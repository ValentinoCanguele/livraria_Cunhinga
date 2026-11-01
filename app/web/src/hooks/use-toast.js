import React from "react";
import { toast as sonnerToast } from "sonner";

export const toast = (opts) => {
  if (typeof opts === 'string') {
    return sonnerToast(opts);
  }
  
  const { title, description, variant, product, onCartOpen, ...rest } = opts;
  
  if (variant === 'cart-success' && product) {
    return sonnerToast.custom((t) => {
      const imgElement = product.image ? React.createElement('img', {
        src: product.image,
        alt: product.title,
        className: "w-10 h-14 object-cover rounded bg-muted shrink-0 shadow-sm border border-border/50"
      }) : null;

      const titleElement = React.createElement('p', {
        className: "font-bold text-foreground text-sm truncate leading-snug"
      }, product.title);

      const infoContainer = React.createElement('div', {
        className: "flex-1 min-w-0"
      }, 
        React.createElement('p', { className: "text-[10px] font-bold text-primary uppercase tracking-wider mb-0.5" }, "Adicionado!"),
        titleElement,
        React.createElement('p', { className: "text-xs text-muted-foreground" }, "No seu carrinho de compras")
      );

      const btnElement = React.createElement('button', {
        onClick: () => {
          sonnerToast.dismiss(t);
          onCartOpen?.();
        },
        className: "text-xs font-bold px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-all shrink-0 shadow-sm cursor-pointer"
      }, "Ver");

      return React.createElement('div', {
        className: "flex items-center gap-3 bg-background border border-border shadow-xl rounded-xl p-3 max-w-sm w-full animate-in slide-in-from-bottom-5 duration-300"
      }, imgElement, infoContainer, btnElement);
    }, { duration: 4000, ...rest });
  }
  
  if (variant === 'destructive') {
    return sonnerToast.error(title || 'Error', { description, ...rest });
  }
  
  if (variant === 'success' || title === 'Success') {
    const msg = title === 'Success' && description ? description : title;
    const desc = title === 'Success' ? undefined : description;
    return sonnerToast.success(msg, { description: desc, ...rest });
  }
  
  return sonnerToast(title, { description, ...rest });
};

export function useToast() {
  return {
    toast,
    dismiss: sonnerToast.dismiss,
  };
}