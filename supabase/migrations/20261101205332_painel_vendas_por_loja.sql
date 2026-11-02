-- Painel de Vendas por loja: cada loja física passa a ter os seus anos, histórico e notas.
-- Os dados que já existiam eram da Loja do Huambo e ficam ligados a essa loja
-- (criada inactiva, sem levantamentos, se ainda não existir; os dados editam-se no separador Lojas).
-- Uma loja com vendas registadas não pode ser apagada (on delete restrict).

do $$
declare
  v_loja text;
begin
  select id into v_loja
  from public.physical_stores
  where province ilike 'huambo' or name ilike '%huambo%'
  order by active desc, created
  limit 1;

  if v_loja is null then
    insert into public.physical_stores (name, province, address, active, pickup_enabled)
    values ('Livraria Adventista — Huambo', 'Huambo', 'Huambo', false, false)
    returning id into v_loja;
  end if;

  alter table public.vendas_anos add column loja_id text references public.physical_stores (id) on delete restrict;
  update public.vendas_anos set loja_id = v_loja;

  alter table public.painel_vendas_docs drop constraint painel_vendas_docs_path_check;
  update public.painel_vendas_docs set path = v_loja || '/' || path;
end $$;

alter table public.vendas_anos alter column loja_id set not null;
alter table public.vendas_anos drop constraint vendas_anos_pkey;
alter table public.vendas_anos add constraint vendas_anos_pkey primary key (loja_id, ano);

-- Documentos por loja: <id da loja>/historico/registo e <id da loja>/notas/<nome>.
alter table public.painel_vendas_docs add constraint painel_vendas_docs_path_check
  check (path ~ '^[a-z0-9]{15}/(historico/registo|notas/[a-z0-9-]{1,40})$');
