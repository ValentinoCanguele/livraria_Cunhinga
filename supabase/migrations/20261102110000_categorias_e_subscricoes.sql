-- Categorias de email que se podem desligar, e cancelamento de subscrição.

-- 1. Categorias.
-- Guardadas como `{"welcome": true, "order_progress": false, ...}`. Só constam aqui as que
-- a loja pode desligar: a confirmação da encomenda, o pagamento, a entrega, o cancelamento e
-- tudo o que é conta (convite, recuperação) saem sempre. São a prova de uma compra e o
-- acesso a uma conta — desligá-las seria deixar o cliente sem saber o que comprou nem como
-- entrar, e nenhum painel deve poder fazer isso por engano.
alter table public.site_settings add column if not exists email_categories jsonb;

comment on column public.site_settings.email_categories is
  'Categorias opcionais de email activas: welcome, order_progress, campaign. As transaccionais saem sempre.';

-- 2. Cancelamento de subscrição.
-- `unsubscribe_token` é o que vai no link: opaco, por contacto e revogável. Sem ele, a
-- alternativa era pôr o email no endereço, que o expõe em registos de servidor, no histórico
-- do navegador e em quem receber a mensagem reencaminhada.
alter table public.contacts add column if not exists unsubscribe_token text;
alter table public.contacts add column if not exists marketing_opt_out_at timestamptz;

create unique index if not exists contacts_unsubscribe_token_idx
  on public.contacts (unsubscribe_token)
  where unsubscribe_token is not null;

-- Token opaco de 64 caracteres: não é adivinhável e não diz nada sobre quem é o contacto.
-- Dois UUID v4 em vez do `random()` que o `gen_record_id` usa para os ids dos registos:
-- `random()` é previsível a partir do estado do gerador, e com isso alguém poderia cancelar
-- a subscrição de outra pessoa. O `gen_random_uuid` é nativo (não precisa do pgcrypto) e
-- usa a fonte de aleatoriedade do sistema.
create or replace function private.new_unsubscribe_token()
returns text
language sql
volatile
set search_path = ''
as $$
  select replace(pg_catalog.gen_random_uuid()::text, '-', '')
      || replace(pg_catalog.gen_random_uuid()::text, '-', '');
$$;

-- Cada contacto com email ganha o seu token à criação. Um contacto sem email não precisa,
-- porque não recebe campanhas por email.
create or replace function private.set_unsubscribe_token()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.unsubscribe_token is null and coalesce(new.email, '') <> '' then
    new.unsubscribe_token := private.new_unsubscribe_token();
  end if;
  return new;
end;
$$;

drop trigger if exists contacts_unsubscribe_token on public.contacts;
create trigger contacts_unsubscribe_token
  before insert or update of email on public.contacts
  for each row execute function private.set_unsubscribe_token();

-- Contactos que já existem.
update public.contacts
set unsubscribe_token = private.new_unsubscribe_token()
where unsubscribe_token is null and coalesce(email, '') <> '';

-- O token nunca sai pela API pública: quem cancela a subscrição passa pela Edge Function,
-- que usa a service role. As políticas de `contacts` continuam a ser as da migração do CRM;
-- esta coluna fica a coberto delas, e a função abaixo é a única leitura por token.
revoke execute on function private.new_unsubscribe_token() from anon, authenticated;
revoke execute on function private.set_unsubscribe_token() from anon, authenticated;
