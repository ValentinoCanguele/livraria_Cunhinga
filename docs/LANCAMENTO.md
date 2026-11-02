# Guia de Lançamento — Livraria Adventista

Checklist para pôr a loja em produção com o Supabase (backend) e o Cloudflare Pages (site), com **WhatsApp Business API**, **email automático** e **push PWA**.

---

## 1. Pré-requisitos

| Item | Detalhe |
|------|---------|
| Supabase | Projecto `bggqkjjqbjhbjsckzopj` (já criado, com esquema e dados) |
| Cloudflare | Conta com Pages; o projecto é criado pelo primeiro deploy |
| GitHub | Conta sem bloqueios de pagamento (o Actions tem de correr) |
| Domínio | Ex.: `livrariaadventista.ao`, apontado para o Cloudflare Pages |
| Meta Business | Conta verificada + app WhatsApp Cloud API (opcional) |
| Email | Servidor SMTP (Hostinger, Brevo…) ou SendGrid |
| Google Cloud | ID de cliente OAuth para o login com Google |

---

## 2. Segredos e variáveis do GitHub Actions

Em **Settings → Secrets and variables → Actions** do repositório:

| Tipo | Nome | Valor |
|------|------|-------|
| Variável | `VITE_SUPABASE_URL` | `https://bggqkjjqbjhbjsckzopj.supabase.co` |
| Variável | `VITE_SUPABASE_PUBLISHABLE_KEY` | Chave *publishable* (Supabase → API Keys) |
| Variável | `CLOUDFLARE_PAGES_PROJECT` | Ex.: `livraria-adventista` |
| Variável | `SUPABASE_PROJECT_REF` | `bggqkjjqbjhbjsckzopj` |
| Secret | `CLOUDFLARE_API_TOKEN` | Token com *Cloudflare Pages: Edit* |
| Secret | `CLOUDFLARE_ACCOUNT_ID` | ID da conta Cloudflare |
| Secret | `SUPABASE_ACCESS_TOKEN` | Token pessoal do Supabase (Account → Access Tokens) |
| Secret | `SUPABASE_DB_PASSWORD` | Palavra-passe da base de dados |

Se faltar algum, os workflows de deploy param logo no início e dizem qual é.

---

## 3. Supabase → Authentication

1. **Providers → Google:** activar com o Client ID e o Secret da Google Cloud.
   Na Google Cloud (APIs e serviços → Credenciais → ID do cliente OAuth → Aplicação Web), o URI de redireccionamento autorizado é:
   `https://bggqkjjqbjhbjsckzopj.supabase.co/auth/v1/callback`
2. **URL Configuration:** Site URL = domínio do site; Redirect URLs = `https://<domínio>/**`.
3. **Emails → SMTP:** configure um servidor SMTP próprio. O serviço de email incluído no plano grátis só envia para membros da equipa do Supabase, por isso os clientes não recebem a confirmação de registo nem a recuperação de palavra-passe.

---

## 4. WhatsApp Business API (envio automático)

### 4.1 Meta for Developers

1. Crie uma app em [developers.facebook.com](https://developers.facebook.com)
2. Adicione o produto **WhatsApp** → **Cloud API**
3. Obtenha:
   - **Phone Number ID** (WhatsApp → API Setup)
   - **Access Token permanente** (System User + token sem expiração)
4. (Recomendado) Crie um **template** aprovado, ex. `order_confirmation`:
   - Corpo: `Olá {{1}}, a sua encomenda {{2}} foi confirmada. Total: {{3}}. Obrigado!`
   - Idioma: `Portuguese (Portugal)` → código `pt_PT`

### 4.2 Configurar na loja

1. Entre como administrador → **Admin → Sistema → Integrações**
2. Active **WhatsApp Business API**
3. Preencha Phone Number ID + Access Token
4. Active **Envio automático (checkout + CRM)**
5. (Opcional) Active **Usar template Meta** + nome/idioma do template
6. Clique **Enviar mensagem de teste** com o seu número

O token fica no servidor: só administradores o vêem, e a loja nunca o envia para o browser.

### 4.3 O que passa a ser automático

- Confirmação de encomenda no checkout (para o telefone do cliente)
- Recibo por WhatsApp na página de sucesso
- Notificações de contactos e campanhas
- Cada envio fica em **Integrações → Logs** (enviado, falhou ou não enviado)

---

## 5. Email automático

1. **Admin → Sistema → Configurações → Email de confirmação de encomenda**
2. Active o envio e escolha o provedor:
   - **SMTP:** host, porta, utilizador, palavra-passe, email e nome do remetente
   - **SendGrid:** API Key (`SG....`), email e nome do remetente
3. Em **Integrações → Logs**, use **Testar Email** para confirmar.

Este email é o da loja (confirmações, recibos, links de acesso criados no painel). O email de registo e de recuperação de palavra-passe é o do Supabase Auth (ponto 3).

---

## 6. Push PWA

1. Gere um par de chaves VAPID em [vapidkeys.com](https://vapidkeys.com)
2. **Admin → Sistema → Configurações → Notificações Push (PWA)**
3. Active push + cole a chave pública e a privada
4. Os clientes activam em **Perfil → Notificações Push**

---

## 7. Deploy

Tudo é automático a partir do GitHub:

| Quando | O que acontece |
|--------|----------------|
| Pull request para `main` | `ci.yml`: lint, build e `deno check` da Edge Function |
| Push para `main` | `deploy-cloudflare.yml`: build e publicação no Cloudflare Pages (cria o projecto na primeira vez) |
| Push para `main` com mudanças em `supabase/` | `deploy-supabase.yml`: `supabase db push` e publicação da Edge Function `app` |

Para publicar a Edge Function à mão (com um token do Supabase):

```bash
npx supabase functions deploy app --project-ref bggqkjjqbjhbjsckzopj --no-verify-jwt
```

---

## 8. Verificação final

| Teste | Como verificar |
|-------|----------------|
| Checkout | Compra teste → o cliente recebe WhatsApp e email; o envio aparece em Integrações → Logs |
| API | `GET https://bggqkjjqbjhbjsckzopj.supabase.co/functions/v1/app/health` |
| Login | Registo com email (chega a confirmação) e login com Google |
| Utilizadores | Admin → Utilizadores e Clientes: criar conta, link de acesso, suspender |
| Gestor | Criar um gestor só com "Encomendas" e confirmar que não vê o resto |
| Recibo | Página `/success` → "Recibo enviado para o seu WhatsApp" |
| Push | Perfil → activar notificações → compra teste |
| Rastreio | `/track` com o número da encomenda |

---

## 9. Segurança antes do go-live

- [ ] Nenhuma credencial real no repositório (é público)
- [ ] Supabase → Advisors (Security e Performance) sem avisos novos
- [ ] SMTP próprio configurado no Supabase Auth
- [ ] Domínio com HTTPS (automático no Cloudflare)
- [ ] Rever quem tem papel `admin` e `manager` em Admin → Utilizadores e Clientes

---

## Suporte técnico

- Supabase: https://supabase.com/docs
- Cloudflare Pages: https://developers.cloudflare.com/pages/
- WhatsApp Cloud API: https://developers.facebook.com/docs/whatsapp/cloud-api
