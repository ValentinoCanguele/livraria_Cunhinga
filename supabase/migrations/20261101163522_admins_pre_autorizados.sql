-- Administradores pré-autorizados: quando um email desta lista tiver conta confirmada
-- (registo com email ou login Google), o perfil passa automaticamente a 'admin'.
-- A lista vive só na base de dados (schema private, fora da API) e não no repositório.
create table if not exists private.admin_emails (
  email text primary key check (email = lower(email)),
  created timestamptz not null default now()
);

alter table private.admin_emails enable row level security;

create or replace function private.grant_preapproved_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email_confirmed_at is not null
     and exists (select 1 from private.admin_emails a where a.email = lower(coalesce(new.email, ''))) then
    update public.profiles set role = 'admin', updated = now()
    where id = new.id and role is distinct from 'admin';
  end if;
  return new;
end;
$$;

revoke all on function private.grant_preapproved_admin() from public, anon, authenticated;

-- Corre depois de on_auth_user_created (os triggers disparam por ordem alfabética), já com o perfil criado.
create trigger on_auth_user_preapproved_admin
  after insert or update of email_confirmed_at on auth.users
  for each row execute function private.grant_preapproved_admin();
