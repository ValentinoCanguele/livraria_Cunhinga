-- Registo real das notificações enviadas pela Edge Function "app" (email e WhatsApp).
-- Substitui os registos simulados que eram gravados no Firestore pelo navegador.
create table public.notification_logs (
  id text primary key default public.gen_record_id(),
  type text not null check (type in ('email', 'whatsapp')),
  context text not null default 'order' check (context in ('order', 'receipt', 'test', 'contact', 'campaign')),
  status text not null check (status in ('sent', 'failed', 'skipped')),
  provider text default '',
  recipient text default '',
  customer_name text default '',
  order_number text default '',
  subject text default '',
  content text default '',
  detail text default '',
  created timestamptz not null default now()
);

create index notification_logs_created_idx on public.notification_logs (created desc);

alter table public.notification_logs enable row level security;

-- Escrita só pelo service role (Edge Function); a equipa lê e limpa.
create policy "notification_logs: staff lê" on public.notification_logs for select to authenticated using ((select private.is_staff()));
create policy "notification_logs: staff apaga" on public.notification_logs for delete to authenticated using ((select private.is_staff()));
