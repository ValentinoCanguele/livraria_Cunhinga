import { toast as sonnerToast } from "sonner";

export const toast = (opts) => {
  if (typeof opts === 'string') {
    return sonnerToast(opts);
  }
  
  const { title, description, variant, ...rest } = opts;
  
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