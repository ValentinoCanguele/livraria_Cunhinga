-- Duas correcções à fila, encontradas a testar as funções contra o projecto.

-- 1. `email_queue_scheduler_status` recusava o service role.
--
-- A função exigia `private.is_staff()`, que lê o utilizador do token. A Edge Function chama-a
-- com a service role, onde não há utilizador: `is_staff()` devolvia falso e a resposta era
-- sempre "Sem permissão.". O painel nunca chegava a saber se o agendador está a correr —
-- que é a única coisa que esta função diz.
--
-- Quem chega aqui pela Edge Function já passou por `requirePermission(auth, 'manage_settings')`.
-- A verificação interna continua a existir para as chamadas directas pela API, com sessão
-- de utilizador.
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
  -- A service role vem da Edge Function, que já verificou a permissão de quem pediu.
  if coalesce((select auth.role()), '') <> 'service_role'
     and not coalesce((select private.is_staff()), false) then
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

revoke execute on function public.email_queue_scheduler_status() from public, anon;
grant execute on function public.email_queue_scheduler_status() to authenticated, service_role;

-- 2. Grant explícito ao service role em `claim_email_jobs`.
--
-- Confirmado contra o projecto que a service role já conseguia chamar a função sem isto, por
-- herdar os privilégios que o Supabase lhe dá. Fica escrito à mesma: o acesso da fila deixa
-- de depender de um valor por omissão da plataforma que pode mudar sem aviso, e o ficheiro
-- passa a dizer quem pode chamar o quê.
grant execute on function public.claim_email_jobs(integer) to service_role;
