-- Livros ocultos e promoções.
-- active: livro visível na loja (os ocultos só aparecem a quem gere o catálogo e não se vendem).
-- sale_price + datas: preço promocional; o checkout cobra o preço em vigor (effective_price).

alter table public.stock_books
  add column if not exists active boolean not null default true,
  add column if not exists sale_price double precision,
  add column if not exists sale_starts_at timestamptz,
  add column if not exists sale_ends_at timestamptz;

alter table public.stock_books
  add constraint stock_books_promo_preco_valido check (sale_price is null or sale_price > 0),
  add constraint stock_books_promo_datas_validas check (sale_starts_at is null or sale_ends_at is null or sale_ends_at > sale_starts_at);

create index if not exists stock_books_active_idx on public.stock_books (active);

-- Preço em vigor de um livro. Também serve de coluna calculada na API (select=*,effective_price).
create or replace function public.effective_price(p public.stock_books)
returns double precision
language sql
stable
set search_path = ''
as $$
  select case
    when p.sale_price is not null and p.sale_price > 0 and p.sale_price < coalesce(p.price, 0)
         and (p.sale_starts_at is null or p.sale_starts_at <= now())
         and (p.sale_ends_at is null or p.sale_ends_at > now())
      then p.sale_price
    else p.price
  end;
$$;

grant execute on function public.effective_price(public.stock_books) to anon, authenticated, service_role;

-- Leitura: visitantes só vêem os livros activos; quem gere o catálogo vê todos.
drop policy if exists "stock_books: leitura pública" on public.stock_books;
create policy "stock_books: activos ou catálogo" on public.stock_books for select to anon, authenticated
  using (active or (select private.has_permission('manage_catalog')));

-- Checkout: recusa livros ocultos e cobra o preço em vigor.
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
  v_price double precision;
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
    if not coalesce(v_book.active, true) then raise exception 'Livro indisponível: %', v_book.title; end if;
    if coalesce(v_book.stock, 0) < v_qty then raise exception 'Stock insuficiente para: %', v_book.title; end if;
    -- Preço em vigor: o promocional, se estiver activo; o normal fica em list_price.
    v_price := public.effective_price(v_book);
    if coalesce(v_price, 0) <= 0 then raise exception 'Preço inválido para: %', v_book.title; end if;
    v_subtotal := v_subtotal + v_price * v_qty;
    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'book_id', v_book.id, 'title', v_book.title, 'book_code', coalesce(v_book.book_code, ''),
      'quantity', v_qty, 'price', v_price, 'list_price', v_book.price
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
