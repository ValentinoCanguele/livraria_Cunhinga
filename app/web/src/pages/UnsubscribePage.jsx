import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Loader2, MailX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import BrandLogo from '@/components/BrandLogo';
import { pageTitle } from '@/lib/brand';
import { APP_API_URL } from '@/lib/supabaseClient';

/**
 * Cancelar a subscrição das campanhas, pelo link que vai no rodapé dessas mensagens.
 *
 * Pública e sem sessão: quem quer sair de uma lista não deve ter de criar conta nem entrar.
 * O pedido é um POST feito nesta página e não ao abrir o link, porque alguns servidores de
 * correio seguem os endereços das mensagens para os analisar — com um GET a cancelar, uma
 * dessas visitas dava baixa de quem nunca carregou em nada.
 */
export default function UnsubscribePage() {
  const [params] = useSearchParams();
  const token = params.get('t') || '';
  const [state, setState] = useState(token ? 'idle' : 'invalid');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) setState('invalid');
  }, [token]);

  const confirm = async () => {
    setState('loading');
    try {
      const res = await fetch(`${APP_API_URL}/unsubscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Não foi possível concluir o pedido.');
      setMessage(data.message || 'Deixou de receber campanhas desta loja.');
      setState('done');
    } catch (err) {
      setMessage(err.message || 'Não foi possível concluir o pedido.');
      setState('error');
    }
  };

  return (
    <>
      <Helmet><title>{pageTitle('Cancelar subscrição')}</title></Helmet>
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-muted/30 to-background p-6">
        <div className="w-full max-w-md">
          <div className="mb-6 flex justify-center"><BrandLogo linkTo="/" /></div>

          <div className="rounded-2xl border bg-card p-7 shadow-lg text-center">
            {state === 'done' ? (
              <>
                <CheckCircle2 className="mx-auto h-11 w-11 text-emerald-500" aria-hidden />
                <h1 className="mt-4 text-xl font-bold">Pedido concluído</h1>
                <p className="mt-2 text-sm text-muted-foreground">{message}</p>
                <p className="mt-4 text-xs text-muted-foreground">
                  Continua a receber as mensagens sobre as suas compras — confirmações,
                  pagamentos e entregas —, que não fazem parte das campanhas.
                </p>
              </>
            ) : state === 'invalid' ? (
              <>
                <MailX className="mx-auto h-11 w-11 text-muted-foreground" aria-hidden />
                <h1 className="mt-4 text-xl font-bold">Link incompleto</h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  Use o link "Deixar de receber estas mensagens" tal como aparece no rodapé do
                  email. Se o problema continuar, fale connosco pela página de contacto.
                </p>
              </>
            ) : (
              <>
                <MailX className="mx-auto h-11 w-11 text-[#0ea5c9]" aria-hidden />
                <h1 className="mt-4 text-xl font-bold">Cancelar subscrição</h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  Deixa de receber campanhas e novidades desta loja. As mensagens sobre as suas
                  compras continuam a chegar.
                </p>
                {state === 'error' && (
                  <p className="mt-3 rounded-lg bg-destructive/10 p-3 text-sm text-destructive" role="alert">{message}</p>
                )}
                <Button className="mt-5 w-full btn-primary py-6" onClick={confirm} disabled={state === 'loading'}>
                  {state === 'loading' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Confirmar cancelamento
                </Button>
              </>
            )}

            <div className="mt-6 flex justify-center gap-4 text-xs text-muted-foreground">
              <Link to="/" className="hover:text-[#0ea5c9]">Voltar à loja</Link>
              <Link to="/contact" className="hover:text-[#0ea5c9]">Contacto</Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
