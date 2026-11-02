-- Livraria Adventista — esquema inicial (migração a partir do PocketBase)
-- As tabelas mantêm os nomes e colunas das colecções do PocketBase para que o
-- frontend continue a receber registos com o mesmo formato.

-- IDs no formato do PocketBase (15 caracteres a-z0-9), para manter os IDs migrados.
create or replace function public.gen_record_id()
returns text
language sql
volatile
set search_path = ''
as $$
  select string_agg(substr('abcdefghijklmnopqrstuvwxyz0123456789', (floor(random() * 36) + 1)::int, 1), '')
  from generate_series(1, 15);
$$;

-- Perfis (substitui a colecção "users" do PocketBase). O login é do Supabase Auth.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text default '',
  name text default '',
  avatar text default '',
  role text not null default 'member',
  permissions jsonb,
  phone text default '',
  pb_id text unique,
  created timestamptz not null default now(),
  updated timestamptz not null default now()
);

create or replace function public.current_role_name()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select role in ('admin', 'manager') from public.profiles where id = auth.uid()), false);
$$;

-- Cria o perfil quando um utilizador se regista.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, name, avatar)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'name', new.raw_user_meta_data ->> 'full_name', split_part(coalesce(new.email, ''), '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Impede escalada de privilégios: só administradores (ou o service role) mudam role/permissions.
create or replace function public.protect_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or public.is_admin() then
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

create trigger profiles_protect_privileges
  before insert or update on public.profiles
  for each row execute function public.protect_profile_privileges();
