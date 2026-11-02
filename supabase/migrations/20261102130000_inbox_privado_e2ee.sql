create table public.e2ee_device_keys (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  device_id uuid not null default gen_random_uuid(),
  key_package text not null check (char_length(key_package) between 1 and 32768),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (user_id, device_id),
  check (expires_at > created_at)
);

create index e2ee_device_keys_active_idx
  on public.e2ee_device_keys (expires_at)
  where revoked_at is null;

alter table public.e2ee_device_keys enable row level security;
revoke all on public.e2ee_device_keys from anon, authenticated;
grant select, insert, delete on public.e2ee_device_keys to authenticated;

create policy "e2ee_device_keys: o próprio lê"
  on public.e2ee_device_keys for select to authenticated
  using (user_id = (select auth.uid()));

create policy "e2ee_device_keys: o próprio publica"
  on public.e2ee_device_keys for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and revoked_at is null
    and expires_at > now()
  );

create policy "e2ee_device_keys: o próprio remove"
  on public.e2ee_device_keys for delete to authenticated
  using (user_id = (select auth.uid()));

create or replace function public.e2ee_admin_key_packages()
returns table (user_id uuid, device_id uuid, key_package text, expires_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select k.user_id, k.device_id, k.key_package, k.expires_at
  from public.e2ee_device_keys k
  join public.profiles p on p.id = k.user_id
  where auth.uid() is not null
    and p.role = 'admin'
    and k.revoked_at is null
    and k.expires_at > now();
$$;

revoke all on function public.e2ee_admin_key_packages() from public, anon;
grant execute on function public.e2ee_admin_key_packages() to authenticated;

create table public.secure_support_threads (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  book_id text references public.stock_books (id) on delete set null,
  review_id text references public.book_reviews (id) on delete set null,
  mls_group_id text not null unique check (char_length(mls_group_id) between 1 and 128),
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now(),
  check (review_id is null or book_id is not null)
);

create index secure_support_threads_customer_created_idx
  on public.secure_support_threads (customer_id, created_at desc);

create index secure_support_threads_status_created_idx
  on public.secure_support_threads (status, created_at desc);

create or replace function private.validate_secure_support_thread()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  linked_book_id text;
begin
  if new.review_id is not null then
    select r.book_id into linked_book_id
    from public.book_reviews r
    where r.id = new.review_id;

    if linked_book_id is null or linked_book_id is distinct from new.book_id then
      raise exception 'A avaliação tem de pertencer ao livro indicado.';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function private.validate_secure_support_thread() from public, anon, authenticated;

create trigger secure_support_threads_validate_link
  before insert or update of book_id, review_id on public.secure_support_threads
  for each row execute function private.validate_secure_support_thread();

alter table public.secure_support_threads enable row level security;
revoke all on public.secure_support_threads from anon, authenticated;
grant select, insert, update (status) on public.secure_support_threads to authenticated;

create policy "secure_support_threads: cliente ou admin lê"
  on public.secure_support_threads for select to authenticated
  using (customer_id = (select auth.uid()) or (select private.is_admin()));

create policy "secure_support_threads: cliente cria"
  on public.secure_support_threads for insert to authenticated
  with check (
    customer_id = (select auth.uid())
    and not (select private.is_admin())
  );

create policy "secure_support_threads: cliente ou admin fecha"
  on public.secure_support_threads for update to authenticated
  using (customer_id = (select auth.uid()) or (select private.is_admin()))
  with check (customer_id = (select auth.uid()) or (select private.is_admin()));

create table public.secure_support_messages (
  id bigint generated always as identity primary key,
  thread_id uuid not null references public.secure_support_threads (id) on delete cascade,
  sender_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  client_message_id uuid not null default gen_random_uuid(),
  wire_format text not null check (wire_format in ('mls_private_message', 'mls_public_message', 'mls_welcome')),
  epoch bigint check (epoch is null or epoch >= 0),
  ciphertext_base64url text not null check (
    char_length(ciphertext_base64url) between 1 and 100000
    and ciphertext_base64url ~ '^[A-Za-z0-9_-]+$'
  ),
  created_at timestamptz not null default now(),
  unique (thread_id, client_message_id)
);

create index secure_support_messages_thread_created_idx
  on public.secure_support_messages (thread_id, created_at, id);

alter table public.secure_support_messages enable row level security;
revoke all on public.secure_support_messages from anon, authenticated;
grant select, insert on public.secure_support_messages to authenticated;

create policy "secure_support_messages: cliente ou admin lê"
  on public.secure_support_messages for select to authenticated
  using (
    exists (
      select 1
      from public.secure_support_threads t
      where t.id = thread_id
        and (t.customer_id = (select auth.uid()) or (select private.is_admin()))
    )
  );

create policy "secure_support_messages: participante envia ciphertext"
  on public.secure_support_messages for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and exists (
      select 1
      from public.secure_support_threads t
      where t.id = thread_id
        and t.status = 'open'
        and (t.customer_id = (select auth.uid()) or (select private.is_admin()))
    )
  );
