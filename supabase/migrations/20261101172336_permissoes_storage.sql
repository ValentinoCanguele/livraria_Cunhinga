-- Storage (bucket "media"): enviar, substituir ou apagar ficheiros exige a permissão da área
-- a que a pasta pertence (antes bastava ser gestor). A leitura continua pública.

create or replace function private.can_write_media(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case (storage.foldername(p_name))[1]
    when 'stock_books' then private.has_permission('manage_catalog')
    when 'book_collections' then private.has_permission('manage_catalog')
    when 'hero_slides' then private.has_permission('manage_catalog')
    when 'site_settings' then private.has_permission('manage_settings')
    when 'physical_stores' then private.has_permission('manage_settings')
    when 'payment_methods' then private.has_permission('manage_payments')
    -- Avatares: o próprio, ou quem gere utilizadores.
    when 'users' then (storage.foldername(p_name))[2] = (select auth.uid())::text
                      or private.has_permission('manage_users')
    else private.is_admin()
  end;
$$;

revoke all on function private.can_write_media(text) from public;
grant execute on function private.can_write_media(text) to authenticated, service_role;

drop policy if exists "media: staff envia" on storage.objects;
drop policy if exists "media: staff actualiza" on storage.objects;
drop policy if exists "media: staff apaga" on storage.objects;

create policy "media: envia com permissão" on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and private.can_write_media(name));
create policy "media: actualiza com permissão" on storage.objects for update to authenticated
  using (bucket_id = 'media' and private.can_write_media(name))
  with check (bucket_id = 'media' and private.can_write_media(name));
create policy "media: apaga com permissão" on storage.objects for delete to authenticated
  using (bucket_id = 'media' and private.can_write_media(name));
