-- Lojas físicas: escolher que lojas aceitam levantamento de encomendas e ter WhatsApp próprio.
alter table public.physical_stores add column pickup_enabled boolean not null default true;
alter table public.physical_stores add column whatsapp text default '';
