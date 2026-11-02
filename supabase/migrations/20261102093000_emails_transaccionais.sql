-- Emails transaccionais: endereço público do site, novos contextos e protecção contra duplicados.

-- 1. Endereço público do site.
-- Os emails enviados pelo servidor (mudança de estado de uma encomenda, pagamento
-- confirmado) não nascem de um pedido do navegador, por isso não têm `origin` de onde tirar
-- o endereço. Sem isto, os botões "Acompanhar a encomenda" não tinham para onde apontar.
alter table public.site_settings add column if not exists site_url text default '';

comment on column public.site_settings.site_url is
  'Endereço público da loja (ex.: https://livraria-adventista.pages.dev). Usado nos botões e no rodapé dos emails.';

-- 2. Novos contextos de notificação.
-- O `check` só aceitava order/receipt/test/contact/campaign: um email de conta ou de
-- mudança de estado era recusado pela base de dados e o registo perdia-se — ficava sem
-- rasto um envio que até podia ter saído.
alter table public.notification_logs drop constraint if exists notification_logs_context_check;
alter table public.notification_logs add constraint notification_logs_context_check
  check (context in ('order', 'order_status', 'payment', 'receipt', 'account', 'welcome', 'test', 'contact', 'campaign'));

-- 3. Idempotência.
-- `dedupe_key` identifica o acontecimento que originou o email (encomenda + estado, por
-- exemplo). O índice único só cobre os envios bem-sucedidos: um envio falhado tem de poder
-- ser repetido, um entregue não. É o que impede o cliente de receber duas vezes a mesma
-- confirmação quando um pedido é repetido ou a função reinicia a meio.
alter table public.notification_logs add column if not exists dedupe_key text;

create unique index if not exists notification_logs_dedupe_sent_idx
  on public.notification_logs (dedupe_key)
  where dedupe_key is not null and status = 'sent';
