-- Centro de notificações pessoais e atendimento dentro do chat.
-- Aplicar pela ferramenta autorizada do Supabase antes de publicar a interface.

alter table public.orders
  add column if not exists customer_id uuid references auth.users (id) on delete set null;

create index if not exists orders_customer_id_idx
  on public.orders (customer_id, created desc)
  where customer_id is not null;

update public.orders o
set customer_id = u.id
from auth.users u
where o.customer_id is null
  and nullif(btrim(o.customer_email), '') is not null
  and lower(o.customer_email) = lower(u.email);

drop policy if exists "orders: gestão ou o próprio cliente" on public.orders;
create policy "orders: gestão ou o próprio cliente" on public.orders for select to authenticated
  using (
    (select private.has_permission('manage_orders'))
    or customer_id = (select auth.uid())
    or lower(customer_email) = lower(coalesce((select auth.jwt()) ->> 'email', ''))
  );

create table public.support_threads (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  order_id text references public.orders (id) on delete set null,
  subject text not null check (char_length(btrim(subject)) between 1 and 160),
  status text not null default 'open' check (status in ('open', 'pending', 'closed')),
  assigned_to uuid references public.profiles (id) on delete set null,
  customer_last_read_at timestamptz not null default now(),
  staff_last_read_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  last_sender_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index support_threads_customer_last_message_idx
  on public.support_threads (customer_id, last_message_at desc);
create index support_threads_staff_last_message_idx
  on public.support_threads (status, assigned_to, last_message_at desc);

create table public.support_messages (
  id bigint generated always as identity primary key,
  thread_id uuid not null references public.support_threads (id) on delete cascade,
  sender_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index support_messages_thread_created_idx
  on public.support_messages (thread_id, created_at, id);

create table public.customer_notifications (
  id bigint generated always as identity primary key,
  customer_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('order', 'payment', 'delivery', 'support')),
  title text not null check (char_length(title) between 1 and 120),
  body text not null check (char_length(body) between 1 and 500),
  href text not null default '/profile?tab=orders',
  order_id text references public.orders (id) on delete cascade,
  thread_id uuid references public.support_threads (id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index customer_notifications_unread_idx
  on public.customer_notifications (customer_id, created_at desc)
  where read_at is null;

create table public.staff_notifications (
  id bigint generated always as identity primary key,
  staff_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('new_order', 'support')),
  title text not null check (char_length(title) between 1 and 120),
  body text not null check (char_length(body) between 1 and 500),
  order_id text references public.orders (id) on delete cascade,
  thread_id uuid references public.support_threads (id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index staff_notifications_unread_idx
  on public.staff_notifications (staff_id, created_at desc)
  where read_at is null;

alter table public.support_threads enable row level security;
alter table public.support_messages enable row level security;
alter table public.customer_notifications enable row level security;
alter table public.staff_notifications enable row level security;

revoke all on public.support_threads, public.support_messages,
  public.customer_notifications, public.staff_notifications from public, anon, authenticated;
grant select on public.support_threads, public.support_messages,
  public.customer_notifications, public.staff_notifications to authenticated;
grant insert (thread_id, body) on public.support_messages to authenticated;
grant usage, select on sequence public.support_messages_id_seq to authenticated;

create policy "support_threads: cliente ou atendimento lê"
  on public.support_threads for select to authenticated
  using (customer_id = (select auth.uid()) or (select private.has_permission('manage_orders')));

create policy "support_threads: cliente inicia"
  on public.support_threads for insert to authenticated
  with check (
    customer_id = (select auth.uid())
    and not (select private.has_permission('manage_orders'))
    and (
      order_id is null
      or exists (
        select 1 from public.orders o
        where o.id = order_id and o.customer_id = (select auth.uid())
      )
    )
  );

create policy "support_messages: participante lê"
  on public.support_messages for select to authenticated
  using (
    exists (
      select 1 from public.support_threads t
      where t.id = thread_id
        and (t.customer_id = (select auth.uid()) or (select private.has_permission('manage_orders')))
    )
  );

create policy "support_messages: participante envia"
  on public.support_messages for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and exists (
      select 1 from public.support_threads t
      where t.id = thread_id
        and t.status <> 'closed'
        and (t.customer_id = (select auth.uid()) or (select private.has_permission('manage_orders')))
    )
  );

create policy "customer_notifications: o próprio lê"
  on public.customer_notifications for select to authenticated
  using (customer_id = (select auth.uid()));

create policy "staff_notifications: o próprio lê"
  on public.staff_notifications for select to authenticated
  using (staff_id = (select auth.uid()) and (select private.has_permission('manage_orders')));

create or replace function public.support_mark_read(p_thread_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Sessão obrigatória.'; end if;

  if private.has_permission('manage_orders') then
    update public.support_threads
    set staff_last_read_at = now(), updated_at = now()
    where id = p_thread_id;
    if not found then raise exception 'Conversa não encontrada.'; end if;
    return;
  end if;

  update public.support_threads
  set customer_last_read_at = now(), updated_at = now()
  where id = p_thread_id and customer_id = auth.uid();

  if found then return; end if;
  raise exception 'Sem permissão para esta operação.';
end;
$$;

create or replace function public.support_update_thread(
  p_thread_id uuid,
  p_status text,
  p_assigned_to uuid
)
returns public.support_threads
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_thread public.support_threads;
begin
  if auth.uid() is null or not private.has_permission('manage_orders') then
    raise exception 'Sem permissão para esta operação.';
  end if;
  if p_status is null or p_status not in ('open', 'pending', 'closed') then
    raise exception 'Estado da conversa inválido.';
  end if;
  if p_assigned_to is not null and not exists (
    select 1 from public.profiles p
    where p.id = p_assigned_to
      and (
        p.role = 'admin'
        or (p.role = 'manager' and p.permissions ->> 'manage_orders' = 'true')
      )
  ) then
    raise exception 'O responsável seleccionado não pode gerir encomendas.';
  end if;

  update public.support_threads
  set status = p_status, assigned_to = p_assigned_to, updated_at = now()
  where id = p_thread_id
  returning * into v_thread;

  if not found then raise exception 'Conversa não encontrada.'; end if;
  return v_thread;
end;
$$;

create or replace function public.customer_mark_notification_read(p_notification_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.customer_notifications
  set read_at = coalesce(read_at, now())
  where id = p_notification_id and customer_id = auth.uid();
  if not found then raise exception 'Notificação não encontrada.'; end if;
end;
$$;

create or replace function public.staff_mark_notification_read(p_notification_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not private.has_permission('manage_orders') then
    raise exception 'Sem permissão para esta operação.';
  end if;
  update public.staff_notifications
  set read_at = coalesce(read_at, now())
  where id = p_notification_id and staff_id = auth.uid();
  if not found then raise exception 'Notificação não encontrada.'; end if;
end;
$$;

create or replace function public.support_create_thread(
  p_subject text,
  p_body text,
  p_order_id text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_thread_id uuid;
begin
  if auth.uid() is null or private.has_permission('manage_orders') then
    raise exception 'Só clientes autenticados podem iniciar uma conversa.';
  end if;
  if char_length(btrim(coalesce(p_subject, ''))) not between 1 and 160 then
    raise exception 'O assunto deve ter entre 1 e 160 caracteres.';
  end if;
  if char_length(btrim(coalesce(p_body, ''))) not between 1 and 4000 then
    raise exception 'A mensagem deve ter entre 1 e 4000 caracteres.';
  end if;
  if p_order_id is not null and not exists (
    select 1 from public.orders o
    where o.id = p_order_id and o.customer_id = auth.uid()
  ) then
    raise exception 'A encomenda indicada não pertence à sua conta.';
  end if;

  insert into public.support_threads (customer_id, order_id, subject)
  values (auth.uid(), p_order_id, btrim(p_subject))
  returning id into v_thread_id;

  insert into public.support_messages (thread_id, sender_id, body)
  values (v_thread_id, auth.uid(), btrim(p_body));
  return v_thread_id;
end;
$$;

revoke all on function public.support_mark_read(uuid) from public, anon;
revoke all on function public.support_update_thread(uuid, text, uuid) from public, anon;
revoke all on function public.customer_mark_notification_read(bigint) from public, anon;
revoke all on function public.staff_mark_notification_read(bigint) from public, anon;
revoke all on function public.support_create_thread(text, text, text) from public, anon;
grant execute on function public.support_mark_read(uuid) to authenticated;
grant execute on function public.support_update_thread(uuid, text, uuid) to authenticated;
grant execute on function public.customer_mark_notification_read(bigint) to authenticated;
grant execute on function public.staff_mark_notification_read(bigint) to authenticated;
grant execute on function public.support_create_thread(text, text, text) to authenticated;

create or replace function private.notify_support_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_thread public.support_threads;
  v_staff record;
begin
  select * into v_thread from public.support_threads where id = new.thread_id;
  update public.support_threads
  set last_message_at = new.created_at,
      last_sender_id = new.sender_id,
      updated_at = new.created_at,
      status = case
        when v_thread.customer_id = new.sender_id then 'open'
        when status = 'open' then 'pending'
        else status
      end
  where id = new.thread_id;

  if v_thread.customer_id = new.sender_id then
    for v_staff in
      select p.id from public.profiles p
      where p.role = 'admin'
        or (p.role = 'manager' and p.permissions ->> 'manage_orders' = 'true')
    loop
      insert into public.staff_notifications (staff_id, kind, title, body, thread_id, order_id)
      values (
        v_staff.id, 'support', 'Nova mensagem de cliente',
        left(v_thread.subject, 500), v_thread.id, v_thread.order_id
      );
    end loop;
  else
    insert into public.customer_notifications (customer_id, kind, title, body, href, thread_id, order_id)
    values (
      v_thread.customer_id, 'support', 'Resposta da equipa',
      left(v_thread.subject, 500), '/profile?tab=orders', v_thread.id, v_thread.order_id
    );
  end if;
  return new;
end;
$$;

revoke execute on function private.notify_support_message() from public, anon, authenticated;
create trigger support_messages_notify
  after insert on public.support_messages
  for each row execute function private.notify_support_message();

create or replace function private.notify_order_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_staff record;
  v_number text;
begin
  if tg_op = 'INSERT' then
    v_number := left(coalesce(nullif(new.order_number, ''), new.id), 400);
    if new.customer_id is not null then
      insert into public.customer_notifications (customer_id, kind, title, body, href, order_id)
      values (
        new.customer_id, 'order', 'Encomenda recebida',
        'A encomenda ' || v_number || ' foi registada.',
        '/profile?tab=orders', new.id
      );
    end if;

    for v_staff in
      select p.id from public.profiles p
      where p.role = 'admin'
        or (p.role = 'manager' and p.permissions ->> 'manage_orders' = 'true')
    loop
      insert into public.staff_notifications (staff_id, kind, title, body, order_id)
      values (v_staff.id, 'new_order', 'Nova encomenda', 'Encomenda ' || v_number || ' recebida.', new.id);
    end loop;
    return new;
  end if;

  if new.customer_id is null then return new; end if;
  v_number := left(coalesce(nullif(new.order_number, ''), new.id), 400);

  if new.status is distinct from old.status then
    insert into public.customer_notifications (customer_id, kind, title, body, href, order_id)
    values (new.customer_id, 'order', 'Estado da encomenda actualizado',
      'A encomenda ' || v_number || ' está agora: ' ||
        case new.status
          when 'pending' then 'pendente'
          when 'confirmed' then 'confirmada'
          when 'processing' then 'em preparação'
          when 'shipped' then 'expedida'
          when 'delivered' then 'entregue'
          when 'cancelled' then 'cancelada'
          else coalesce(nullif(new.status, ''), 'em processamento')
        end || '.',
      '/profile?tab=orders', new.id);
  end if;
  if new.payment_status is distinct from old.payment_status then
    insert into public.customer_notifications (customer_id, kind, title, body, href, order_id)
    values (new.customer_id, 'payment', 'Estado do pagamento actualizado',
      'O pagamento da encomenda ' || v_number || ' está agora: ' ||
        case new.payment_status
          when 'pending' then 'pendente'
          when 'awaiting_confirmation' then 'a aguardar confirmação'
          when 'paid' then 'confirmado'
          when 'failed' then 'não confirmado'
          when 'refunded' then 'devolvido'
          else coalesce(nullif(new.payment_status, ''), 'pendente')
        end || '.',
      '/profile?tab=orders', new.id);
  end if;
  if new.delivery_status is distinct from old.delivery_status then
    insert into public.customer_notifications (customer_id, kind, title, body, href, order_id)
    values (new.customer_id, 'delivery', 'Estado da entrega actualizado',
      'A entrega da encomenda ' || v_number || ' está agora: ' ||
        case new.delivery_status
          when 'received' then 'recebida'
          when 'processing' then 'em preparação'
          when 'shipped' then 'expedida'
          when 'in_transit' then 'em trânsito'
          when 'delivered' then 'entregue'
          when 'failed' then 'com ocorrência'
          else coalesce(nullif(new.delivery_status, ''), 'em processamento')
        end || '.',
      '/profile?tab=orders', new.id);
  end if;
  return new;
end;
$$;

revoke execute on function private.notify_order_activity() from public, anon, authenticated;
create trigger orders_notify_activity
  after insert or update of status, payment_status, delivery_status on public.orders
  for each row execute function private.notify_order_activity();
