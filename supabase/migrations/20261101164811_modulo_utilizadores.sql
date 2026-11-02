-- Módulo de utilizadores: permissões granulares aplicadas também na base de dados
-- e listagem única de equipa e clientes (com e sem conta) para o painel.

-- 1. Permissões ---------------------------------------------------------------
-- Administradores podem tudo; gestores só o que estiver activo em profiles.permissions;
-- membros (clientes) não têm permissões de gestão.
create or replace function private.has_permission(p_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select p.role = 'admin' or (p.role = 'manager' and coalesce(p.permissions ->> p_key, '') = 'true')
    from public.profiles p
    where p.id = auth.uid()
  ), false);
$$;

revoke all on function private.has_permission(text) from public;
grant execute on function private.has_permission(text) to anon, authenticated, service_role;

-- Encomendas: gestores com "Gerir Encomendas" passam a ver e actualizar (antes só admin).
drop policy if exists "orders: admin ou o próprio cliente" on public.orders;
create policy "orders: gestão ou o próprio cliente" on public.orders for select to authenticated
  using ((select private.has_permission('manage_orders'))
         or lower(customer_email) = lower(coalesce((select auth.jwt()) ->> 'email', '')));

drop policy if exists "orders: admin edita" on public.orders;
create policy "orders: gestão edita" on public.orders for update to authenticated
  using ((select private.has_permission('manage_orders')))
  with check ((select private.has_permission('manage_orders')));

-- Catálogo: livros, colecções e slides exigem "Gerir Catálogo".
drop policy if exists "stock_books: staff cria" on public.stock_books;
drop policy if exists "stock_books: staff edita" on public.stock_books;
drop policy if exists "stock_books: staff apaga" on public.stock_books;
create policy "stock_books: catálogo cria" on public.stock_books for insert to authenticated
  with check ((select private.has_permission('manage_catalog')));
create policy "stock_books: catálogo edita" on public.stock_books for update to authenticated
  using ((select private.has_permission('manage_catalog')))
  with check ((select private.has_permission('manage_catalog')));
create policy "stock_books: catálogo apaga" on public.stock_books for delete to authenticated
  using ((select private.has_permission('manage_catalog')));

drop policy if exists "book_collections: staff cria" on public.book_collections;
drop policy if exists "book_collections: staff edita" on public.book_collections;
drop policy if exists "book_collections: staff apaga" on public.book_collections;
create policy "book_collections: catálogo cria" on public.book_collections for insert to authenticated
  with check ((select private.has_permission('manage_catalog')));
create policy "book_collections: catálogo edita" on public.book_collections for update to authenticated
  using ((select private.has_permission('manage_catalog')))
  with check ((select private.has_permission('manage_catalog')));
create policy "book_collections: catálogo apaga" on public.book_collections for delete to authenticated
  using ((select private.has_permission('manage_catalog')));

drop policy if exists "hero_slides: staff cria" on public.hero_slides;
drop policy if exists "hero_slides: staff edita" on public.hero_slides;
drop policy if exists "hero_slides: staff apaga" on public.hero_slides;
create policy "hero_slides: catálogo cria" on public.hero_slides for insert to authenticated
  with check ((select private.has_permission('manage_catalog')));
create policy "hero_slides: catálogo edita" on public.hero_slides for update to authenticated
  using ((select private.has_permission('manage_catalog')))
  with check ((select private.has_permission('manage_catalog')));
create policy "hero_slides: catálogo apaga" on public.hero_slides for delete to authenticated
  using ((select private.has_permission('manage_catalog')));

-- Pagamentos: métodos de pagamento exigem "Pagamentos".
drop policy if exists "payment_methods: staff cria" on public.payment_methods;
drop policy if exists "payment_methods: staff edita" on public.payment_methods;
drop policy if exists "payment_methods: staff apaga" on public.payment_methods;
create policy "payment_methods: pagamentos cria" on public.payment_methods for insert to authenticated
  with check ((select private.has_permission('manage_payments')));
create policy "payment_methods: pagamentos edita" on public.payment_methods for update to authenticated
  using ((select private.has_permission('manage_payments')))
  with check ((select private.has_permission('manage_payments')));
create policy "payment_methods: pagamentos apaga" on public.payment_methods for delete to authenticated
  using ((select private.has_permission('manage_payments')));

-- Configurações: site, lojas físicas e integrações exigem "Configurações".
drop policy if exists "site_settings: staff edita" on public.site_settings;
create policy "site_settings: configurações edita" on public.site_settings for update to authenticated
  using ((select private.has_permission('manage_settings')))
  with check ((select private.has_permission('manage_settings')));

drop policy if exists "physical_stores: staff cria" on public.physical_stores;
drop policy if exists "physical_stores: staff edita" on public.physical_stores;
drop policy if exists "physical_stores: staff apaga" on public.physical_stores;
create policy "physical_stores: configurações cria" on public.physical_stores for insert to authenticated
  with check ((select private.has_permission('manage_settings')));
create policy "physical_stores: configurações edita" on public.physical_stores for update to authenticated
  using ((select private.has_permission('manage_settings')))
  with check ((select private.has_permission('manage_settings')));
create policy "physical_stores: configurações apaga" on public.physical_stores for delete to authenticated
  using ((select private.has_permission('manage_settings')));

drop policy if exists "app_integrations: staff cria" on public.app_integrations;
drop policy if exists "app_integrations: staff edita" on public.app_integrations;
create policy "app_integrations: configurações cria" on public.app_integrations for insert to authenticated
  with check ((select private.has_permission('manage_settings')));
create policy "app_integrations: configurações edita" on public.app_integrations for update to authenticated
  using ((select private.has_permission('manage_settings')))
  with check ((select private.has_permission('manage_settings')));

-- 2. Registo de notificações: novo contexto "account" (links de acesso enviados pelo painel).
alter table public.notification_logs drop constraint if exists notification_logs_context_check;
alter table public.notification_logs add constraint notification_logs_context_check
  check (context in ('order', 'receipt', 'test', 'contact', 'campaign', 'account'));

-- 3. Listagem para o painel -----------------------------------------------------
-- Junta perfis, dados de acesso (auth.users) e histórico de compras por email.
-- Clientes que compraram sem conta aparecem com role 'guest'.
-- Só a Edge Function (service role) chama; as permissões são verificadas lá.
create or replace function public.admin_users_list(
  p_scope text default 'all',
  p_search text default '',
  p_status text default 'all',
  p_limit int default 25,
  p_offset int default 0
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with order_stats as (
    select lower(o.customer_email) as email,
           count(*)::int as orders_count,
           coalesce(sum(o.total), 0)::float8 as orders_total,
           max(o.created) as last_order_at,
           (array_agg(o.customer_name order by o.created desc))[1] as last_name,
           (array_agg(o.phone order by o.created desc))[1] as last_phone
    from public.orders o
    where coalesce(o.customer_email, '') <> ''
    group by 1
  ),
  accounts as (
    select p.id::text as id,
           true as has_account,
           lower(coalesce(nullif(u.email, ''), p.email, '')) as email,
           coalesce(p.name, '') as name,
           coalesce(p.phone, '') as phone,
           coalesce(p.role, 'member') as role,
           p.permissions,
           coalesce(p.avatar, '') as avatar,
           p.created,
           u.last_sign_in_at,
           u.email_confirmed_at is not null as email_confirmed,
           (u.banned_until is not null and u.banned_until > now()) as suspended,
           coalesce((select array_agg(distinct i.provider) from auth.identities i where i.user_id = u.id), '{}'::text[]) as providers
    from public.profiles p
    join auth.users u on u.id = p.id
  ),
  guests as (
    select null::text, false, s.email, coalesce(s.last_name, ''), coalesce(s.last_phone, ''), 'guest', null::jsonb, '',
           null::timestamptz, null::timestamptz, false, false, '{}'::text[]
    from order_stats s
    where not exists (select 1 from accounts a where a.email = s.email)
  ),
  everyone as (
    select * from accounts
    union all
    select * from guests
  ),
  enriched as (
    select e.*,
           coalesce(s.orders_count, 0) as orders_count,
           coalesce(s.orders_total, 0) as orders_total,
           s.last_order_at
    from everyone e
    left join order_stats s on s.email = e.email
  ),
  q as (
    select '%' || replace(replace(replace(coalesce(trim(p_search), ''), '\', '\\'), '%', '\%'), '_', '\_') || '%' as pattern
  ),
  filtered as (
    select en.*
    from enriched en, q
    where (coalesce(p_scope, 'all') = 'all'
           or (p_scope = 'team' and en.role in ('admin', 'manager'))
           or (p_scope = 'customers' and en.role in ('member', 'guest')))
      and (coalesce(trim(p_search), '') = ''
           or en.email ilike q.pattern
           or en.name ilike q.pattern
           or en.phone ilike q.pattern)
      and (coalesce(p_status, 'all') = 'all'
           or (p_status = 'active' and en.has_account and not en.suspended)
           or (p_status = 'suspended' and en.suspended)
           or (p_status = 'guest' and not en.has_account)
           or (p_status = 'unconfirmed' and en.has_account and not en.email_confirmed)
           or (p_status = 'buyers' and en.orders_count > 0))
  ),
  page as (
    select * from filtered
    order by coalesce(last_order_at, created) desc nulls last, email
    limit greatest(1, least(coalesce(p_limit, 25), 100))
    offset greatest(0, coalesce(p_offset, 0))
  )
  select jsonb_build_object(
    'total', (select count(*) from filtered),
    'items', coalesce((select jsonb_agg(to_jsonb(page) order by coalesce(page.last_order_at, page.created) desc nulls last, page.email) from page), '[]'::jsonb),
    'summary', jsonb_build_object(
      'team', (select count(*) from accounts where role in ('admin', 'manager')),
      'admins', (select count(*) from accounts where role = 'admin'),
      'customers', (select count(*) from accounts where role = 'member'),
      'guests', (select count(*) from guests),
      'suspended', (select count(*) from accounts where suspended),
      'buyers', (select count(*) from enriched where orders_count > 0)
    )
  );
$$;

revoke all on function public.admin_users_list(text, text, text, int, int) from public, anon, authenticated;
grant execute on function public.admin_users_list(text, text, text, int, int) to service_role;
