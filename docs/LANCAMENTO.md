# Guia de Lançamento — Livraria Adventista

Checklist para colocar a loja em produção com **WhatsApp Business API**, **email SMTP** e **push PWA** totalmente automáticos.

---

## 1. Pré-requisitos

| Item | Detalhe |
|------|---------|
| Domínio | Ex.: `livrariaadventista.ao` com HTTPS |
| Servidor | VPS (Hostinger, etc.) com Node 18+ |
| Meta Business | Conta verificada + app WhatsApp Cloud API |
| Email | SendGrid, Hostinger SMTP ou Brevo |
| VAPID | Chaves em [vapidkeys.com](https://vapidkeys.com) |

---

## 2. Variáveis de ambiente

```bash
cp app/web/.env.example app/web/.env
```

```env
VITE_POCKETBASE_URL=https://api.seudominio.ao
```

Em produção, o frontend e a API devem estar acessíveis pelo mesmo domínio ou CORS configurado no PocketBase.

---

## 3. WhatsApp Business API (envio automático)

### 3.1 Meta for Developers

1. Crie uma app em [developers.facebook.com](https://developers.facebook.com)
2. Adicione o produto **WhatsApp** → **Cloud API**
3. Obtenha:
   - **Phone Number ID** (WhatsApp → API Setup)
   - **Access Token permanente** (System User + token sem expiração)
4. (Recomendado) Crie um **template** aprovado, ex. `order_confirmation`:
   - Corpo: `Olá {{1}}, a sua encomenda {{2}} foi confirmada. Total: {{3}}. Obrigado!`
   - Idioma: `Portuguese (Portugal)` → código `pt_PT`

### 3.2 Configurar na loja

1. Login admin → **Admin → Apps**
2. Active **WhatsApp Business API**
3. Preencha Phone Number ID + Access Token
4. Active **Envio automático**
5. (Opcional) Active **Usar template Meta** + nome/idioma do template
6. Clique **Enviar mensagem de teste** com o seu número

### 3.3 O que passa a ser automático

- Confirmação de encomenda no checkout (para o telefone do cliente)
- Recibo por WhatsApp na página de sucesso
- Notificações CRM e campanhas
- **Sem abrir wa.me** quando a API está configurada

---

## 4. Email automático (sem Gmail)

### Opção A — SendGrid (recomendado)

1. Admin → **Definições → Email & Push**
2. Active **Email automático de confirmação**
3. Provedor: **SendGrid API**
4. Cole a API Key (`SG....`)
5. Defina email/nome remetente

### Opção B — SMTP (Hostinger, Brevo, etc.)

1. Provedor: **SMTP personalizado** ou **SMTP do PocketBase**
2. Preencha host, porta, utilizador e password
3. Configure os **mesmos dados** em PocketBase Admin → Settings → Mailer

---

## 5. Push PWA

1. Gere par de chaves VAPID em [vapidkeys.com](https://vapidkeys.com)
2. Admin → **Definições → Email & Push**
3. Active push + cole chave pública e privada
4. Utilizadores activam em **Perfil → Definições → Notificações Push**

---

## 6. Deploy

```bash
npm install
npm run build
# Copiar dist/app/web para o servidor web
# Iniciar PocketBase com pb_data persistente
npm run start
```

### PocketBase em produção

```bash
cd app/pocketbase
./pb/pocketbase serve --dir=pb_data --http=0.0.0.0:8090
```

Configure Nginx/Caddy:

- `/` → ficheiros estáticos do frontend
- `/api/` ou subdomínio → proxy para PocketBase `:8090`

---

## 7. Verificação final

| Teste | Como verificar |
|-------|----------------|
| Checkout | Compra teste → cliente recebe WhatsApp + email |
| API status | `GET /api/app/messaging/status` |
| CRM | Enviar notificação → toast "X WhatsApp enviado(s) automaticamente" |
| Recibo | Página `/success` → "Recibo enviado para o seu WhatsApp" |
| Push | Perfil → activar notificações → compra teste |
| Stock baixo | Livro com stock &lt; 5 → selo no card |
| Admin gráficos | Admin → Relatórios Recharts |

---

## 8. Segurança antes do go-live

- [ ] Alterar passwords padrão (`admin@livraria.ao`, PocketBase superuser)
- [ ] Nunca expor Access Token WhatsApp no frontend
- [ ] HTTPS obrigatório
- [ ] Backup regular de `pb_data/`
- [ ] Rever regras de coleções no PocketBase Admin

---

## 9. Credenciais de desenvolvimento

| Sistema | Email | Password |
|---------|-------|----------|
| App admin | `admin@livraria.ao` | `admin123456` |
| PocketBase | `admin@livraria.local` | `Admin123456!` |

**Altere antes de publicar.**

---

## Suporte técnico

- Documentação Meta WhatsApp: https://developers.facebook.com/docs/whatsapp/cloud-api
- PocketBase Mailer: https://pocketbase.io/docs/going-to-production/#sending-emails
