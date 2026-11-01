-- Regras da loja configuráveis pelo administrador (Configurações → Regras da loja).
-- A Edge Function lê estes valores e mantém-nos sempre dentro de limites seguros.
alter table public.site_settings
  add column if not exists order_number_prefix text not null default 'ENC-',
  add column if not exists checkout_notes_max integer not null default 2000,
  add column if not exists checkout_rate_per_minute integer not null default 15,
  add column if not exists track_rate_per_minute integer not null default 20,
  add column if not exists receipt_per_order_per_minute integer not null default 3;

alter table public.site_settings
  add constraint site_settings_order_prefix_valido check (order_number_prefix ~ '^[A-Z0-9-]{0,8}$'),
  add constraint site_settings_notes_max_valido check (checkout_notes_max between 0 and 5000),
  add constraint site_settings_checkout_rate_valido check (checkout_rate_per_minute between 1 and 60),
  add constraint site_settings_track_rate_valido check (track_rate_per_minute between 1 and 120),
  add constraint site_settings_receipt_rate_valido check (receipt_per_order_per_minute between 1 and 10);
