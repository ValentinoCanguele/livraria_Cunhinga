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

## 4. Por fazer

- **Fila de envio e retentativas.** Hoje o envio é feito no mesmo pedido; uma falha fica
  registada em `notification_logs` com o motivo, mas não é repetida sozinha.
- **Webhooks do fornecedor** (entregue, devolvido, marcado como spam): o estado de entrega
  real não é conhecido.
- **Painel de comunicações**: existe o registo de envios (Integrações → Logs) e o envio de
  teste. Falta pré-visualizar modelos, activar categorias e editar textos.
- **Preferências de comunicação por utilizador** e cancelamento de subscrição com link
  próprio. Hoje as campanhas trazem a indicação no rodapé, mas não há um registo de quem
  pediu para sair.
- **Verificação em Gmail, Outlook e Apple Mail**: a moldura segue as regras conhecidas e está
  coberta por testes, mas não foi aberta nesses clientes.
