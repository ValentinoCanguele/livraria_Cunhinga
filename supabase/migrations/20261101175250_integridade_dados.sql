-- Protecções de integridade na própria base de dados (valem para o painel, a API e a Edge Function).

-- Stock, preços e totais nunca negativos.
alter table public.stock_books add constraint stock_books_stock_nao_negativo check (stock is null or stock >= 0);
alter table public.stock_books add constraint stock_books_preco_nao_negativo check (price is null or price >= 0);
alter table public.orders add constraint orders_total_nao_negativo check (total >= 0);
alter table public.orders add constraint orders_portes_nao_negativos check (shipping_cost is null or shipping_cost >= 0);

-- Código do livro (SKU) único quando preenchido.
create unique index stock_books_book_code_unico on public.stock_books (book_code) where coalesce(book_code, '') <> '';

-- O email do perfil acompanha o email da conta (por exemplo, quando o cliente muda o email).
create or replace function private.sync_profile_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set email = coalesce(new.email, ''), updated = now()
  where id = new.id and coalesce(email, '') is distinct from coalesce(new.email, '');
  return new;
end;
$$;

revoke all on function private.sync_profile_email() from public, anon, authenticated;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function private.sync_profile_email();
