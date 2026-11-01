-- Stock, preços e totais: limite de stock baixo e prefixo de código configuráveis,
-- histórico de movimentos de stock, totais recalculados e emails normalizados.

-- 1. Configurações (Configurações → Regras da loja) --------------------------------
alter table public.site_settings
  add column if not exists low_stock_threshold integer not null default 5,
  add column if not exists book_code_prefix text not null default 'LIV-';

alter table public.site_settings
  add constraint site_settings_low_stock_valido check (low_stock_threshold between 0 and 1000),
  add constraint site_settings_book_prefix_valido check (book_code_prefix ~ '^[A-Z0-9-]{1,8}$');

-- 2. Códigos de livro sequenciais (LIV-101, LIV-102…) --------------------------------
create sequence if not exists private.book_code_seq;

do $$
declare v_max int;
begin
  select max((substring(book_code from '([0-9]+)$'))::int) into v_max
  from public.stock_books where book_code ~ '[0-9]+$';
  if coalesce(v_max, 0) > 0 then
    perform setval('private.book_code_seq', v_max, true);
  else
    perform setval('private.book_code_seq', 1, false);
  end if;
end;
$$;

-- Livros: código automático com o prefixo configurado, marcas de stock baixo/esgotado
-- com o limite configurado. Corre como definer para ler as configurações e a sequência
-- mesmo quando quem grava só tem a permissão de catálogo.
create or replace function public.stock_books_before_save()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_prefix text;
  v_threshold int;
  v_code text;
begin
  select nullif(s.book_code_prefix, ''), s.low_stock_threshold
    into v_prefix, v_threshold
  from public.site_settings s
  order by s.created asc, s.id desc
  limit 1;
  v_prefix := coalesce(v_prefix, 'LIV-');
  v_threshold := coalesce(v_threshold, 5);

  new.book_code := btrim(coalesce(new.book_code, ''));
  if new.book_code = '' then
    loop
      v_code := v_prefix || lpad(nextval('private.book_code_seq')::text, 3, '0');
      exit when not exists (select 1 from public.stock_books b where b.book_code = v_code);
    end loop;
    new.book_code := v_code;
  end if;
  if coalesce(new.sku, '') = '' then new.sku := new.book_code; end if;
  if coalesce(new.publisher, '') = '' then new.publisher := 'Livraria Adventista'; end if;
  if coalesce(new.language, '') = '' then new.language := 'Português'; end if;
  if coalesce(new.price, 0) < 0 then new.price := 0; end if;
  if coalesce(new.stock, 0) < 0 then new.stock := 0; end if;
  new.cover := public.normalize_drive_url(new.cover);
  new.author_photo := public.normalize_drive_url(new.author_photo);
  if coalesce(new.stock, 0) <= 0 then
    new.stock_alert := true; new.stock_low := false;
  elsif new.stock <= v_threshold then
    new.stock_low := true; new.stock_alert := false;
  else
    new.stock_low := false; new.stock_alert := false;
  end if;
  return new;
end;
$$;

revoke all on function public.stock_books_before_save() from public, anon, authenticated;

-- Quando o limite de stock baixo muda, as marcas de todos os livros são recalculadas.
create or replace function private.on_low_stock_threshold_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.stock_books set stock_low = stock_low;
  return new;
end;
$$;

revoke all on function private.on_low_stock_threshold_change() from public, anon, authenticated;

create trigger site_settings_low_stock_changed
  after update of low_stock_threshold on public.site_settings
  for each row
  when (old.low_stock_threshold is distinct from new.low_stock_threshold)
  execute function private.on_low_stock_threshold_change();

-- 3. Histórico de movimentos de stock -------------------------------------------------
create table public.stock_movements (
  id bigint generated always as identity primary key,
  book_id text not null references public.stock_books (id) on delete cascade,
  delta integer not null,
  stock_before integer,
  stock_after integer,
  reason text not null check (reason in ('inicial', 'venda', 'cancelamento', 'ajuste')),
  reference text not null default '',
  actor uuid references auth.users (id) on delete set null,
  created timestamptz not null default now()
);

create index stock_movements_book_idx on public.stock_movements (book_id, created desc);
create index stock_movements_actor_idx on public.stock_movements (actor);

alter table public.stock_movements enable row level security;

-- Só leitura, para quem gere o catálogo. Os registos são escritos pelo trigger.
create policy "stock_movements: catálogo lê" on public.stock_movements for select to authenticated
  using ((select private.has_permission('manage_catalog')));

create or replace function private.log_stock_movement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before numeric := case when tg_op = 'INSERT' then 0 else coalesce(old.stock, 0) end;
  v_after numeric := coalesce(new.stock, 0);
  v_reason text := nullif(current_setting('app.stock_reason', true), '');
  v_ref text := coalesce(current_setting('app.stock_ref', true), '');
begin
  if v_after = v_before then
    return new;
  end if;
  if v_reason is null then
    v_reason := case when tg_op = 'INSERT' then 'inicial' else 'ajuste' end;
  end if;
  insert into public.stock_movements (book_id, delta, stock_before, stock_after, reason, reference, actor)
  values (new.id, round(v_after - v_before)::int, round(v_before)::int, round(v_after)::int,
          v_reason, left(v_ref, 60), auth.uid());
  return new;
end;
$$;

revoke all on function private.log_stock_movement() from public, anon, authenticated;

create trigger stock_books_log_movement
  after insert or update of stock on public.stock_books
  for each row execute function private.log_stock_movement();

-- 4. Checkout: os movimentos ficam ligados ao número da encomenda ------------------------
create or replace function public.place_order(p_order jsonb, p_items jsonb, p_shipping jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  it jsonb;
  v_book public.stock_books;
  v_qty int;
  v_subtotal double precision := 0;
  v_ship double precision := 0;
  v_items jsonb := '[]'::jsonb;
  v_method text := coalesce(p_shipping ->> 'method', 'delivery');
  v_free double precision := coalesce((p_shipping ->> 'free_threshold')::double precision, 20000);
  v_std double precision := coalesce((p_shipping ->> 'cost')::double precision, 1500);
  v_exp double precision := coalesce((p_shipping ->> 'express_cost')::double precision, 0);
  v_payload jsonb;
  v_cols text;
  v_order jsonb;
begin
  -- Os movimentos de stock desta transacção ficam registados como venda desta encomenda.
  perform set_config('app.stock_reason', 'venda', true);
  perform set_config('app.stock_ref', coalesce(p_order ->> 'order_number', ''), true);

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Carrinho vazio.';
  end if;

  for it in select * from jsonb_array_elements(p_items) loop
    v_qty := least(greatest(coalesce((it ->> 'quantity')::int, 1), 1), 99);
    select * into v_book from public.stock_books where id = it ->> 'book_id' for update;
    if not found then raise exception 'Livro não encontrado.'; end if;
    if coalesce(v_book.stock, 0) < v_qty then raise exception 'Stock insuficiente para: %', v_book.title; end if;
    if coalesce(v_book.price, 0) <= 0 then raise exception 'Preço inválido para: %', v_book.title; end if;
    v_subtotal := v_subtotal + v_book.price * v_qty;
    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'book_id', v_book.id, 'title', v_book.title, 'book_code', coalesce(v_book.book_code, ''),
      'quantity', v_qty, 'price', v_book.price
    ));
    update public.stock_books
      set stock = coalesce(stock, 0) - v_qty, sales_count = coalesce(sales_count, 0) + v_qty
      where id = v_book.id;
  end loop;

  if v_exp <= 0 then v_exp := v_std * 2; end if;
  if v_method = 'pickup' then v_ship := 0;
  elsif v_method = 'express' then v_ship := greatest(v_exp, 0);
  elsif v_subtotal >= v_free then v_ship := 0;
  else v_ship := greatest(v_std, 0);
  end if;

  v_payload := p_order || jsonb_build_object(
    'id', public.gen_record_id(),
    'items', v_items,
    'shipping_cost', v_ship,
    'total', v_subtotal + v_ship
  );

  select string_agg(quote_ident(c.column_name), ', ') into v_cols
  from information_schema.columns c
  where c.table_schema = 'public' and c.table_name = 'orders' and v_payload ? c.column_name;

  execute format(
    'insert into public.orders (%s) select %s from jsonb_populate_record(null::public.orders, $1) returning to_jsonb(orders.*)',
    v_cols, v_cols
  ) into v_order using v_payload;

  return v_order;
end;
$$;


revoke execute on function public.place_order(jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.place_order(jsonb, jsonb, jsonb) to service_role;

-- 5. Encomendas: cancelamento repõe stock e vendas; total recalculado quando mudam artigos ou portes.
create or replace function public.orders_before_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  it jsonb;
  labels constant jsonb := '{"received":"Encomenda recebida","confirmed":"Encomenda confirmada","preparing":"A preparar envio","shipped":"Enviada","in_transit":"Em trânsito","out_for_delivery":"Saiu para entrega","delivered":"Entregue","cancelled":"Cancelada"}';
begin
  if coalesce(new.delivery_status, '') <> '' and new.delivery_status is distinct from old.delivery_status then
    new.delivery_timeline := coalesce(new.delivery_timeline, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
      'status', new.delivery_status,
      'title', coalesce(labels ->> new.delivery_status, new.delivery_status),
      'description', '',
      'location', coalesce(new.city, ''),
      'at', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
    ));
  end if;

  if new.items is distinct from old.items or new.shipping_cost is distinct from old.shipping_cost then
    new.total := coalesce((
      select sum(coalesce((i ->> 'price')::numeric, 0) * greatest(coalesce((i ->> 'quantity')::int, 1), 0))
      from jsonb_array_elements(case when jsonb_typeof(new.items) = 'array' then new.items else '[]'::jsonb end) i
    ), 0) + coalesce(new.shipping_cost, 0);
  end if;

  if not new.stock_restored and (
    (new.status = 'cancelled' and old.status is distinct from 'cancelled') or
    (new.delivery_status = 'cancelled' and old.delivery_status is distinct from 'cancelled')
  ) then
    perform set_config('app.stock_reason', 'cancelamento', true);
    perform set_config('app.stock_ref', coalesce(new.order_number, ''), true);
    for it in select * from jsonb_array_elements(coalesce(new.items, '[]'::jsonb)) loop
      if coalesce(it ->> 'book_id', '') <> '' and coalesce((it ->> 'quantity')::int, 0) > 0 then
        update public.stock_books
          set stock = coalesce(stock, 0) + (it ->> 'quantity')::int,
              sales_count = greatest(coalesce(sales_count, 0) - (it ->> 'quantity')::int, 0)
          where id = it ->> 'book_id';
      end if;
    end loop;
    perform set_config('app.stock_reason', '', true);
    perform set_config('app.stock_ref', '', true);
    new.stock_restored := true;
  end if;
  return new;
end;
$$;

revoke all on function public.orders_before_update() from public, anon, authenticated;

-- 6. Email do cliente nas encomendas sempre em minúsculas e sem espaços.
create or replace function private.orders_normalize_email()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.customer_email := lower(btrim(coalesce(new.customer_email, '')));
  return new;
end;
$$;

revoke all on function private.orders_normalize_email() from public, anon, authenticated;

create trigger orders_normalize_email
  before insert or update of customer_email on public.orders
  for each row execute function private.orders_normalize_email();

update public.orders set customer_email = customer_email
where customer_email is distinct from lower(btrim(coalesce(customer_email, '')));
