-- Painel de Vendas da Loja do Huambo (pacote painel-vendas-huambo, 2026-11-01).
-- Um registo por ano com os 12 meses; documentos auxiliares (histórico e correcções) em painel_vendas_docs.
-- Leitura: administradores e gestores. Escrita: só administradores.

create table public.vendas_anos (
  ano integer primary key check (ano between 2000 and 2100),
  meses jsonb not null default '[null,null,null,null,null,null,null,null,null,null,null,null]'::jsonb
    check (jsonb_typeof(meses) = 'array' and jsonb_array_length(meses) = 12),
  observacoes jsonb not null default '["","","","","","","","","","","",""]'::jsonb
    check (jsonb_typeof(observacoes) = 'array' and jsonb_array_length(observacoes) = 12),
  mes_em_curso smallint check (mes_em_curso between 1 and 12),
  meta_anual numeric(16, 2),
  criterio text not null default 'media' check (criterio in ('media', 'tendencia', 'meta')),
  fonte text default '',
  actualizado timestamptz not null default now(),
  actualizado_por uuid references public.profiles(id) on delete set null default auth.uid()
);

create table public.painel_vendas_docs (
  path text primary key check (path in ('historico/registo', 'notas/relatorio-2025-26')),
  data jsonb not null default '{}'::jsonb,
  actualizado timestamptz not null default now()
);

create index vendas_anos_actualizado_por_idx on public.vendas_anos (actualizado_por);

alter table public.vendas_anos enable row level security;
alter table public.painel_vendas_docs enable row level security;

create policy "vendas_anos: staff lê" on public.vendas_anos for select to authenticated using ((select private.is_staff()));
create policy "vendas_anos: admin cria" on public.vendas_anos for insert to authenticated with check ((select private.is_admin()));
create policy "vendas_anos: admin edita" on public.vendas_anos for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "vendas_anos: admin apaga" on public.vendas_anos for delete to authenticated using ((select private.is_admin()));

create policy "painel_vendas_docs: staff lê" on public.painel_vendas_docs for select to authenticated using ((select private.is_staff()));
create policy "painel_vendas_docs: admin cria" on public.painel_vendas_docs for insert to authenticated with check ((select private.is_admin()));
create policy "painel_vendas_docs: admin edita" on public.painel_vendas_docs for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

-- Dados iniciais (dados/dados-painel.json)
insert into public.vendas_anos (ano, meses, observacoes, mes_em_curso, meta_anual, criterio, fonte, actualizado_por) values (2025, '[218675, 189500, 743550, 1053650, 1018225, 551909.65, 211650, 2904902, 430902, 2623345, 911316, 1101450]'::jsonb, '["", "", "", "", "", "", "", "", "", "", "", ""]'::jsonb, null, null, 'media', 'Relatório Síntese 2025/26', null);
insert into public.vendas_anos (ano, meses, observacoes, mes_em_curso, meta_anual, criterio, fonte, actualizado_por) values (2026, '[2171368, 1976988, 4956455, 3624705, 2917373, 2472331, 4779202, 3232271, 6639756, 1332925, null, null]'::jsonb, '["", "", "", "", "", "", "", "", "", "Valor do relatório (parcial). Confirmar o valor final de Outubro.", "", ""]'::jsonb, 11, null, 'media', 'Relatório Síntese 2025/26', null);
insert into public.vendas_anos (ano, meses, observacoes, mes_em_curso, meta_anual, criterio, fonte, actualizado_por) values (2027, '[null, null, null, null, null, null, null, null, null, null, null, null]'::jsonb, '["", "", "", "", "", "", "", "", "", "", "", ""]'::jsonb, null, null, 'media', '', null);
insert into public.painel_vendas_docs (path, data) values ('notas/relatorio-2025-26', '{"ano": 2026, "comparar": 2025, "itens": [{"indicador": "Total 2025", "documento": "Relatório", "anterior": 11716684.65, "chave": "total_comp"}, {"indicador": "Total 2026 (meses registados)", "documento": "Relatório", "anterior": 29470481, "chave": "total_ano"}, {"indicador": "Média mensal 2025", "documento": "Relatório e PowerPoint", "anterior": 976390.33, "chave": "media_comp"}, {"indicador": "Média mensal 2026 (meses fechados)", "documento": "Relatório", "anterior": 3266336.62, "chave": "media_ano"}, {"indicador": "Média mensal 2026 (meses fechados)", "documento": "PowerPoint", "anterior": 3293222, "chave": "media_ano"}, {"indicador": "Previsão anual 2026", "documento": "Relatório e PowerPoint", "anterior": 31294120, "chave": "previsao"}, {"indicador": "Crescimento de Setembro", "documento": "PowerPoint", "anterior": 7.142, "chave": "cresc_mes:9", "tipo": "pct"}, {"indicador": "Total 2026 Jan–Set", "documento": "PowerPoint", "anterior": 32900319, "chave": "soma_ate:9"}, {"indicador": "Crescimento Jan–Set", "documento": "PowerPoint", "anterior": 3.047, "chave": "cresc_ate:9", "tipo": "pct"}]}'::jsonb);
insert into public.painel_vendas_docs (path, data) values ('historico/registo', '{"entradas": []}'::jsonb);
