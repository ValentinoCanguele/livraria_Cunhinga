# Passagem de trabalho — Livraria Adventista

Estado em 2026-11-01. Ponto de partida para o próximo agente ou pessoa que pegue neste projecto.

## Onde está o trabalho

- **Ramo:** `claude/youthful-heisenberg-rq5gnw` (parte de `supabase/migracao`, que ainda não está no `main`).
- **PR aberto:** [ValentinoCanguele/livraria_Cunhinga#3](https://github.com/ValentinoCanguele/livraria_Cunhinga/pull/3) para o `main`. A descrição do PR tem o resumo completo e a lista de verificação antes do merge.
- **Supabase:** projecto "Livraria Adventista", ref `bggqkjjqbjhbjsckzopj`, organização "Colpotor" (plano grátis), região eu-north-1.
- **Cloudflare Pages:** projecto `livraria-adventista` (conta canguelev@fata.adventist.org), ramo de produção `main`.
  - Produção em https://livraria-adventista.pages.dev, com o código do PR #3. Foi publicada à mão com o Wrangler porque o Actions está bloqueado.
  - Cada ramo tem o seu URL de pré-visualização (`<ramo>.livraria-adventista.pages.dev`, ver `wrangler pages deployment list`). O `main` antigo (PocketBase) está em `main-pocketbase`, e esse e os ramos `cursor/*` não têm backend.
  - Publicar à mão: `npm run deploy:site` (produção) ou `npm run deploy:site -- --preview`. O script recusa publicar se o HEAD não for a ponta do ramo remoto, faz lint e build, publica e confirma que o último deploy de produção é esse commit e que o site responde. Várias sessões publicam no mesmo projecto: nunca publicar um build antigo. As variáveis `VITE_SUPABASE_*` vêm de `app/web/.env`.
  - Workers, KV, D1 e R2 continuam por usar.

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
- **Painel de Vendas da Loja do Huambo** (pacote `painel-vendas-huambo`):
  - É o separador Relatórios › Vendas Huambo do Painel Admin (`/admin?tab=vendas-huambo`); os links antigos `/painel-vendas(.html)` vão para lá.
  - O HTML, o CSS e o script do pacote estão em `app/web/src/painel-vendas/` quase sem alterações e correm num Shadow DOM (`components/admin/VendasHuamboTab.jsx`), para manter o design original sem misturar com o Tailwind. Segue o tema claro/escuro do sistema.
  - Dados em `vendas_anos` e `painel_vendas_docs` (migração `painel_vendas`): gestores e administradores lêem, só administradores gravam (RLS). A senha local do pacote foi substituída pela sessão de administrador.
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

## Análise crítica e correcções (2026-11-01, segunda passagem)

Detalhe em `docs/AUDITORIA.md`, secção 9.1. Em resumo:

- **O gate de qualidade passou a existir.** O ESLint tinha `no-undef` e `no-unused-vars` em
  `off` e corria com `--quiet`. Estão a erro, e há 14 testes (`npm test`, vitest + jsdom)
  ligados ao `ci.yml` e ao `scripts/deploy-site.sh`. Ao ligá-lo apareceram três bugs reais —
  entre eles o `autoCode` do `BookFormModal`, que **rebentava o formulário de livro novo**.
  Não voltar a desligar estas regras: era por aqui que passavam os erros que só apareciam no
  browser.
- **Sanitização de HTML** com lista branca explícita no DOMPurify, testada contra os bypasses
  do sanitizador antigo.
- **`/track` já não devolve a imagem da assinatura** (só `delivery_signature_present`).
- **O `/admin` já não descarrega todas as encomendas com `select *`**: usa `ORDER_LIST_FIELDS`
  e lê a assinatura só da encomenda cujo recibo se emite.
- **Carregamento inicial de 580 para 331 KB gzip.** O `manualChunks` à mão era a causa;
  ficou só `vendor-react`. O Firebase é import dinâmico e perdeu o SDK do Firestore.
- **Edge Function publicada** (a CLI desta máquina está autenticada, ao contrário do que a
  primeira passagem concluiu). `/admin/users` e `/contacts/*` voltaram a responder.

Terceira leva, também publicada e verificada: service worker com a navegação em rede
primeiro (acabou o risco de página em branco depois de publicar), `app/web/public/_headers`
com os cabeçalhos de segurança, `robots.txt`/`sitemap.xml`/`og:`, e a permissão verificada
antes da consulta nas rotas `/admin/users/*` (davam 404 vs 403 e diziam que ids existiam).

**Resolvido (2026-11-02):** a migração `limites_pedidos` (limite de pedidos partilhado, em vez de em memória por isolate) foi aplicada pelo MCP e o ficheiro passou a `20261102013223_limites_pedidos.sql`, com o mesmo SQL (md5 igual ao de `schema_migrations`). Testado: com limite 2, o terceiro pedido é recusado, e `anon` não pode chamar `check_rate_limit`. A Edge Function passa a usar o limite partilhado quando a versão nova for publicada.

## Galeria de imagens aplicada (2026-11-02)

A galeria tem 41 imagens em 6 tipos, mas só 3 tipos tinham onde ser escolhidos, e o banner
da loja nunca chegava a aparecer.

- **Banner da loja aplicado.** `loja-banner.webp` era publicado com o site mas o fundo da
  loja ficava em gradiente: a coluna `shop_bg_mode` estava nula e a Edge Function caía em
  `"gradient"`. Passa a ser a predefinição (`DEFAULT_SHOP_BG`), com as predefinições do
  frontend a condizer. Verificado em produção: a API devolve `shop_bg_mode: image` e o
  banner aparece em `/shop`, com o texto e os indicadores legíveis por cima do véu.
  Continua a poder ser mudado em Configurações → Fundo da loja.
- **Tipo `capa`** ligado à "Capa do Livro" e à capa promocional dos slides.
- **Página Sobre editável** (migração `20261102050825_imagens_sobre`, já aplicada): as duas
  imagens estavam escritas no código. Agora vêm das definições, com as do site como
  predefinição, e aparecem em Configurações com a galeria.
  O `SettingsTab` só mostra e grava esses campos quando as colunas existem
  (`'about_top_image_url' in r`): enviá-los sem a migração faria o PostgREST recusar o
  registo inteiro e partir o gravar das Configurações. Manter essa verificação ao
  acrescentar campos novos.
- **Limite de pedidos partilhado confirmado a funcionar**: 22 pedidos seguidos ao `/track`
  dão 20× 404 e 2× 400, ou seja corta exactamente no `trackRate` configurado, sem nenhum
  500.

Por escolher (são decisões de imagem, não de código): quais das opções da galeria ficam nos
slides, nos banners e nas capas das colecções. As capas das 4 colecções ainda apontam para
fotos genéricas do Unsplash.

## Cabeçalho, equipa e rodapé (2026-11-02)

- **"Sobre" no cabeçalho**, no menu principal (link simples, como o "Início") e no menu do
  telemóvel. Confirmado no site publicado.
- **Secção "A Nossa Equipa"** na página Sobre, por baixo da história: fotografia redonda,
  nome e função, 2–4 por linha. **Sem ninguém na lista a secção não aparece**, e é esse o
  estado actual — os nomes, funções e fotografias são dados de pessoas reais e não foram
  inventados. Preenche-se em **Configurações → Marca → "Equipa na página Sobre"**
  (acrescentar, remover, subir, descer; fotografia por URL ou envio). Migração
  `20261102052614_equipa_sobre`, já aplicada (coluna `about_team` confirmada por
  `GET /rest/v1/site_settings?select=about_team` = 200).
  A rota pública `/settings` limita o que devolve: 40 pessoas, 120 caracteres por campo, e
  fotografia só se for http(s) ou caminho do próprio site.
- **Rodapé** com três colunas revistas, só com caminhos que existem: apoio (rastreio,
  envios, FAQ, contacto, lojas), comprar (catálogo, coleções, levantamento, pagamento na
  entrega, sobre) e conta (entrar, encomendas, lista de desejos, dados, segurança).
- **Rodapé com funções, não só links** (bloco entre as colunas e as lojas):
  - *Rastrear encomenda* ali mesmo — número e email, e o `/track` abre já preenchido
    (via `location.state`, como vindo do checkout). Testado no site publicado: leva a
    `/track` com o número no campo.
  - *Como compra e recebe* — limiar de portes grátis lido das Configurações, levantamento
    em loja quando alguma loja o tem activo, assinatura na recepção, e WhatsApp directo
    quando há número.
  - *Pagamentos aceites* — os métodos activos, pela mesma rota pública do checkout, para
    não ser uma lista à mão que fica velha. Atenção: `getPaymentMethods()` devolve
    `{ methods }`, não um array.
- **O perfil aceita o separador no URL** (`/profile?tab=wishlist`), como o painel já fazia.
  É o que permite aos atalhos do rodapé abrirem já na secção certa.

### Por correr (dados, não esquema)

`docs/migracoes-pendentes/2_capas_das_colecoes.sql` troca as capas das quatro colecções —
hoje fotos genéricas do Unsplash — por imagens feitas com as capas reais do catálogo,
escolhidas pelo tema de cada uma. Corre-se no SQL Editor do Supabase (o `db push` é só para
esquema). Em alternativa, dá-se dois cliques por colecção em Admin → Colecções → Capa →
aba Galeria.

## Checkout no telemóvel (2026-11-02)

Medido no site publicado, num ecrã de 375×812 (viewport útil 886 px):

| | Antes | Depois |
|---|---|---|
| Rodapé do carrinho | 485 px | 303 px |
| Janela do formulário | 288 px | 469 px |
| Conteúdo do formulário | 2094 px | 2094 px |

O cliente preenchia morada, pagamento e assinatura por uma frincha de 288 px.

- O detalhe do rodapé (avisos, selos, progresso de portes, subtotal e selector de envio)
  passa a ficar atrás de uma barra **"Ver resumo e portes"**, que já mostra o total. O Total
  e os botões ficam sempre à vista. Confirmado que abre e fecha: fechado 469 px, aberto
  276 px com o subtotal e os portes visíveis — nada ficou inacessível.
- **No computador (`sm:`) está tudo aberto, exactamente como antes.** As alterações são de
  disposição e área tocável; não houve mudanças de cor, tipo de letra ou forma dos cartões.
- **Pagamentos:** o cartão inteiro passa a seleccionar o método (antes só o texto e o botão
  de rádio respondiam ao toque — confirmado a tocar fora do texto, o método muda). A
  referência e o QR deixam de ser indentados em ecrã estreito.
- O tipo do método deixou de aparecer cru (`p2p`, `offline`, `transfer`): mostra **"paga
  antes do envio"** ou **"paga na entrega"**, pela mesma regra que o servidor usa para
  exigir referência.

### Dado por preencher, visível ao cliente

A "Transferência Bancária" mostra no checkout `IBAN: AO06 0000 0000 0000 0000 0000 0` —
o valor de exemplo, todo a zeros. Quem escolher transferência vê um IBAN falso. Corrigir em
**Admin → Pagamentos**. (Verifiquei que não é corte de layout: o texto cabe e é mesmo este o
valor guardado.)

## Catálogo: páginas e cartões mais limpos (2026-11-02)

- **Páginas a sério.** O catálogo não paginava: o "Carregar mais" acumulava
  24 → 48 → 72 → 102 livros na mesma página. Passa a páginas de `shop_per_page`: no
  computador os números com "…" à volta da actual; no telemóvel só "Página 2 de 5" entre as
  setas (uma fila de números não cabe). Mudar de página volta ao topo da lista; filtrar ou
  ordenar volta à primeira. O contador diz "A mostrar 25–48 de 102".
- **Ícones em vez de autocolantes.** O mesmo cartão dizia o stock **quatro** vezes: marca
  cor-de-rosa a pulsar na imagem, faixa do admin ("ÚLTIMAS UNIDADES"), etiqueta ao lado do
  preço ("Baixo Estoque · 3 un.") e ainda "Últimas 3". Agora: uma marca redonda por estado
  na imagem (estrela = destaque, triângulo = poucas unidades), com `title` e texto para
  leitores de ecrã; a faixa do admin só aparece se acrescentar alguma coisa (não é mostrada
  quando é só "Destaque", que repete a estrela, nem quando há aviso de stock); e o número de
  unidades aparece uma só vez, junto ao preço ("Restam 3").
- **Cartão deixou de transbordar.** Medido: cartão de 160 px com 209 px de conteúdo — os
  dois botões lado a lado não cabiam e o preço partia em duas linhas. Em ecrã estreito fica
  só "Comprar" (tocar no cartão já abre o livro); a partir de `sm:` continuam os dois. A
  linha do preço pode quebrar. Confirmado em produção: nenhum dos cartões transborda.

Cores, tipos de letra e forma dos cartões ficaram como estavam.

## Checkout por método de entrega (2026-11-02)

Até aqui os dois métodos exigiam o mesmo, e quem ia buscar à loja assinava um comprovativo
de entrega de uma entrega que não existe.

| | Levantamento na loja | Entrega ao domicílio |
|---|---|---|
| Conta | não precisa | **obrigatória** |
| Nome e telefone | obrigatórios | obrigatórios |
| Email | opcional (recibo) | obrigatório |
| Morada | não pede | obrigatória |
| Assinatura | **não pede** | obrigatória |
| GPS | — | opcional, botão "Usar a minha localização" |

Verificado em produção, sem sessão:

- entrega sem email → `Email obrigatório para entrega ao domicílio.`
- levantamento sem email, morada nem assinatura → passa a validação
- levantamento sem nome → `Nome obrigatório.`
- na interface: ao escolher levantamento desaparecem a assinatura e a morada, o email fica
  marcado como opcional e o botão de confirmar desbloqueia; na entrega sem sessão o aviso
  aparece e o botão fica bloqueado.

A regra está nos dois lados: o cliente explica, o servidor decide.

**GPS:** as colunas `delivery_gps_lat/lng` existiam desde o início e **nunca eram
escritas**. Passam a ser preenchidas quando o comprador partilha a localização (mesmo padrão
da página das lojas). Em Angola a morada é muitas vezes uma referência, e o estafeta ficava
sem o ponto exacto.

### Funções subentendidas e repetidas (por limpar)

Encontradas a confirmar o ponto acima. Não foram mexidas — mexer no esquema das encomendas
é arriscado e merece uma decisão:

- **Três campos para o método de pagamento:** `payment_method` (herdado, só preenchido para
  "entrega" e "transferencia"), `payment_method_code` e `payment_method_name`. Quem lê tem
  de tentar os três em cadeia (ver `receipt.js`). Deviam ser um `code` + o nome resolvido na
  leitura.
- **`order_type` é derivado de `sale_channel`** (`whatsapp_order` ⇔ `whatsapp`): dois campos
  para a mesma verdade, que podem divergir.
- **`payment_category`:** zero utilizações na Edge Function, uma no site. Coluna morta.
- **`delivery_recipient_id`:** o `/confirm-delivery` guarda o número do documento de quem
  recebe, e **nada o lê**. É recolher um documento de identificação sem uso — ou passa a
  aparecer no painel, ou deixa de ser pedido.
- **Morada em dobro:** `address`/`city` convivem com `delivery_address_full`,
  `delivery_municipality` e companhia.

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
   - a Edge Function `migrar-dados` (já só responde 410) é apagada pelo `deploy-supabase.yml` no primeiro deploy depois do merge, com autorização do dono;
   - ~~testar as regras de `wishlists` e `book_reviews`~~: testado. Cada cliente só vê e altera os seus desejos e avaliações; os visitantes lêem avaliações mas não escrevem; o nome vem do perfil (não do cliente) e "compra verificada" só é dada a quem comprou o livro;
   - publicar `firestore.rules` no Firebase, se alguma vez lá foram publicadas regras abertas.
4. ~~Políticas de CRM com `is_staff()`~~: feito na migração `20261101170640_permissoes_crm_integracoes` (CRM com `manage_users`/`manage_marketing`; integrações e registo de comunicações só admin; ler `site_settings` exige `manage_settings`). O Storage passou a exigir a permissão da pasta (`private.can_write_media`, migração `20261101172336_permissoes_storage`).

## Limpeza de 2026-11-01

- Removidos do repositório o backend PocketBase (`app/pocketbase`, incluindo 5 cópias de bases de dados de teste), `pb_import` (as 102 capas já estão no Storage) e o script de migração. Continuam no histórico do git.
- `package.json` da raiz: sem scripts nem dependências do PocketBase; `firebase` passou para `app/web/package.json`; `workspaces` fixo em `app/web`.
- `vite.config.js`: sem o proxy `/api/pb` nem o chunk do PocketBase.
- README, `docs/ARQUITETURA.md` e `docs/LANCAMENTO.md` reescritos para Supabase + Cloudflare.
- **Segurança:** o README publicava `admin@livraria.ao` / `admin123456`, e essa palavra-passe funcionava numa conta `admin` real. A palavra-passe foi trocada por uma aleatória (não guardada) e a conta nunca tinha sido usada. As credenciais saíram da documentação, mas continuam no histórico do `main`, por isso não podem voltar a ser usadas.

## Edge Function `app` — revisão de segurança (2026-11-01)

Ainda não publicada; vai no deploy depois do merge.

- `/whatsapp/receipt`:
  - exige o email da encomenda;
  - envia só para o telefone registado na encomenda;
  - o texto é montado no servidor (antes aceitava texto e telefone vindos do browser, o que permitia enviar mensagens pelo número oficial da loja);
  - no máximo 3 recibos por encomenda e por minuto.
- `/track` e `/confirm-delivery`: limite de pedidos por IP; a assinatura fica limitada a cerca de 600 KB.
- `/contacts/*`: exige `manage_users` ou `manage_marketing`. `/admin/email/test` e `/admin/whatsapp/test`: exigem `manage_settings`. `requireStaff` foi removida.
- `/settings`, `/messaging/status`, `/push/config` e `/integrations` só devolvem dados públicos (verificado).
- `/checkout`:
  - o método de pagamento tem de estar activo em `payment_methods`, e a encomenda guarda `payment_method_name`;
  - o número de encomenda passa a `ENC-` + hora + 3 caracteres aleatórios;
  - o envio fica limitado a `delivery`/`express`/`pickup`, e todos os textos têm tamanho máximo.
- `/push/subscribe`: limite de pedidos, endpoint `https` obrigatório e chaves validadas.
- Dados: `payment_methods` tem 3 linhas `unitel_money` repetidas (todas desactivadas). Limpar no painel antes de as activar.

## Integridade e regras configuráveis (2026-11-01)

- Migração `20261101175250_integridade_dados`:
  - stock, preços, totais e portes não podem ser negativos;
  - `book_code` é único quando preenchido;
  - o email do perfil acompanha o da conta (`private.sync_profile_email`).
- Migração `20261101175332_regras_loja`: novos campos em `site_settings`, editáveis em **Configurações → Regras da loja**:
  - `order_number_prefix`;
  - `checkout_notes_max`;
  - `checkout_rate_per_minute`;
  - `track_rate_per_minute`;
  - `receipt_per_order_per_minute`.

  Cada campo tem um limite seguro na base de dados, no painel e na Edge Function (`storeRules`).
- Métodos de pagamento no checkout: só os activos em Pagamentos. Se não houver nenhum activo, aceita "entrega".
- Stock em 2026-11-01: 84 dos 102 livros com 1 a 4 unidades e 12 esgotados.
- Migração `20261101180003_stock_precos_totais`:
  - limite de stock baixo (`low_stock_threshold`) e prefixo de código (`book_code_prefix`) configuráveis em Regras da loja;
  - códigos de livro sequenciais (`private.book_code_seq`: o próximo é LIV-101);
  - `stock_movements`, com o histórico de cada mudança de stock (inicial, venda com o nº da encomenda, cancelamento, ajuste com o autor). Só leitura para `manage_catalog`; aparece em Livro → Métricas;
  - o total da encomenda é recalculado quando mudam os artigos ou os portes;
  - o cancelamento repõe o stock e desconta `sales_count`;
  - `customer_email` fica sempre em minúsculas.
- O site usa só as marcas `stock_low` e `stock_alert` da base de dados (antes misturava "< 5" e "<= 5"). O botão "Marcar resolvido", que não resolvia nada, passou a "Repor stock" e abre o livro.


## Livros, imagens e encomendas — correcções (2026-11-01, sessão local)

- **Guardar livro voltou a funcionar:** o formulário enviava `compras`, `lido`, `baixados` e `vendidos`, que não existem em `stock_books`. A aba Métricas mostra agora `sales_count` e `views_count`. Ao mexer em formulários, valida que todas as chaves existem: `GET /rest/v1/<tabela>?select=<chaves>&limit=1` tem de devolver 200.
- **Upload de imagens do computador:** em livros, slider e configurações a imagem perdia-se ao guardar (ficava um `blob:` que era limpo). O `ImageField` tem agora `uploadFolder`, que envia logo para `media/<pasta>/uploads/` e devolve o URL público. Guardar fica bloqueado enquanto há envios (`isUploadPending` em `lib/mediaUpload.js`).
- **Encomendas:** cancelar devolvia o stock em dobro (frontend + trigger). Agora só o trigger `orders_before_update` o faz.
- **Visualizações:** a página do livro chama `/catalog/view` (uma vez por sessão); antes nunca era chamada.
- **Livros:** duplicar, pesquisa e filtros, destaque num clique, descrição com editor rico, páginas de amostra como lista de imagens, preço maior que zero obrigatório, aviso antes de eliminar um livro que já aparece em encomendas.
- **Integrações:** o formulário SMTP de `app_integrations` foi trocado por um aviso, porque o servidor usa `site_settings.smtp_*`.
- **Pendente (precisa da base de dados):**
  - livros ocultos: coluna `active`, RLS pública só para os activos, e o checkout tem de recusar livros ocultos;
  - promoções: `sale_price` com datas, e `place_order` tem de cobrar o preço efectivo;
  - confirmar que o utilizador "Rodrigues" é `admin`;
  - publicar a Edge Function. Na produção, `/admin/users` ainda responde "Rota não encontrada".
  - O plano detalhado está em `docs/PROMPT_REFINAMENTO.md`.

## Painel de vendas por loja (2026-11-01, sessão local)

- O separador "Vendas por loja" (antes "Vendas Huambo") calcula em cêntimos, exporta em Excel, PDF, PNG, vídeo, CSV e JSON, e lê as vendas registadas no sistema (encomendas) por loja e por mês. A introdução manual continua igual.
- **Por aplicar, em `docs/migracoes-pendentes/` (ver o README de lá):**
  1. passar a loja de Talatona para o Huambo (pedido do dono);
  2. a migração `painel_vendas_por_loja`.
- O painel funciona antes e depois da migração.

## Coleções, slider, pagamentos e integrações (2026-11-01)

- **Pagamentos** (`PaymentsTab.jsx`):
  - subir/descer (a ordem é a do checkout) e activar ou desactivar na própria linha;
  - eliminar pede confirmação e propõe desactivar quando há encomendas com o método ou é do sistema (`entrega`, `transferencia`); estes códigos não podem ser renomeados;
  - código normalizado e sem repetidos; avisos quando nenhum método está activo ou há códigos repetidos.
  - **Pendente (decisão do dono):** há 3 linhas `unitel_money` repetidas, inactivas e sem encomendas. Não foram apagadas; depois de as limpar, convém criar um índice único em `payment_methods.code`.
- **Coleções** (`CollectionsTab.jsx`):
  - eliminar tira os livros da coleção (antes ficavam a apontar para uma coleção que já não existia) e propõe "Ocultar";
  - ordem, visível/oculta e destaque num clique;
  - adicionar livros com pesquisa; endereço sem repetidos; contadores de SEO.
- **Slider** (`SlidesTab.jsx`, migração `20261101180619_slides_agendamento`):
  - `starts_at` e `ends_at`; a leitura pública só devolve slides activos dentro do período (quem tem `manage_catalog` vê todos), e `getHeroSlides` também filtra pelas datas;
  - ordem, activar, tornar principal (só um de cada vez), duplicar e estado "No ar / Agendado / Terminado";
  - aviso quando o preço do slide difere do preço do livro, que é o cobrado no checkout. Quando houver promoções nos livros, o slide pode passar a usar o preço efectivo.
  - Testado na base de dados (transacção anulada): o visitante só vê o slide no ar; um período inválido é recusado.
- **Integrações** (`AppsTab.jsx`): ficam só o Google Drive e o WhatsApp Business, os únicos que o servidor lê. Os interruptores sem efeito (OAuth, Maps, Contactos, Newsletter, PWA, Rastreio, SMTP) passam a uma lista com o separador onde cada um se configura. As linhas antigas em `app_integrations` continuam na base de dados, sem uso.
- **Lojas:** revistas; já tinham pesquisa, filtros, ordem e confirmação ao eliminar.
- **Contactos e campanhas** (`ContactsManager.jsx` e `/contacts/*` na Edge Function):
  - abrir o separador corria as campanhas pendentes e enviava mensagens; agora só correm com o botão "Enviar pendentes (N)", com confirmação;
  - "Não contactar" (etiqueta `nao-contactar`): fica fora dos envios manuais, das campanhas e do WhatsApp rápido, no painel e no servidor;
  - `/contacts/notify`: no máximo 300 contactos, mensagem obrigatória, canal válido e textos limitados;
  - sem a API do WhatsApp, o envio fica como "Link manual" em vez de "Enviado".
  - Pendente: a Edge Function publicada ainda é a antiga. Até ao deploy, o painel já filtra os "não contactar", mas o servidor ainda marca como "Enviado" os envios que só têm link.
- **Página pública das lojas:** revista; sem alterações.
- **Conta do cliente:**
  - Login: o registo com confirmação de email já não aparece como erro; "Continuar com Google" só aparece com `google_oauth_enabled`; o login deixa de depender do `/health` da Edge Function; o exemplo do email já não é o de um administrador.
  - Perfil: o novo email só vale depois de confirmado (até lá, ficam o email e as encomendas actuais); "Google Workspace" só para a equipa; "CRM Contactos" com `manage_marketing`/`manage_users`; foto até 2 MB.
  - Seguimento: passos próprios para levantamento na loja e aviso nas encomendas canceladas. `/track` devolve `shipping_method` e `pickup_store`, o que só tem efeito depois do deploy da Edge Function.
  - Avaliações: editar a própria avaliação e confirmar antes de eliminar.
