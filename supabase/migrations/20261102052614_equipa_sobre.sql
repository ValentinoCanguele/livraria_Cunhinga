-- Equipa mostrada na página "Sobre", por baixo da história.
--
-- Lista de pessoas, cada uma com nome, função e fotografia:
--   [{"name": "...", "role": "...", "photo_url": "https://..."}]
--
-- Vazio ou ausente = a secção não aparece no site. Editável em
-- Configurações → Página Sobre → Equipa.

alter table public.site_settings
  add column if not exists about_team jsonb;

comment on column public.site_settings.about_team is
  'Equipa na página Sobre: [{name, role, photo_url}]. Vazio = secção escondida.';

-- Só aceita um array (ou nulo): o site percorre-o, e um objecto solto partiria a página.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'site_settings_about_team_array'
  ) then
    alter table public.site_settings
      add constraint site_settings_about_team_array
      check (about_team is null or jsonb_typeof(about_team) = 'array');
  end if;
end
$$;
