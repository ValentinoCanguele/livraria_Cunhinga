-- Slider: agendamento (início e fim) e leitura pública só dos slides activos dentro do período.

alter table public.hero_slides
  add column if not exists starts_at timestamptz,
  add column if not exists ends_at timestamptz;

alter table public.hero_slides
  add constraint hero_slides_periodo_valido check (ends_at is null or starts_at is null or ends_at > starts_at);

drop policy if exists "hero_slides: activos ou staff" on public.hero_slides;
create policy "hero_slides: no ar ou catálogo" on public.hero_slides for select to anon, authenticated
  using (
    (active and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at > now()))
    or (select private.has_permission('manage_catalog'))
  );
