-- Limites de pedidos partilhados entre instâncias da Edge Function.
--
-- O limite anterior vivia num objecto em memória de cada isolate. As Edge Functions
-- escalam horizontalmente e reciclam os isolates, por isso o limite era por instância e
-- perdia-se a cada arranque a frio: na prática não limitava nada. Protegia o /chat (gasto
-- directo na chave de IA), o /checkout e o /track (enumeração de encomendas).
--
-- Passa a ser uma janela deslizante na base de dados, partilhada por todas as instâncias.

create table if not exists private.rate_limits (
  bucket text not null,
  client text not null,
  window_start timestamptz not null,
  hits int not null default 0,
  primary key (bucket, client, window_start)
);

comment on table private.rate_limits is
  'Janela de pedidos por rota e cliente (IP ou chave). Escrita só pela service role.';

-- Conta o pedido e diz se ainda está dentro do limite. Uma ida à base de dados, sem
-- corrida: o insert ... on conflict devolve o total já incrementado.
create or replace function private.check_rate_limit(
  p_bucket text,
  p_client text,
  p_max int,
  p_window interval default interval '1 minute'
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_start timestamptz := date_bin(p_window, now(), timestamptz 'epoch');
  v_hits int;
begin
  insert into private.rate_limits (bucket, client, window_start, hits)
  values (left(coalesce(p_bucket, ''), 40), left(coalesce(p_client, 'anon'), 80), v_start, 1)
  on conflict (bucket, client, window_start)
    do update set hits = private.rate_limits.hits + 1
  returning hits into v_hits;

  -- Limpeza preguiçosa das janelas antigas, sem precisar de cron.
  if v_hits = 1 and random() < 0.01 then
    delete from private.rate_limits where window_start < now() - (p_window * 10);
  end if;

  return v_hits <= greatest(p_max, 1);
end;
$$;

revoke all on function private.check_rate_limit(text, text, int, interval) from public, anon, authenticated;
grant execute on function private.check_rate_limit(text, text, int, interval) to service_role;

-- A Edge Function chama-a pela API REST, e o PostgREST só expõe o schema public.
create or replace function public.check_rate_limit(
  p_bucket text,
  p_client text,
  p_max int
)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select private.check_rate_limit(p_bucket, p_client, p_max, interval '1 minute');
$$;

revoke all on function public.check_rate_limit(text, text, int) from public, anon, authenticated;
grant execute on function public.check_rate_limit(text, text, int) to service_role;
