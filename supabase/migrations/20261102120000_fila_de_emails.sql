-- Fila de recuperação dos emails que falharam por motivo passageiro.
--
-- O envio continua a ser imediato: o checkout tenta mandar a confirmação na hora, e a
-- resposta diz se saiu. Esta fila é a rede por baixo — quando o SMTP está em baixo ou o
-- fornecedor responde 429, a mensagem fica aqui para ser repetida, em vez de se perder num
-- registo com `status = 'failed'` que ninguém voltava a olhar.
--
-- Só entram as falhas passageiras. Um endereço inválido ou uma chave recusada não melhoram
-- com repetições: ficam logo como falha definitiva.

create table if not exists public.email_queue (
  id text primary key default public.gen_record_id(),
  recipient text not null,
  subject text not null default '',
  html text not null default '',
  text_body text not null default '',
  headers jsonb,
  context text not null default 'order',
  customer_name text default '',
  order_number text default '',
  -- A mesma chave do `notification_logs`: impede que a repetição de um pedido ponha a mesma
  -- mensagem duas vezes na fila.
  dedupe_key text,
  status text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'failed')),
  attempts integer not null default 0,
  max_attempts integer not null default 5,
  next_attempt_at timestamptz not null default now(),
  last_error text default '',
  -- Quando foi reclamada para envio. Serve para devolver à fila o que ficou preso numa
  -- função que morreu a meio.
  locked_at timestamptz,
  created timestamptz not null default now(),
  updated timestamptz not null default now()
);

create index if not exists email_queue_due_idx
  on public.email_queue (next_attempt_at)
  where status = 'pending';

create unique index if not exists email_queue_dedupe_idx
  on public.email_queue (dedupe_key)
  where dedupe_key is not null and status in ('pending', 'sending');

alter table public.email_queue enable row level security;

-- Escrita só pelo service role (Edge Function). A equipa lê, para ver o que está pendente.
create policy "email_queue: staff lê" on public.email_queue
  for select to authenticated using ((select private.is_staff()));

/**
 * Reclama até `p_limit` mensagens para envio, numa só transacção.
 *
 * `for update skip locked` é o que torna isto seguro com várias instâncias da Edge Function
 * a correr ao mesmo tempo: duas chamadas simultâneas levam lotes diferentes, em vez de
 * enviarem a mesma mensagem duas vezes ao mesmo cliente.
 *
 * Devolve também o que ficou preso em `sending` há mais de 5 minutos: é uma função que
 * morreu a meio do envio, e sem isto a mensagem ficava para sempre nesse estado.
 */
create or replace function public.claim_email_jobs(p_limit integer default 10)
returns setof public.email_queue
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  update public.email_queue q
  set status = 'sending', locked_at = now(), updated = now()
  where q.id in (
    select c.id from public.email_queue c
    where (c.status = 'pending' and c.next_attempt_at <= now())
       or (c.status = 'sending' and c.locked_at < now() - interval '5 minutes')
    order by c.next_attempt_at
    limit greatest(1, least(coalesce(p_limit, 10), 50))
    for update skip locked
  )
  returning q.*;
end;
$$;

-- Só a Edge Function (service role) reclama trabalho da fila.
revoke execute on function public.claim_email_jobs(integer) from anon, authenticated;

-- Mantém `updated` certo sem o código ter de se lembrar dele.
create or replace function private.touch_email_queue()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated := now();
  return new;
end;
$$;

drop trigger if exists email_queue_touch on public.email_queue;
create trigger email_queue_touch
  before update on public.email_queue
  for each row execute function private.touch_email_queue();
