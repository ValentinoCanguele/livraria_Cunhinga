-- O agendador corria de 5 em 5 minutos sem nunca chamar nada.
--
-- Dois erros que se taparam um ao outro:
--
-- 1. **`set search_path = 'net, extensions'`**, com aspas, define *um* schema com o nome
--    literal `net, extensions`, que não existe. Confirmado contra o projecto:
--    `to_regproc('http_post')` devolve `null` com as aspas e `http_post` sem elas. A forma
--    correcta é uma lista de identificadores, sem aspas à volta do conjunto.
--
-- 2. **`exception when others then raise notice`** engolia o erro daí resultante. A função
--    terminava bem, o `pg_cron` registava `succeeded`, e `cron.job_run_details` mostrava
--    cinco execuções seguidas com sucesso enquanto nenhuma mensagem saía.
--
-- O catch-all estava lá para "não derrubar o agendador", mas não protegia nada: o `pg_cron`
-- não desactiva um job por falhar, só regista o erro. Protegia o erro de ser visto.
--
-- Agora as falhas propagam e ficam em `cron.job_run_details`, que é onde se vai procurá-las:
--
--   select status, return_message, start_time from cron.job_run_details
--    where jobid = (select jobid from cron.job where jobname = 'fila-de-emails')
--    order by start_time desc limit 10;

create or replace function private.run_email_queue()
returns void
language plpgsql
security definer
-- Lista de identificadores, sem aspas: `net` é onde o pg_net instala o `http_post`, e
-- `extensions` cobre as instalações que o puseram ali. Um schema inexistente é ignorado.
set search_path = net, extensions
as $$
declare
  v_url text;
  v_token text;
begin
  select decrypted_secret into v_url
  from vault.decrypted_secrets where name = 'email_queue_url' limit 1;

  select decrypted_secret into v_token
  from vault.decrypted_secrets where name = 'email_queue_token' limit 1;

  -- Faltar configuração não é erro: é o estado normal até alguém criar os segredos, e não
  -- deve encher `cron.job_run_details` de falhas.
  if v_url is null or v_token is null then
    raise notice 'Fila de emails: faltam os segredos email_queue_url/email_queue_token no Vault.';
    return;
  end if;

  -- Sem esperar pela resposta: o `http_post` entrega o pedido ao processo do pg_net e
  -- devolve logo. Um envio lento não pode segurar o agendador, que voltaria a disparar em
  -- cima de si mesmo.
  --
  -- Sem `exception` à volta: um erro aqui tem de aparecer em `cron.job_run_details`. Foi a
  -- falta disso que deixou o agendador a reportar sucesso durante meia hora sem enviar nada.
  perform http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-queue-token', v_token),
    body := jsonb_build_object('limit', 25),
    timeout_milliseconds := 30000
  );
end;
$$;

revoke execute on function private.run_email_queue() from public, anon, authenticated;
