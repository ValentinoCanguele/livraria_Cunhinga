-- Lista de desejos e avaliações de livros (antes no Firestore, que deixou de
-- reconhecer a sessão desde que o login passou para o Supabase).

-- ---------------------------------------------------------------------------
-- Lista de desejos
-- ---------------------------------------------------------------------------
create table public.wishlists (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  book_id text not null references public.stock_books (id) on delete cascade,
  created timestamptz not null default now(),
  primary key (user_id, book_id)
);

create index wishlists_book_id_idx on public.wishlists (book_id);

alter table public.wishlists enable row level security;

create policy "wishlists: o próprio vê" on public.wishlists for select to authenticated
  using (user_id = (select auth.uid()));
create policy "wishlists: o próprio adiciona" on public.wishlists for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "wishlists: o próprio remove" on public.wishlists for delete to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Avaliações
-- ---------------------------------------------------------------------------
create table public.book_reviews (
  id text primary key default public.gen_record_id(),
  book_id text not null references public.stock_books (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  user_name text not null default '',
  user_avatar text not null default '',
  rating smallint not null check (rating between 1 and 5),
  comment text not null check (char_length(comment) between 5 and 1000),
  is_verified boolean not null default false,
  created timestamptz not null default now(),
  updated timestamptz not null default now(),
  unique (book_id, user_id)
);

create index book_reviews_user_id_idx on public.book_reviews (user_id);

-- O nome, a foto e a "compra verificada" vêm do servidor; o cliente só escolhe
-- a classificação e o comentário.
create or replace function public.book_reviews_before_save()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text;
  v_name text;
  v_avatar text;
begin
  if tg_op = 'UPDATE' then
    new.book_id := old.book_id;
    new.user_id := old.user_id;
    new.created := old.created;
  end if;

  select lower(coalesce(nullif(u.email, ''), p.email, '')), coalesce(p.name, ''), coalesce(p.avatar, '')
    into v_email, v_name, v_avatar
  from auth.users u
  left join public.profiles p on p.id = u.id
  where u.id = new.user_id;

  new.user_name := left(coalesce(nullif(trim(v_name), ''), split_part(coalesce(v_email, ''), '@', 1), 'Leitor'), 100);
  new.user_avatar := coalesce(v_avatar, '');
  new.comment := trim(new.comment);
  new.is_verified := coalesce(v_email, '') <> '' and exists (
    select 1
    from public.orders o
    where lower(o.customer_email) = v_email
      and coalesce(o.status, '') not in ('cancelled', 'canceled', 'cancelada')
      and jsonb_typeof(o.items) = 'array'
      and o.items @> jsonb_build_array(jsonb_build_object('book_id', new.book_id))
  );
  new.updated := now();
  return new;
end;
$$;

revoke all on function public.book_reviews_before_save() from public, anon, authenticated;

create trigger book_reviews_before_save
  before insert or update on public.book_reviews
  for each row execute function public.book_reviews_before_save();

alter table public.book_reviews enable row level security;

create policy "book_reviews: leitura pública" on public.book_reviews for select to anon, authenticated
  using (true);
create policy "book_reviews: o próprio escreve" on public.book_reviews for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "book_reviews: o próprio edita" on public.book_reviews for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "book_reviews: o próprio ou o catálogo apaga" on public.book_reviews for delete to authenticated
  using (user_id = (select auth.uid()) or (select private.has_permission('manage_catalog')));
