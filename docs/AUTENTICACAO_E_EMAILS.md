# Autenticação e emails

Estado em 2026-11-02. Complementa [ARQUITETURA.md](ARQUITETURA.md) e [HANDOFF.md](HANDOFF.md).

## 1. Sessão

A sessão é do Supabase Auth (email e palavra-passe, ou Google). O `dataClient` expõe-na com a
API do antigo PocketBase (`pb.authStore`), e o `useAuth` passa-a ao resto da aplicação.

### O sinal `ready`

O `authStore` só conhece a sessão depois de o supabase-js terminar o arranque: ler o
armazenamento, renovar o token ou consumir o `#access_token=…` que a Google devolve. Até lá,
`isValid` é `false` — **não porque não haja sessão, mas porque ainda não se sabe**.

As páginas protegidas decidiam com essa informação incompleta e mandavam para `/login` quem
tinha sessão válida. Acontecia sempre a seguir ao login com a Google, que volta com a sessão
no endereço e não no armazenamento: o utilizador autenticava-se e caía no ecrã de entrada.

Agora:

| Peça | Onde | O que faz |
|------|------|-----------|
| `createReadyGate()` | `lib/authSession.js` | Sinal de uma só passagem, com recurso de 8 s para falhas de rede |
| `pb.authStore.isReady` / `.onReady()` | `lib/dataClient.js` | Resolve no primeiro evento de autenticação |
| `ready` | `hooks/useAuth.jsx` | O mesmo sinal, como estado de React |
| `sessionDecision()` | `lib/authSession.js` | `wait` → `login` → `forbidden` → `allow`, por esta ordem |
| `<SessionGate />` | `components/SessionGate.jsx` | Ecrã "A verificar a sua sessão…" enquanto é `wait` |

**Regra:** numa página protegida, nunca decidir antes de `ready`. Use `sessionDecision()` em
vez de testar `isAuthed` à mão — é onde a ordem está garantida, e está coberta por testes.

### Destinos de redireccionamento

`safeInternalPath()` valida tudo o que vai para `navigate()` ou para o `redirectTo` do OAuth.
Aceita só caminhos internos; recusa `https://…`, `//evil.com`, `/\evil.com` e caracteres de
controlo. É usada no `LoginPage`, no `loginWithGoogle` e em quem guarda o caminho de volta.

### Contexto preservado

Quem entra a partir do carrinho, do menu ou de uma ficha de livro volta à página onde estava
(`state.from`, via `currentPathWithQuery()`). O carrinho vive no armazenamento local, por isso
sobrevive à ida à Google e de volta. Quem abre `/login` já com sessão é encaminhado em vez de
ver o formulário outra vez.

## 2. Emails

### Onde está o quê

| Ficheiro | O quê |
|----------|-------|
| `supabase/functions/app/emails.ts` | Moldura: cabeçalho, emblema, blocos, botões, rodapé; gera HTML **e** texto simples |
| `supabase/functions/app/emailTemplates.ts` | Um modelo por acontecimento real da loja |
| `supabase/functions/app/emails.test.ts` | 48 testes, incluídos no `npm test` |
| `index.ts` → `sendLetter()` | Envia um modelo e regista o resultado em `notification_logs` |

### Regras da moldura

Tabelas e CSS em linha (o Outlook usa o motor do Word; o Gmail descarta `<style>`). Nada de
SVG, JavaScript nem animações. **A mensagem tem de se ler sem imagens** — o emblema de cada
tipo é um caracter numa célula de tabela, não uma imagem.

Os símbolos vêm de `SAFE_SYMBOLS`, verificados no ecrã. Não acrescentar nenhum sem o ver
desenhado: a primeira versão usava `⚿` (U+26BF) na recuperação de palavra-passe e saía um
bloco de riscas, porque esse caracter não tem glifo em Arial, Helvetica nem Segoe UI.

**Ilustrações próprias** entram por `heroImageUrl` (imagem estática, WebP ou PNG, servida por
`https:`), com o emblema como recuo. O ponto de extensão está pronto; as imagens em si ainda
não existem.

`formatKz()` escreve os valores à mão (`13.000,00 Kz`). O `toLocaleString("pt-AO")` que estava
antes devolvia o separador de milhares do ICU daquele runtime — no Node dá espaço fino — e o
total de uma compra não pode mudar de formato com a máquina que gerou a mensagem.

### Modelos e quando saem

| Modelo | Disparado por |
|--------|---------------|
| Boas-vindas | `POST /account/welcome`, pedido pelo cliente no primeiro acesso |
| Conta criada (convite) · Recuperar palavra-passe | `sendAccessLink()`, pelo painel de utilizadores |
| Encomenda recebida / confirmada | `POST /checkout` |
| Pagamento confirmado | `POST /admin/orders/payment-status` |
| A preparar · Expedida · Em trânsito · Saiu para entrega · Entregue · Cancelada | `POST /delivery-event` |
| Entregue (confirmação do comprador) | `POST /confirm-delivery` |
| Campanhas e avisos | `notifyContact()` |
| Teste | `POST /admin/email/test` |

Nos levantamentos na loja ("expedida" → "Pronta para levantamento") o texto e a linha de
progresso mudam: falar de trânsito a quem vai ao balcão não diz nada.

### Idempotência

Cada envio leva uma `dedupe_key` (`order:created:<id>`, `order:status:<id>:<estado>`,
`account:welcome:<id>`). O índice único em `notification_logs` cobre só os envios com
`status = 'sent'`: um falhado pode ser repetido, um entregue não. É o que impede duas
confirmações da mesma encomenda quando um pedido é repetido ou a função reinicia a meio.

A recuperação de palavra-passe **não** leva chave: cada pedido novo gera um link novo, e o
anterior deixa de servir.

### O que é preciso configurar para isto sair

Nada disto envia nada enquanto, em **Configurações**:

1. `order_email_enabled` estiver desligado;
2. não houver servidor SMTP nem chave SendGrid;
3. `site_url` estiver vazio — sem ele os botões dos emails não têm destino (também se pode
   definir a variável de ambiente `SITE_URL` na Edge Function).

Falta ainda, do lado do domínio, **SPF, DKIM e DMARC**: sem eles as mensagens vão para o lixo.

## 3. O que não existe neste sistema

O esquema tem `orders`, `stock_books`, `physical_stores` e `payment_methods`. **Não há**
produtos digitais, licenças, downloads, vendedores nem comissões — não há modelos de email
para isso porque não haveria nada que os chamasse. Se essas áreas forem criadas, os modelos
seguem o mesmo padrão: uma função em `emailTemplates.ts` e o disparo na rota que muda o estado.

## 4. Painel de comunicações

**Integrações → Modelos de email** (`components/admin/EmailTemplatesPanel.jsx`). Exige
`manage_settings`.

- Lista dos modelos por área (Conta, Encomenda, Entrega, Outros).
- Pré-visualização em computador e telemóvel, e a versão em texto simples.
- Envio de teste para um endereço à escolha.
- Aviso em destaque com o que falta para as mensagens saírem de facto.

O HTML vem de `GET /admin/email/preview`, que o compõe com as **mesmas funções que enviam de
verdade** (`PREVIEW_TEMPLATES` em `emailTemplates.ts`). Montar um exemplo no frontend daria
dois sítios a divergir, e o gestor veria algo que o cliente nunca recebe. A pré-visualização
corre num `<iframe sandbox="">`, sem scripts.

**Integrações → Registo de envios** ganhou o botão **Reenviar**, que repete a mensagem tal
como foi composta (`POST /admin/email/resend`). Reenvia o conteúdo guardado e não o volta a
compor: a encomenda pode ter mudado entretanto, e o que se quer é repetir a mensagem que
falhou, não enviar outra diferente. As campanhas ficam de fora — repetir um envio em massa à
mão passaria por cima da verificação do consentimento.

## 5. Site novo com função antiga

O site e a Edge Function são publicados por caminhos diferentes — Cloudflare Pages e
Supabase —, por isso há sempre uma janela em que o site novo fala com a função antiga. Hoje
essa janela está aberta: o Actions está bloqueado por facturação e a função publicada é
anterior às rotas deste trabalho (confirmado: `/health` responde 200,
`/admin/orders/payment-status` responde 404).

`lib/apiCompat.js` → `isMissingRoute(err)` distingue "esta rota ainda não existe" de "correu
mal". Testa a **mensagem** e não só o código 404: as rotas devolvem 404 também quando o
registo não existe ("Encomenda não encontrada."), e confundir os dois esconderia um erro
verdadeiro.

Quem depende de uma rota nova trata o caso:

- **Estado do pagamento**: grava na tabela como antes e avisa que o cliente não foi
  notificado. Uma funcionalidade a menos seria pior do que um aviso a mais.
- **Modelos de email**: mostra o que é preciso fazer ("Publique a Edge Function") em vez de
  um "Rota não encontrada" seco.
- **Boas-vindas**: deixa de insistir nessa sessão — a resposta será a mesma até haver deploy.

O teste `lib/apiRoutes.test.js` compara as rotas que o frontend chama com as que o
`index.ts` regista. Não substitui o deploy, mas apanha um nome trocado ou um caminho
renomeado só de um lado.

## 6. Categorias e cancelamento de subscrição

### Categorias opcionais

`OPTIONAL_CATEGORIES` (em `emails.ts`) tem as **únicas** que a loja pode desligar:

| Chave | O quê |
|-------|-------|
| `welcome` | Boas-vindas a quem cria conta |
| `order_progress` | A preparar, expedida, em trânsito, saiu para entrega |
| `campaign` | Campanhas e novidades |

Tudo o resto sai sempre: a confirmação da encomenda, o pagamento, a **entrega**, o
**cancelamento** e as mensagens de conta. São a prova de uma compra e o acesso a uma conta.

A regra vive em `isCategoryEnabled()` e é verificada em `sendLetter()` — num só sítio, e não
em cada ponto de envio, onde uma categoria esquecida seria uma mensagem a sair depois de a
loja a ter desligado. Entre as opcionais, **só `false` explícito desliga**: configuração em
falta, nula ou mal formada deixa tudo a funcionar. Um envio travado por categoria fica em
`notification_logs` com `status = 'skipped'` e o motivo.

O painel liga e desliga em **Integrações → Modelos de email**
(`GET`/`POST /admin/email/categories`). A rota só aceita as chaves conhecidas: um valor
qualquer vindo do pedido não fica guardado a fingir-se de categoria.

### Cancelamento de subscrição

Só nas mensagens de marketing. Pôr o link numa confirmação de encomenda convidaria a
cancelar o que não se pode cancelar, e ensinaria o cliente a ignorá-lo onde ele conta.

- `contacts.unsubscribe_token`: 64 caracteres, opaco, por contacto, revogável, criado por
  um trigger. Dois UUID v4 em vez do `random()` que o `gen_record_id` usa — `random()` é
  previsível a partir do estado do gerador, e com isso alguém poderia cancelar a subscrição
  de outra pessoa.
- O link é `/unsubscribe?t=<token>`. **O email não vai no endereço**: ficaria exposto nos
  registos do servidor, no histórico do navegador e em quem recebesse a mensagem
  reencaminhada.
- `POST /unsubscribe` é pública e limitada por IP — quem quer sair de uma lista não deve ter
  de criar conta. Responde sempre o mesmo com um token inválido: dizer "não existe"
  transformaria a rota num meio de confirmar se um token é de alguém.
- A página confirma com um **POST**, e não ao abrir o link: alguns servidores de correio
  seguem os endereços das mensagens para os analisar, e com um GET a cancelar, uma dessas
  visitas dava baixa de quem nunca carregou em nada.
- `notifyContact()` verifica `marketing_opt_out_at` **no envio**, e não só em quem escolhe
  os destinatários: uma lista montada antes do cancelamento voltaria a apanhá-lo.
- As campanhas levam `List-Unsubscribe` e `List-Unsubscribe-Post: One-Click`, que os clientes
  de email usam para mostrar o botão próprio de cancelamento, e que o Gmail exige a quem
  envia em volume.

## 7. Por fazer

- **Fila de envio e retentativas.** Hoje o envio é feito no mesmo pedido; uma falha fica
  registada em `notification_logs` com o motivo, mas não é repetida sozinha.
- **Webhooks do fornecedor** (entregue, devolvido, marcado como spam): o estado de entrega
  real não é conhecido.
- **Painel de comunicações**: falta activar ou desactivar categorias opcionais, editar os
  textos a partir do painel e guardar versões dos modelos.
- **O painel novo não foi verificado a funcionar.** Passa lint, build e testes, mas as rotas
  `/admin/email/templates`, `/preview` e `/resend` só respondem depois de a Edge Function ser
  publicada, e esta máquina não tem credenciais do Supabase nem um `app/web/.env`.
- **Preferências por canal e por tipo de mensagem** para o próprio cliente gerir no perfil:
  hoje o cancelamento é tudo-ou-nada para as campanhas.
- **Verificação em Gmail, Outlook e Apple Mail**: a moldura segue as regras conhecidas e está
  coberta por testes, mas não foi aberta nesses clientes.
