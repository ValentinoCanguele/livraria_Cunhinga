import React from 'react';
import { Spinner } from '@/components/ui/spinner';

/**
 * Ecrã mostrado enquanto o arranque ainda não sabe se existe sessão.
 *
 * Sem ele, uma página protegida tinha de decidir com informação incompleta e mandava para
 * `/login` quem tinha sessão válida — acontecia em todas as voltas do login com a Google, que
 * trazem a sessão no endereço e só a guardam depois de o supabase-js a processar.
 */
export default function SessionGate({ label = 'A verificar a sua sessão…' }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background" role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <Spinner className="size-7 text-primary animate-spin" />
        <p className="text-sm">{label}</p>
      </div>
    </div>
  );
}
