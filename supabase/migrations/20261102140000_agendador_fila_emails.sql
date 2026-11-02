-- Agendador da fila de emails: `pg_cron` a chamar a Edge Function de 5 em 5 minutos.
--
-- A Edge Function não tem processo a correr entre pedidos, por isso a fila só avançava
-- quando alguém carregava em "Tentar agora" no painel. Com isto, uma mensagem que falhou às
-- três da manhã é repetida sem ninguém estar acordado.
--
-- **Esta migração nunca falha o deploy.** Cada passo está envolvido em tratamento de erro:
-- se o `pg_cron` ou o `pg_net` não estiverem disponíveis no projecto, fica um aviso no
-- registo e as migrações seguintes continuam. Uma migração que rebenta bloqueia todas as
-- outras, e o preço de a fila ficar manual é muito menor do que o de o `db push` parar.
--
-- **Não há segredos neste ficheiro** — o repositório é público. O endereço e o token são
-- lidos do Vault do Supabase em tempo de execução; ver `docs/AUTENTICACAO_E_EMAILS.md` para
-- os criar.

-- 1. Extensões. No Supabase vivem no schema `extensions`.
do $$
begin
  create extension if not exists pg_cron with schema extensions;
exception when others then
  raise notice 'pg_cron indisponível (%): a fila de emails fica manual.', sqlerrm;
end
$$;

do $$
begin
  create extension if not exists pg_net with schema extensions;
exception when others then
  raise notice 'pg_net indisponível (%): a fila de emails fica manual.', sqlerrm;
end
$$;

-- 2. A função que o agendador corre.
--
-- Lê o endereço e o token do Vault. Sem eles não faz nada e di-lo no registo: é o estado
-- normal logo após o deploy, até alguém criar os segredos.
-- `search_path` fixo com os dois schemas onde o pg_net pode estar: `net` quando a extensão
-- cria o seu próprio, `extensions` quando foi instalada ali. Um schema que não exista é
-- ignorado, por isso serve os dois casos. É fixo na definição e não herdado da sessão — que
-- é o que torna perigoso um `security definer` —, e evita ter de montar a chamada por SQL
-- dinâmico, onde o token acabaria dentro de uma string de query.
create or replace function private.run_email_queue()
returns void
language plpgsql
security definer
set search_path = 'net, extensions'
as $$
declare
  v_url text;
  v_token text;
begin
  select decrypted_secret into v_url
  from vault.decrypted_secrets where name = 'email_queue_url' limit 1;

  select decrypted_secret into v_token
  from vault.decrypted_secrets where name = 'email_queue_token' limit 1;

  if v_url is null or v_token is null then
    raise notice 'Fila de emails: faltam os segredos email_queue_url/email_queue_token no Vault.';
    return;
  end if;

  -- Nada de esperar pela resposta: o `http_post` entrega o pedido a um processo próprio e
  -- devolve logo. Um envio lento não pode segurar o agendador, que voltaria a disparar em
  -- cima de si mesmo.
  perform http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-queue-token', v_token),
    body := jsonb_build_object('limit', 25),
    timeout_milliseconds := 30000
  );
exception when others then
  -- Uma falha aqui não pode derrubar o agendador: na pior das hipóteses, perde-se um ciclo.
  -- `sqlerrm` sozinho, sem o contexto, para o token não poder aparecer no registo.
  raise notice 'Fila de emails: %', sqlerrm;
end;
$$;

revoke execute on function private.run_email_queue() from anon, authenticated;

-- 3. O agendamento.
--
-- De cinco em cinco minutos: a escada de esperas começa em 1 minuto e cresce até 3 horas,
-- por isso um ciclo mais curto só acrescentava chamadas sem nada para fazer.
do $$
begin
  -- `unschedule` do que exista, para esta migração poder voltar a correr sem duplicar.
  perform cron.unschedule('fila-de-emails');
exception when others then
  null;
end
$$;

do $$
begin
  perform cron.schedule('fila-de-emails', '*/5 * * * *', 'select private.run_email_queue();');
  raise notice 'Fila de emails agendada de 5 em 5 minutos.';
exception when others then
  raise notice 'Não foi possível agendar a fila de emails (%): fica manual pelo painel.', sqlerrm;
end
$$;

-- 4. Diagnóstico para o painel.
--
-- Responde a uma pergunta que de outra forma só se consegue por SQL: o agendador está mesmo
-- a correr, ou a fila só anda quando alguém carrega no botão? Sem isto, o painel mostrava a
-- fila a encher sem dizer porquê.
create or replace function public.email_queue_scheduler_status()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job record;
  v_has_secrets boolean := false;
begin
  if not (select private.is_staff()) then
    raise exception 'Sem permissão.';
  end if;

  begin
    select jobid, schedule, active into v_job
    from cron.job where jobname = 'fila-de-emails' limit 1;
  exception when others then
    return jsonb_build_object('available', false, 'reason', 'pg_cron indisponível');
  end;

  begin
    select count(*) = 2 into v_has_secrets
    from vault.decrypted_secrets
    where name in ('email_queue_url', 'email_queue_token');
  exception when others then
    v_has_secrets := false;
  end;

  if v_job.jobid is null then
    return jsonb_build_object('available', true, 'scheduled', false, 'secrets', v_has_secrets);
  end if;

  return jsonb_build_object(
    'available', true,
    'scheduled', coalesce(v_job.active, false),
    'schedule', v_job.schedule,
    'secrets', v_has_secrets
  );
end;
$$;

revoke execute on function public.email_queue_scheduler_status() from anon;
grant execute on function public.email_queue_scheduler_status() to authenticated;
