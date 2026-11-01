-- Gestão de utilizadores pela base de dados (RPC), com as mesmas regras da Edge Function:
-- precisa de "Utilizadores e Clientes"; equipa, papéis e permissões só administradores;
-- ninguém se suspende, apaga ou retira o próprio acesso de admin; fica sempre um admin activo.
-- Criar contas e enviar links de acesso continuam na Edge Function (precisam da API do Auth).

create or replace function private.active_admin_count(p_exclude uuid default null)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::int
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.role = 'admin'
    and (p_exclude is null or p.id <> p_exclude)
    and (u.banned_until is null or u.banned_until <= now());
$$;

revoke all on function private.active_admin_count(uuid) from public, anon, authenticated;

-- Verifica se quem chama pode gerir a conta indicada; devolve o papel actual da conta.
create or replace function private.assert_can_manage_user(p_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role text;
begin
  if not private.has_permission('manage_users') then
    raise exception 'Sem permissão para esta operação.' using errcode = '42501';
  end if;
  select role into v_role from public.profiles where id = p_id;
  if v_role is null then
    raise exception 'Utilizador não encontrado.' using errcode = 'P0002';
  end if;
  if v_role <> 'member' and not private.is_admin() then
    raise exception 'Só administradores podem gerir contas da equipa.' using errcode = '42501';
  end if;
  return v_role;
end;
$$;

revoke all on function private.assert_can_manage_user(uuid) from public, anon, authenticated;

create or replace function public.users_admin_list(
  p_scope text default 'all', p_search text default '', p_status text default 'all',
  p_limit int default 25, p_offset int default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.has_permission('manage_users') then
    raise exception 'Sem permissão para esta operação.' using errcode = '42501';
  end if;
  return public.admin_users_list(p_scope, p_search, p_status, p_limit, p_offset);
end;
$$;

create or replace function public.users_admin_orders(p_email text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (private.has_permission('manage_users') or private.has_permission('manage_orders')) then
    raise exception 'Sem permissão para esta operação.' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', o.id, 'order_number', o.order_number, 'created', o.created, 'total', o.total,
      'status', o.status, 'payment_status', o.payment_status, 'delivery_status', o.delivery_status,
      'payment_method_name', o.payment_method_name, 'items', o.items
    ) order by o.created desc)
    from (
      select * from public.orders
      where lower(customer_email) = lower(btrim(coalesce(p_email, '')))
      order by created desc
      limit 100
    ) o
  ), '[]'::jsonb);
end;
$$;

create or replace function public.users_admin_update(
  p_id uuid, p_name text default null, p_phone text default null,
  p_role text default null, p_permissions jsonb default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current text := private.assert_can_manage_user(p_id);
  v_role text := coalesce(p_role, v_current);
  v_perms jsonb;
begin
  if p_role is not null or p_permissions is not null then
    if not private.is_admin() then
      raise exception 'Só administradores podem alterar papéis e permissões.' using errcode = '42501';
    end if;
    if v_role not in ('member', 'manager', 'admin') then
      raise exception 'Papel inválido.';
    end if;
    if p_id = auth.uid() and v_role <> 'admin' then
      raise exception 'Não pode retirar o seu próprio acesso de administrador.';
    end if;
    if v_current = 'admin' and v_role <> 'admin' and private.active_admin_count(p_id) = 0 then
      raise exception 'Tem de existir pelo menos um administrador activo.';
    end if;
    -- Só as chaves conhecidas, com valores verdadeiro/falso; só os gestores as usam.
    select coalesce(jsonb_object_agg(k, coalesce(p_permissions ->> k, '') = 'true'), '{}'::jsonb) into v_perms
    from unnest(array['manage_catalog','manage_orders','manage_settings','manage_users','manage_payments','manage_marketing']) k;
  end if;

  update public.profiles set
    name = case when p_name is not null then left(btrim(p_name), 120) else name end,
    phone = case when p_phone is not null then left(btrim(p_phone), 40) else phone end,
    role = case when p_role is not null or p_permissions is not null then v_role else role end,
    permissions = case when p_role is not null or p_permissions is not null
                       then (case when v_role = 'manager' then v_perms else null end)
                       else permissions end,
    updated = now()
  where id = p_id;
end;
$$;

create or replace function public.users_admin_set_suspended(p_id uuid, p_suspended boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text := private.assert_can_manage_user(p_id);
begin
  if p_suspended and p_id = auth.uid() then
    raise exception 'Não pode suspender a sua própria conta.';
  end if;
  if p_suspended and v_role = 'admin' and private.active_admin_count(p_id) = 0 then
    raise exception 'Tem de existir pelo menos um administrador activo.';
  end if;
  update auth.users
  set banned_until = case when p_suspended then now() + interval '100 years' else null end,
      updated_at = now()
  where id = p_id;
  if p_suspended then
    delete from auth.refresh_tokens where user_id::uuid = p_id;
    delete from auth.sessions where user_id = p_id;
  end if;
end;
$$;

create or replace function public.users_admin_delete(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text := private.assert_can_manage_user(p_id);
begin
  if p_id = auth.uid() then
    raise exception 'Não pode apagar a sua própria conta.';
  end if;
  if v_role = 'admin' and private.active_admin_count(p_id) = 0 then
    raise exception 'Tem de existir pelo menos um administrador activo.';
  end if;
  -- As encomendas ficam (estão ligadas ao email, não à conta).
  delete from auth.users where id = p_id;
end;
$$;

revoke all on function public.users_admin_list(text, text, text, int, int) from public, anon;
revoke all on function public.users_admin_orders(text) from public, anon;
revoke all on function public.users_admin_update(uuid, text, text, text, jsonb) from public, anon;
revoke all on function public.users_admin_set_suspended(uuid, boolean) from public, anon;
revoke all on function public.users_admin_delete(uuid) from public, anon;
grant execute on function public.users_admin_list(text, text, text, int, int) to authenticated;
grant execute on function public.users_admin_orders(text) to authenticated;
grant execute on function public.users_admin_update(uuid, text, text, text, jsonb) to authenticated;
grant execute on function public.users_admin_set_suspended(uuid, boolean) to authenticated;
grant execute on function public.users_admin_delete(uuid) to authenticated;
