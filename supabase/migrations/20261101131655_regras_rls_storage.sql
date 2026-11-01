-- ---------------------------------------------------------------------------
-- Donos por omissão (antes: hooks onRecordCreate do PocketBase)
-- ---------------------------------------------------------------------------
alter table public.contacts alter column owner set default auth.uid();
alter table public.contact_groups alter column owner set default auth.uid();
alter table public.contact_campaigns alter column owner set default auth.uid();
alter table public.contact_notifications alter column owner set default auth.uid();

-- ---------------------------------------------------------------------------
-- Índices
-- ---------------------------------------------------------------------------
create unique index stock_books_book_code_key on public.stock_books (book_code) where book_code <> '';
create index stock_books_collection_id_idx on public.stock_books (collection_id);
create index orders_order_number_idx on public.orders (order_number);
create index orders_customer_email_idx on public.orders (lower(customer_email));
create index angola_municipalities_province_idx on public.angola_municipalities (province);
create index angola_localities_municipality_idx on public.angola_localities (municipality);
create index contacts_email_idx on public.contacts (lower(email));
create index contacts_external_id_idx on public.contacts (external_id);
create index contacts_owner_idx on public.contacts (owner);
create index contact_groups_owner_idx on public.contact_groups (owner);
create index contact_campaigns_owner_idx on public.contact_campaigns (owner);
create index contact_campaigns_group_idx on public.contact_campaigns ("group");
create index contact_notifications_owner_idx on public.contact_notifications (owner);
create index contact_notifications_contact_idx on public.contact_notifications (contact);
create index contact_notifications_group_idx on public.contact_notifications ("group");
create index contact_notifications_campaign_idx on public.contact_notifications (campaign);
create unique index push_subscriptions_endpoint_key on public.push_subscriptions (endpoint);
create index push_subscriptions_user_idx on public.push_subscriptions ("user");
create unique index newsletter_email_key on public.newsletter (lower(email));

-- ---------------------------------------------------------------------------
-- Campo "updated" automático
-- ---------------------------------------------------------------------------
create or replace function public.set_updated()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated := now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'profiles', 'stock_books', 'hero_slides', 'orders', 'newsletter', 'site_settings', 'payment_methods',
    'app_integrations', 'book_collections', 'physical_stores', 'angola_provinces', 'angola_municipalities',
    'angola_localities', 'contacts', 'contact_groups', 'contact_campaigns', 'contact_notifications', 'push_subscriptions'
  ] loop
    execute format('create trigger %I before update on public.%I for each row execute function public.set_updated()', t || '_set_updated', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Regras de negócio (antes: hooks do PocketBase)
-- ---------------------------------------------------------------------------
create or replace function public.normalize_drive_url(url text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare m text[];
begin
  if url is null or btrim(url) = '' then return coalesce(url, ''); end if;
  url := btrim(url);
  if url like 'blob:%' then return ''; end if;
  m := regexp_match(url, '/file/d/([a-zA-Z0-9_-]+)');
  if m is not null then return 'https://drive.google.com/uc?export=view&id=' || m[1]; end if;
  m := regexp_match(url, '[?&]id=([a-zA-Z0-9_-]+)');
  if m is not null then return 'https://drive.google.com/uc?export=view&id=' || m[1]; end if;
  return url;
end;
$$;

create or replace function public.stock_books_before_save()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if coalesce(btrim(new.book_code), '') = '' then
    new.book_code := 'LA-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 5));
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
  elsif new.stock <= 5 then
    new.stock_low := true; new.stock_alert := false;
  else
    new.stock_low := false; new.stock_alert := false;
  end if;
  return new;
end;
$$;

create trigger stock_books_before_save
  before insert or update on public.stock_books
  for each row execute function public.stock_books_before_save();

create or replace function public.hero_slides_before_save()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.image := public.normalize_drive_url(new.image);
  new.book_cover := public.normalize_drive_url(new.book_cover);
  return new;
end;
$$;

create trigger hero_slides_before_save
  before insert or update on public.hero_slides
  for each row execute function public.hero_slides_before_save();

create or replace function public.contact_campaigns_before_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.next_send_at is null then new.next_send_at := now() + interval '1 hour'; end if;
  return new;
end;
$$;

create trigger contact_campaigns_before_insert
  before insert on public.contact_campaigns
  for each row execute function public.contact_campaigns_before_insert();

-- Linha temporal automática e reposição de stock ao cancelar.
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

  if not new.stock_restored and (
    (new.status = 'cancelled' and old.status is distinct from 'cancelled') or
    (new.delivery_status = 'cancelled' and old.delivery_status is distinct from 'cancelled')
  ) then
    for it in select * from jsonb_array_elements(coalesce(new.items, '[]'::jsonb)) loop
      if coalesce(it ->> 'book_id', '') <> '' and coalesce((it ->> 'quantity')::int, 0) > 0 then
        update public.stock_books
          set stock = coalesce(stock, 0) + (it ->> 'quantity')::int
          where id = it ->> 'book_id';
      end if;
    end loop;
    new.stock_restored := true;
  end if;
  return new;
end;
$$;

create trigger orders_before_update
  before update on public.orders
  for each row execute function public.orders_before_update();

-- Checkout transaccional: bloqueia os livros, valida stock/preço, calcula totais,
-- desconta stock, soma vendas e cria a encomenda. Só o service role (Edge Function) chama.
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

create or replace function public.increment_book_views(p_id text)
returns double precision
language sql
security definer
set search_path = ''
as $$
  update public.stock_books set views_count = coalesce(views_count, 0) + 1 where id = p_id returning views_count;
$$;

revoke execute on function public.place_order(jsonb, jsonb, jsonb) from public, anon, authenticated;
revoke execute on function public.increment_book_views(text) from public, anon, authenticated;
grant execute on function public.place_order(jsonb, jsonb, jsonb) to service_role;
grant execute on function public.increment_book_views(text) to service_role;

-- ---------------------------------------------------------------------------
-- Row Level Security (equivalente às regras das colecções do PocketBase)
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'profiles', 'stock_books', 'hero_slides', 'orders', 'newsletter', 'site_settings', 'payment_methods',
    'app_integrations', 'book_collections', 'physical_stores', 'angola_provinces', 'angola_municipalities',
    'angola_localities', 'contacts', 'contact_groups', 'contact_campaigns', 'contact_notifications', 'push_subscriptions'
  ] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end;
$$;

-- profiles
create policy "profiles: ver o próprio ou staff" on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.is_staff()));
create policy "profiles: editar o próprio ou admin" on public.profiles for update to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()))
  with check (id = (select auth.uid()) or (select public.is_admin()));
create policy "profiles: admin apaga" on public.profiles for delete to authenticated
  using ((select public.is_admin()));

-- Catálogo público com gestão pela equipa
create policy "stock_books: leitura pública" on public.stock_books for select to anon, authenticated using (true);
create policy "stock_books: staff cria" on public.stock_books for insert to authenticated with check ((select public.is_staff()));
create policy "stock_books: staff edita" on public.stock_books for update to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
create policy "stock_books: staff apaga" on public.stock_books for delete to authenticated using ((select public.is_staff()));

create policy "hero_slides: activos ou staff" on public.hero_slides for select to anon, authenticated using (active or (select public.is_staff()));
create policy "hero_slides: staff cria" on public.hero_slides for insert to authenticated with check ((select public.is_staff()));
create policy "hero_slides: staff edita" on public.hero_slides for update to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
create policy "hero_slides: staff apaga" on public.hero_slides for delete to authenticated using ((select public.is_staff()));

create policy "book_collections: activas ou staff" on public.book_collections for select to anon, authenticated using (active or (select public.is_staff()));
create policy "book_collections: staff cria" on public.book_collections for insert to authenticated with check ((select public.is_staff()));
create policy "book_collections: staff edita" on public.book_collections for update to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
create policy "book_collections: staff apaga" on public.book_collections for delete to authenticated using ((select public.is_staff()));

create policy "physical_stores: activas ou staff" on public.physical_stores for select to anon, authenticated using (active or (select public.is_staff()));
create policy "physical_stores: staff cria" on public.physical_stores for insert to authenticated with check ((select public.is_staff()));
create policy "physical_stores: staff edita" on public.physical_stores for update to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
create policy "physical_stores: staff apaga" on public.physical_stores for delete to authenticated using ((select public.is_staff()));

create policy "payment_methods: activos ou staff" on public.payment_methods for select to anon, authenticated using (enabled or (select public.is_staff()));
create policy "payment_methods: staff cria" on public.payment_methods for insert to authenticated with check ((select public.is_staff()));
create policy "payment_methods: staff edita" on public.payment_methods for update to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
create policy "payment_methods: staff apaga" on public.payment_methods for delete to authenticated using ((select public.is_staff()));

-- Dados geográficos de Angola
create policy "angola_provinces: leitura pública" on public.angola_provinces for select to anon, authenticated using (true);
create policy "angola_provinces: staff cria" on public.angola_provinces for insert to authenticated with check ((select public.is_staff()));
create policy "angola_provinces: staff edita" on public.angola_provinces for update to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
create policy "angola_provinces: admin apaga" on public.angola_provinces for delete to authenticated using ((select public.is_admin()));
create policy "angola_municipalities: leitura pública" on public.angola_municipalities for select to anon, authenticated using (true);
create policy "angola_municipalities: staff cria" on public.angola_municipalities for insert to authenticated with check ((select public.is_staff()));
create policy "angola_municipalities: staff edita" on public.angola_municipalities for update to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
create policy "angola_municipalities: admin apaga" on public.angola_municipalities for delete to authenticated using ((select public.is_admin()));
create policy "angola_localities: leitura pública" on public.angola_localities for select to anon, authenticated using (true);
create policy "angola_localities: staff cria" on public.angola_localities for insert to authenticated with check ((select public.is_staff()));
create policy "angola_localities: staff edita" on public.angola_localities for update to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
create policy "angola_localities: admin apaga" on public.angola_localities for delete to authenticated using ((select public.is_admin()));

-- Encomendas: criadas só pelo checkout (service role)
create policy "orders: admin ou o próprio cliente" on public.orders for select to authenticated
  using ((select public.is_admin()) or lower(customer_email) = lower(coalesce((select auth.jwt()) ->> 'email', '')));
create policy "orders: admin edita" on public.orders for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "orders: admin apaga" on public.orders for delete to authenticated using ((select public.is_admin()));

create policy "newsletter: admin lê" on public.newsletter for select to authenticated using ((select public.is_admin()));
create policy "newsletter: admin apaga" on public.newsletter for delete to authenticated using ((select public.is_admin()));

-- Configuração (contém segredos: só equipa; o público usa a Edge Function)
create policy "site_settings: staff lê" on public.site_settings for select to authenticated using ((select public.is_staff()));
create policy "site_settings: admin cria" on public.site_settings for insert to authenticated with check ((select public.is_admin()));
create policy "site_settings: staff edita" on public.site_settings for update to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));

create policy "app_integrations: staff lê" on public.app_integrations for select to authenticated using ((select public.is_staff()));
create policy "app_integrations: staff cria" on public.app_integrations for insert to authenticated with check ((select public.is_staff()));
create policy "app_integrations: staff edita" on public.app_integrations for update to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
create policy "app_integrations: admin apaga" on public.app_integrations for delete to authenticated using ((select public.is_admin()));

-- CRM
create policy "contacts: staff ou dono lê" on public.contacts for select to authenticated using ((select public.is_staff()) or owner = (select auth.uid()));
create policy "contacts: staff ou dono cria" on public.contacts for insert to authenticated with check ((select public.is_staff()) or owner = (select auth.uid()));
create policy "contacts: staff ou dono edita" on public.contacts for update to authenticated using ((select public.is_staff()) or owner = (select auth.uid())) with check ((select public.is_staff()) or owner = (select auth.uid()));
create policy "contacts: staff apaga" on public.contacts for delete to authenticated using ((select public.is_staff()));

create policy "contact_groups: staff ou dono lê" on public.contact_groups for select to authenticated using ((select public.is_staff()) or owner = (select auth.uid()));
create policy "contact_groups: staff ou dono cria" on public.contact_groups for insert to authenticated with check ((select public.is_staff()) or owner = (select auth.uid()));
create policy "contact_groups: staff ou dono edita" on public.contact_groups for update to authenticated using ((select public.is_staff()) or owner = (select auth.uid())) with check ((select public.is_staff()) or owner = (select auth.uid()));
create policy "contact_groups: staff apaga" on public.contact_groups for delete to authenticated using ((select public.is_staff()));

create policy "contact_campaigns: staff ou dono lê" on public.contact_campaigns for select to authenticated using ((select public.is_staff()) or owner = (select auth.uid()));
create policy "contact_campaigns: staff ou dono cria" on public.contact_campaigns for insert to authenticated with check ((select public.is_staff()) or owner = (select auth.uid()));
create policy "contact_campaigns: staff ou dono edita" on public.contact_campaigns for update to authenticated using ((select public.is_staff()) or owner = (select auth.uid())) with check ((select public.is_staff()) or owner = (select auth.uid()));
create policy "contact_campaigns: staff apaga" on public.contact_campaigns for delete to authenticated using ((select public.is_staff()));

create policy "contact_notifications: staff ou dono lê" on public.contact_notifications for select to authenticated using ((select public.is_staff()) or owner = (select auth.uid()));
create policy "contact_notifications: staff ou dono cria" on public.contact_notifications for insert to authenticated with check ((select public.is_staff()) or owner = (select auth.uid()));
create policy "contact_notifications: staff edita" on public.contact_notifications for update to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
create policy "contact_notifications: staff apaga" on public.contact_notifications for delete to authenticated using ((select public.is_staff()));

create policy "push_subscriptions: o próprio lê" on public.push_subscriptions for select to authenticated using ("user" = (select auth.uid()));
create policy "push_subscriptions: o próprio edita" on public.push_subscriptions for update to authenticated using ("user" = (select auth.uid())) with check ("user" = (select auth.uid()));
create policy "push_subscriptions: o próprio apaga" on public.push_subscriptions for delete to authenticated using ("user" = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Storage: ficheiros (capas, logótipo, QR codes, imagens de lojas, avatares)
-- Caminho: <tabela>/<id do registo>/<ficheiro>
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 10485760, array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml', 'image/x-icon', 'image/vnd.microsoft.icon'])
on conflict (id) do nothing;

create policy "media: staff envia" on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and ((select public.is_staff()) or ((storage.foldername(name))[1] = 'users' and (storage.foldername(name))[2] = (select auth.uid())::text)));
create policy "media: staff actualiza" on storage.objects for update to authenticated
  using (bucket_id = 'media' and ((select public.is_staff()) or ((storage.foldername(name))[1] = 'users' and (storage.foldername(name))[2] = (select auth.uid())::text)));
create policy "media: staff apaga" on storage.objects for delete to authenticated
  using (bucket_id = 'media' and ((select public.is_staff()) or ((storage.foldername(name))[1] = 'users' and (storage.foldername(name))[2] = (select auth.uid())::text)));
create policy "media: leitura pública" on storage.objects for select to anon, authenticated
  using (bucket_id = 'media');
