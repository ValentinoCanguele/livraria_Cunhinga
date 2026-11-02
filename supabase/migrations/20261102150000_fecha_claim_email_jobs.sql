-- Correcção de segurança: `claim_email_jobs` estava aberta a quem tivesse a chave pública.
--
-- As migrações `fila_de_emails` e `agendador_fila_emails` revogavam a execução "from anon,
-- authenticated", mas o Postgres concede `execute` a **`public`** por omissão, e `public`
-- abrange toda a gente. Revogar dos dois papéis não retira esse grant: a função continuava
-- chamável pelo PostgREST com a chave publicável do site.
--
-- O que isso permitia, confirmado contra o projecto (a chamada devolveu 200 em vez de erro
-- de permissão):
--
--   * **Ler mensagens por enviar.** A função devolve `setof email_queue`, ou seja o HTML
--     completo de cada mensagem — nome do cliente, número da encomenda, livros e morada de
--     entrega.
--   * **Travar a fila.** Cada chamada marca o lote como `sending`. Repetida, mantinha as
--     mensagens nesse estado e os clientes deixavam de receber confirmações, sem nada no
--     registo a explicar porquê.
--
-- O resto do projecto já fazia isto certo (ver `funcoes_privadas.sql`): o `public` tem de
-- constar da lista.

revoke execute on function public.claim_email_jobs(integer) from public, anon, authenticated;
revoke execute on function private.run_email_queue() from public, anon, authenticated;
revoke execute on function private.new_unsubscribe_token() from public, anon, authenticated;
revoke execute on function private.set_unsubscribe_token() from public, anon, authenticated;
revoke execute on function private.touch_email_queue() from public, anon, authenticated;

-- `email_queue_scheduler_status` continua chamável por quem tem sessão: verifica
-- `private.is_staff()` por dentro e só devolve o estado do agendador, não dados de ninguém.
-- Mas deixa de estar aberta ao `public`, para quem não tem sessão não chegar sequer à função.
revoke execute on function public.email_queue_scheduler_status() from public, anon;
grant execute on function public.email_queue_scheduler_status() to authenticated;
