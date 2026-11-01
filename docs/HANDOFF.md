# Passagem de trabalho — Livraria Adventista

Estado em 2026-11-01. Ponto de partida para o próximo agente ou pessoa que pegue neste projecto.

## Onde está o trabalho

- **Ramo:** `claude/youthful-heisenberg-rq5gnw` (parte de `supabase/migracao`, que ainda não está no `main`).
- **PR aberto:** [ValentinoCanguele/livraria_Cunhinga#3](https://github.com/ValentinoCanguele/livraria_Cunhinga/pull/3) para o `main`. A descrição do PR tem o resumo completo e a lista de verificação antes do merge.
- **Supabase:** projecto "Livraria Adventista", ref `bggqkjjqbjhbjsckzopj`, organização "Colpotor" (plano grátis), região eu-north-1.
- **Cloudflare:** ainda não há nada criado (Workers, KV e D1 vazios; R2 não activado). O site vai para o Cloudflare Pages pelo workflow `deploy-cloudflare.yml`.

## Bloqueios (só o dono da conta resolve)

1. **A conta GitHub está bloqueada por um problema de pagamento.** Nenhum workflow do Actions arranca: a anotação diz "The job was not started because your account is locked due to a billing issue". A conta está no plano Free e não tem subscrições pagas. A causa é um cartão guardado cuja autorização falhou. A solução é remover o cartão em Settings → Faturamento e licenciamento → Informações de pagamento, ou abrir um pedido em support.github.com. As verificações do PR a vermelho são só isto; localmente, lint, build e `deno check` passam.
2. **Segredos e variáveis do GitHub Actions** (Settings → Secrets and variables → Actions):
   - Segredos: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`
   - Variáveis: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `CLOUDFLARE_PAGES_PROJECT`, `SUPABASE_PROJECT_REF` (= `bggqkjjqbjhbjsckzopj`)
3. **Supabase → Authentication:**
   - Activar o fornecedor Google, com o Client ID e o Secret da Google Cloud. O URI de redireccionamento é `https://bggqkjjqbjhbjsckzopj.supabase.co/auth/v1/callback`.
   - Pôr o domínio do site no Site URL e nos Redirect URLs.
   - A protecção contra palavras-passe vazadas exige o plano Pro; ignorar.

## O que já está feito

- **Migrações alinhadas com a base de dados:**
  - Cada ficheiro em `supabase/migrations/` tem a mesma versão e o mesmo SQL que `supabase_migrations.schema_migrations` no projecto (verificado por md5).
  - Já estão aplicadas: `base_perfis`, `tabelas`, `regras_rls_storage`, `funcoes_privadas`, `painel_vendas`, `lojas_levantamento_whatsapp`, `notification_logs`, `admins_pre_autorizados` (20261101163522), `modulo_utilizadores` (20261101164811) e `desejos_avaliacoes` (20261101165942).
- **Edge Function `app`** (`supabase/functions/app/index.ts`):
  - A versão no repositório é **mais recente** do que a publicada. Tem as rotas `/admin/users*`, `requirePermission()` e não guarda no registo os emails com links de acesso.
  - É publicada pelo `deploy-supabase.yml` depois do merge. A função publicada continua a funcionar com as migrações novas, porque usa a service role.
- **Registo de comunicações:** o painel Integrações → Logs lê `notification_logs`, onde a Edge Function grava os envios reais. Os registos simulados no Firestore foram removidos.
- **Lista de desejos e avaliações no Supabase** (tabelas `wishlists` e `book_reviews`, migração `desejos_avaliacoes`):
  - Estavam no Firestore, que deixou de reconhecer a sessão quando o login passou para o Supabase; quem tinha sessão não conseguia guardar nada.
  - Sem sessão, a lista de desejos fica no browser e passa para a conta ao iniciar sessão.
  - O nome, a foto e a "compra verificada" de cada avaliação são definidos por um trigger na base de dados.
  - Os dados antigos no Firestore não foram copiados.
- **Firestore desligado:** removidos o separador "Contactos (CRM)" antigo (lia utilizadores do Firestore), a "Coleção da Comunidade" e a cópia de arquivo do Google Workspace (guardava Gmail, Drive, etc. no Firestore). `firestore.rules` fecha tudo. O Firebase fica só para o login das ferramentas do Google Workspace.
- **Login Google pelo Supabase Auth**, em vez do Firebase:
  - O carrinho já não copia encomendas para o Firestore.
  - "Encomendas" no perfil lê só do Supabase.
  - O Firebase fica só para as ferramentas do Google Workspace.
- **Administradores:**
  - `valentinocanguele@gmail.com` e `admin@livraria.ao` são admin.
  - A tabela `private.admin_emails` (só na base de dados, fora da API) pré-autoriza emails: o perfil passa a admin quando a conta fica confirmada.
  - Há 1 email na lista, que ainda não tem conta.
  - **Não pôr emails desta lista no repositório (é público).**
- **Permissões reais:**
  - `private.has_permission(key)`: admin pode tudo; gestor só as chaves activas em `profiles.permissions`; cliente nenhuma.
  - Encomendas, catálogo, pagamentos e configurações exigem a permissão certa nas políticas RLS.
  - A mesma lógica está em `can()` e `requirePermission()` na Edge Function e em `app/web/src/lib/permissions.js`.
- **Módulo "Utilizadores e Clientes":**
  - Ficheiros: `app/web/src/components/admin/users/`, `app/web/src/lib/usersApi.js`, a função SQL `public.admin_users_list` (só service role) e as rotas `/admin/users` (listar), `/admin/users/orders`, `/create`, `/update`, `/status`, `/access-link` e `/delete`.
  - Regras: gestores com `manage_users` gerem clientes; equipa, papéis e permissões só admin; ninguém se apaga nem se suspende a si próprio; fica sempre pelo menos um administrador activo.
- **CI:**
  - `ci.yml` corre lint, build e `deno check` em cada PR.
  - Os deploys confirmam os segredos antes de começar.
  - O deploy do Cloudflare cria o projecto Pages se não existir.

## Regras para continuar

- **Migrações novas:** aplicar com a ferramenta `apply_migration` do Supabase. Depois ler a versão atribuída em `supabase_migrations.schema_migrations` e guardar o ficheiro com esse nome e **exactamente** o mesmo SQL. Se as versões não coincidirem, `supabase db push` no CI falha.
- **Testes na base de dados:** usar um bloco `do $$ … raise exception 'RESULTADO …' $$` para que tudo seja anulado no fim. Usar emails `@exemplo.invalid`.
- **Verificar antes de enviar:**
  - `npm run lint`
  - `npm run build`
  - `deno check --node-modules-dir=auto index.ts`. Correr numa cópia do ficheiro fora do repositório: dentro do repositório, o Deno carrega as dependências do site e pode ficar sem memória.
- **Edge Function grande (76 KB):** não a publicar colando o código à mão. Usar o workflow ou `npx supabase functions deploy app --project-ref bggqkjjqbjhbjsckzopj --no-verify-jwt`, com um token.
- **Commits** em português, no ramo acima. Não abrir PRs novos; o #3 está aberto.

## Próximos passos sugeridos

1. Depois de a conta GitHub ser desbloqueada, confirmar que o `ci.yml` fica verde no PR #3 e corrigir o que falhar.
2. Depois do merge, confirmar os dois deploys e testar no site:
   - login Google;
   - módulo de utilizadores (criar, editar, suspender, apagar, link de acesso);
   - um gestor com permissões parciais.
3. Limpezas pendentes:
   - a Edge Function `migrar-dados` está publicada no Supabase mas não está no repositório (provavelmente de uso único). Apagá-la só com autorização do dono;
   - testar as regras de `wishlists` e `book_reviews` na base de dados. O teste está escrito, mas o Supabase pede confirmação para o correr (cria dados fictícios numa transacção anulada no fim) e o pedido ficou sem resposta;
   - publicar `firestore.rules` no Firebase, se alguma vez lá foram publicadas regras abertas.
4. ~~Políticas de CRM com `is_staff()`~~: feito na migração `20261101170640_permissoes_crm_integracoes` (CRM com `manage_users`/`manage_marketing`; integrações e registo de comunicações só admin; ler `site_settings` exige `manage_settings`). O Storage continua com `is_staff()`.

## Limpeza de 2026-11-01

- Removidos do repositório o backend PocketBase (`app/pocketbase`, incluindo 5 cópias de bases de dados de teste), `pb_import` (as 102 capas já estão no Storage) e o script de migração. Continuam no histórico do git.
- `package.json` da raiz: sem scripts nem dependências do PocketBase; `firebase` passou para `app/web/package.json`; `workspaces` fixo em `app/web`.
- `vite.config.js`: sem o proxy `/api/pb` nem o chunk do PocketBase.
- README, `docs/ARQUITETURA.md` e `docs/LANCAMENTO.md` reescritos para Supabase + Cloudflare.
- **Segurança:** o README publicava `admin@livraria.ao` / `admin123456`, e essa palavra-passe funcionava numa conta `admin` real. A palavra-passe foi trocada por uma aleatória (não guardada) e a conta nunca tinha sido usada. As credenciais saíram da documentação, mas continuam no histórico do `main`, por isso não podem voltar a ser usadas.
