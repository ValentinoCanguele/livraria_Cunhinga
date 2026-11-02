import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, Monitor, Send, Smartphone } from 'lucide-react';
import pb from '@/lib/dataClient';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

/**
 * Modelos de email: lista, pré-visualização e envio de teste.
 *
 * O HTML vem da Edge Function (`/admin/email/preview`), que o compõe com as mesmas funções
 * que enviam de verdade. Montar aqui um exemplo próprio daria dois sítios a divergir, e o
 * gestor veria algo que o cliente nunca recebe.
 */
export default function EmailTemplatesPanel() {
  const { toast } = useToast();
  const [templates, setTemplates] = useState([]);
  const [ready, setReady] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState('');
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [device, setDevice] = useState('desktop');
  const [showText, setShowText] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await pb.send('/admin/email/templates');
        if (cancelled) return;
        setTemplates(res.templates || []);
        setReady(res.ready || null);
        setSelected((prev) => prev || res.templates?.[0]?.key || '');
      } catch (err) {
        if (!cancelled) setError(err.message || 'Não foi possível carregar os modelos.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    setPreviewLoading(true);
    pb.send(`/admin/email/preview?template=${encodeURIComponent(selected)}`)
      .then((res) => { if (!cancelled) setPreview(res); })
      .catch((err) => {
        if (!cancelled) toast({ variant: 'destructive', title: 'Pré-visualização indisponível', description: err.message });
      })
      .finally(() => { if (!cancelled) setPreviewLoading(false); });
    return () => { cancelled = true; };
  }, [selected, toast]);

  const groups = useMemo(() => {
    const byGroup = new Map();
    for (const t of templates) {
      if (!byGroup.has(t.group)) byGroup.set(t.group, []);
      byGroup.get(t.group).push(t);
    }
    return [...byGroup.entries()];
  }, [templates]);

  const sendTest = useCallback(async () => {
    const to = window.prompt('Enviar um teste para que endereço?', '');
    if (!to) return;
    setSending(true);
    try {
      const res = await pb.send('/admin/email/test', { method: 'POST', body: { to } });
      toast({ title: 'Teste enviado', description: res.message });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Não foi enviado', description: err.message });
    } finally {
      setSending(false);
    }
  }, [toast]);

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-[#0ea5c9]" /></div>;
  }

  if (error) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        {error}
      </div>
    );
  }

  // O que falta para as mensagens saírem de facto. Sem este aviso, os modelos pareciam
  // activos só por aparecerem bem na pré-visualização.
  const blockers = [];
  if (ready && !ready.enabled) blockers.push('o envio de emails está desligado em Configurações');
  if (ready && !ready.configured) {
    blockers.push(ready.provider === 'sendgrid' ? 'falta a chave do SendGrid' : 'falta o servidor SMTP');
  }
  if (ready && !ready.site_url) blockers.push('falta o endereço do site (os botões ficam sem destino)');

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Os modelos enviados aos clientes, tal como chegam. Cada um é composto pelo mesmo código
        que faz os envios reais.
      </p>

      {blockers.length > 0 ? (
        <div className="flex gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm" role="status">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
          <div className="text-amber-900 dark:text-amber-200">
            <strong>Nenhuma destas mensagens está a sair.</strong>
            <ul className="mt-1 list-disc pl-4 space-y-0.5">
              {blockers.map((b) => <li key={b}>{b}</li>)}
            </ul>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-800 dark:text-emerald-200" role="status">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          Os envios estão configurados. Confirme com um teste que a mensagem não cai no lixo.
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[240px_1fr] items-start">
        <nav className="space-y-4" aria-label="Modelos de email">
          {groups.map(([group, items]) => (
            <div key={group}>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{group}</p>
              <ul className="space-y-0.5">
                {items.map((t) => (
                  <li key={t.key}>
                    <button
                      type="button"
                      onClick={() => setSelected(t.key)}
                      aria-current={selected === t.key ? 'true' : undefined}
                      className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                        selected === t.key
                          ? 'bg-primary/10 font-medium text-primary'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      }`}
                    >
                      {t.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Assunto</p>
              <p className="truncate text-sm font-medium">{preview?.subject || '—'}</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex rounded-lg border p-0.5" role="group" aria-label="Tamanho do ecrã">
                <button
                  type="button"
                  onClick={() => setDevice('desktop')}
                  aria-pressed={device === 'desktop'}
                  aria-label="Ver em computador"
                  className={`rounded-md p-1.5 ${device === 'desktop' ? 'bg-muted text-foreground' : 'text-muted-foreground'}`}
                >
                  <Monitor className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setDevice('mobile')}
                  aria-pressed={device === 'mobile'}
                  aria-label="Ver em telemóvel"
                  className={`rounded-md p-1.5 ${device === 'mobile' ? 'bg-muted text-foreground' : 'text-muted-foreground'}`}
                >
                  <Smartphone className="h-4 w-4" />
                </button>
              </div>
              <Button size="sm" variant="outline" onClick={() => setShowText((v) => !v)}>
                {showText ? 'Ver desenho' : 'Ver texto simples'}
              </Button>
              <Button size="sm" variant="outline" onClick={sendTest} disabled={sending}>
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                <span className="ml-1.5 hidden sm:inline">Enviar teste</span>
              </Button>
            </div>
          </div>

          <div className="bg-muted/40 p-4">
            {previewLoading && (
              <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-[#0ea5c9]" /></div>
            )}
            {!previewLoading && showText && (
              <pre className="max-h-[560px] overflow-auto rounded-lg border bg-background p-4 text-xs leading-relaxed whitespace-pre-wrap">
                {preview?.text || ''}
              </pre>
            )}
            {!previewLoading && !showText && preview?.html && (
              // `sandbox` sem `allow-scripts`: o conteúdo é nosso, mas uma pré-visualização
              // não precisa de correr nada, e assim não corre mesmo.
              <iframe
                key={`${selected}-${device}`}
                title={`Pré-visualização: ${preview.label}`}
                srcDoc={preview.html}
                sandbox=""
                className="mx-auto block h-[560px] rounded-lg border bg-white"
                style={{ width: device === 'mobile' ? 375 : '100%', maxWidth: device === 'mobile' ? 375 : 680 }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
