-- Funções auxiliares fora da API pública (/rest/v1/rpc).
-- As políticas RLS referem-se às funções pelo OID, por isso continuam a funcionar depois de mudarem de schema.
create schema if not exists private;
grant usage on schema private to anon, authenticated, service_role;

-- current_role_name() não é usada pela app: fica sem acesso pela API.
revoke execute on function public.current_role_name() from public, anon, authenticated;

alter function public.is_admin() set schema private;
alter function public.is_staff() set schema private;
grant execute on function private.is_admin() to anon, authenticated, service_role;
grant execute on function private.is_staff() to anon, authenticated, service_role;

create or replace function public.protect_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or private.is_admin() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.role := 'member';
    new.permissions := null;
  else
    new.role := old.role;
    new.permissions := old.permissions;
    new.email := old.email;
  end if;
  return new;
end;
$$;

-- Funções de trigger não precisam de EXECUTE para os papéis da API.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.protect_profile_privileges() from public, anon, authenticated;
revoke execute on function public.orders_before_update() from public, anon, authenticated;
revoke execute on function public.stock_books_before_save() from public, anon, authenticated;
revoke execute on function public.hero_slides_before_save() from public, anon, authenticated;
revoke execute on function public.contact_campaigns_before_insert() from public, anon, authenticated;
revoke execute on function public.set_updated() from public, anon, authenticated;
