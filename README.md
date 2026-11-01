<div align="center">

# Livraria Adventista IASD

### Literatura cristã, educação e inspiração — experiência de compra digital premium

[![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=white)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-7-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev)
[![Supabase](https://img.shields.io/badge/Supabase-Backend-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com)
[![License](https://img.shields.io/badge/Licença-Privado-0ea5c9?style=for-the-badge)](LICENSE)

**Loja online completa** com catálogo, checkout seguro, assinatura digital, entregas em Angola, painel administrativo e rastreio de encomendas em tempo real.

[Começar agora](#-início-rápido) · [Funcionalidades](#-funcionalidades) · [Arquitectura](#-arquitectura) · [Admin](#-painel-administrativo)

</div>

---

## Visão geral

A **Livraria Adventista IASD** é uma plataforma de e-commerce moderna, pensada para congregações, leitores e famílias que procuram literatura adventista com uma experiência fluida — do catálogo ao recibo, passando pela confirmação de entrega.

Construída como **monorepo** com frontend React e backend **Supabase** (Postgres, Auth, Storage e Edge Functions), oferece controlo total sobre catálogo, encomendas, identidade visual e operações locais. O frontend é publicado no **Cloudflare Pages**.

```mermaid
flowchart LR
  subgraph Cliente
    A[Loja Web / PWA]
  end
  subgraph Frontend
    B[React + Vite]
    C[Tailwind + shadcn/ui]
  end
  subgraph Supabase
    D[PostgREST + RLS]
    E[Edge Function app]
    F[(Postgres)]
    G[Storage media]
    H[Auth]
  end
  A --> B
  B --> D --> F
  B --> E --> F
  B --> G
  B --> H
```

---

## Funcionalidades

<table>
<tr>
<td width="50%">

### Loja & Catálogo
- Homepage com **hero slider** dinâmico
- Catálogo com pesquisa, filtros e coleções
- Pré-visualização rápida de produtos
- Carrinho persistente (localStorage)
- Tema visual personalizável (cores, glass UI, fundos)

</td>
<td width="50%">

### Checkout & Encomendas
- Checkout com **assinatura manuscrita** (P&B para recibo)
- Morada Angola (província → município → bairro)
- Telefone +244 formatado e contacto de parente
- Pagamento na entrega ou transferência
- Recibo HTML + partilha WhatsApp

</td>
</tr>
<tr>
<td>

### Entrega & Rastreio
- Envio standard / expresso / levantamento em loja
- Portes grátis acima de limiar configurável
- Página **Rastrear Encomenda** com timeline
- Estados de pagamento e entrega

</td>
<td>

### Administração
- Painel `/admin` com permissões por função
- Gestão de livros, slides, lojas e pagamentos
- Relatórios de vendas e alertas de stock
- Integrações (Google Drive, OAuth)
- Definições de marca e PWA

</td>
</tr>
</table>

---

## Stack tecnológica

| Camada | Tecnologias |
|--------|-------------|
| **Frontend** | React 18, Vite 7, React Router 7, Framer Motion |
| **UI** | Tailwind CSS, Radix UI, shadcn/ui, Lucide Icons |
| **Backend** | Supabase: Postgres com RLS, Auth, Storage e Edge Function `app` (Deno) |
| **Dados** | Postgres + migrações SQL versionadas em `supabase/migrations` |
| **Deploy** | Cloudflare Pages (frontend) via GitHub Actions |
| **Extras** | PWA, react-helmet, Sonner toasts, assinatura canvas |

---

## Estrutura do projecto

```
livraria/
├── app/
│   ├── web/                 # Frontend React (porta 3000)
│   │   ├── src/
│   │   │   ├── components/  # UI, carrinho, assinatura, admin
│   │   │   ├── pages/       # Loja, perfil, rastreio, admin
│   │   │   ├── hooks/       # Auth, carrinho, definições
│   │   │   └── lib/         # Recibos, telefone AO, temas
│   │   └── public/          # PWA, ícones, service worker
│   └── pocketbase/          # Backend antigo (só para referência e migração)
├── supabase/
│   ├── migrations/          # Esquema, RLS, triggers, Storage
│   ├── functions/app/       # API própria (checkout, rastreio, CRM, chat…)
│   └── config.toml
├── scripts/
│   └── migrar-pocketbase-supabase.mjs   # Cópia de dados PocketBase → Supabase
├── .github/workflows/       # Deploy Cloudflare Pages e Supabase
├── package.json             # Scripts do monorepo
└── README.md
```

---

## Início rápido

### Pré-requisitos

- **Node.js 18+** e npm
- macOS, Linux ou Windows (WSL recomendado)

### 1. Clonar e instalar

```bash
git clone git@github.com:ValentinoCanguele/livraria_IASD.git
cd livraria_IASD
npm install
```

### 2. Configurar ambiente

```bash
cp app/web/.env.example app/web/.env
```

```env
VITE_SUPABASE_URL=https://bggqkjjqbjhbjsckzopj.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_…
```

A chave *publishable* é pública. A chave `service_role` / `sb_secret_…` nunca vai para o frontend nem para o repositório.

### 3. Executar em desenvolvimento

```bash
npm run dev
```

| Serviço | URL |
|---------|-----|
| Loja | http://localhost:3000 |
| API (Edge Function) | https://bggqkjjqbjhbjsckzopj.supabase.co/functions/v1/app |
| Painel Supabase | https://supabase.com/dashboard/project/bggqkjjqbjhbjsckzopj |

Não é preciso correr nenhum servidor local além do Vite: os dados estão no Supabase.

---

## Painel administrativo

### Aplicação (`/login`)

| Campo | Valor |
|-------|-------|
| Email | `admin@livraria.ao` |
| Password | `admin123456` |

As contas foram migradas do PocketBase com as mesmas palavras-passe. Os papéis (`admin`, `manager`, `member`) estão na tabela `profiles` e só um administrador os pode alterar.

> Altere estas credenciais antes de qualquer ambiente público.

---

## Scripts disponíveis

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Frontend em modo desenvolvimento (dados no Supabase) |
| `npm run build` | Build de produção do frontend → `dist/app/web` |
| `npm run start` | Preview do build de produção |
| `npm run lint` | ESLint no frontend |
| `npm run migrate:supabase` | Copia dados do PocketBase local para o Supabase (ver script) |
| `npm run dev:pocketbase` | Arranca o PocketBase antigo (só para a migração) |

---

## API própria (Edge Function `app`)

| Endpoint | Método | Descrição |
|----------|--------|-----------|
Base: `https://bggqkjjqbjhbjsckzopj.supabase.co/functions/v1/app`

| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/settings` | GET | Definições públicas do site |
| `/checkout` | POST | Finalizar compra com assinatura (transacção em `place_order`) |
| `/track` | POST | Rastreio de encomenda |
| `/newsletter` | POST | Subscrição de newsletter |
| `/integrations` | GET | Integrações activas |
| `/messaging/status` | GET | Estado WhatsApp/email/push (sem segredos) |
| `/whatsapp/receipt` | POST | Enviar recibo via WhatsApp API |
| `/admin/whatsapp/test` | POST | Teste de envio (staff) |
| `/chat`, `/chat/config` | POST/GET | Assistente (Gemini/DeepSeek ou FAQ) |
| `/contacts/*` | — | CRM: sincronização, notificações e campanhas (staff) |

O frontend continua a usar a API do SDK do PocketBase (`pb.collection(...)`), implementada sobre o Supabase em `app/web/src/lib/dataClient.js`.

> Guia completo de lançamento: [docs/LANCAMENTO.md](docs/LANCAMENTO.md)  
> O login Google e o Google Workspace continuam no Firebase.

---

## Destaques de implementação

- **Assinatura no checkout** — captura em canvas, exportação P&B nítida e anexo ao recibo com nome e data
- **Telefone Angola** — normalização e validação `+244 9XX XXX XXX` em todo o fluxo
- **Selector geográfico** — províncias, municípios e localidades de Angola (com fallback offline)
- **Tema da loja** — cores de marca, glass morphism e fundos gradiente/imagem/vídeo/slides
- **PWA** — instalável no telemóvel com manifest e service worker
- **Permissões** — roles `admin`, `manager` e `member` com controlo granular no admin

---

## Build de produção

Cada push para `main` publica automaticamente:

- **Frontend** → Cloudflare Pages (`.github/workflows/deploy-cloudflare.yml`)
- **Migrações e Edge Function** → Supabase (`.github/workflows/deploy-supabase.yml`, só quando `supabase/` muda)

Configuração no GitHub (Settings → Secrets and variables → Actions):

| Tipo | Nome | Valor |
|------|------|-------|
| Variável | `VITE_SUPABASE_URL` | URL do projecto Supabase |
| Variável | `VITE_SUPABASE_PUBLISHABLE_KEY` | Chave publishable |
| Variável | `CLOUDFLARE_PAGES_PROJECT` | `livraria-adventista` |
| Variável | `SUPABASE_PROJECT_REF` | `bggqkjjqbjhbjsckzopj` |
| Secret | `CLOUDFLARE_API_TOKEN` | Token com permissão *Cloudflare Pages: Edit* |
| Secret | `CLOUDFLARE_ACCOUNT_ID` | ID da conta Cloudflare |
| Secret | `SUPABASE_ACCESS_TOKEN` | Token pessoal do Supabase |
| Secret | `SUPABASE_DB_PASSWORD` | Palavra-passe da base de dados |

O ficheiro `app/web/public/_redirects` encaminha todas as rotas para `index.html` (SPA).

---

## Segurança & boas práticas

- Nunca commitar `.env` — use `.env.example` como referência
- A chave `service_role` só existe dentro das Edge Functions do Supabase
- Alterar passwords padrão antes de deploy
- Activar HTTPS em produção
- Rever as políticas RLS e os avisos em Supabase → Advisors

---

## Contribuir

1. Faça fork do repositório
2. Crie uma branch: `git checkout -b feature/minha-funcionalidade`
3. Commit: `git commit -m "feat: descrição clara"`
4. Push: `git push origin feature/minha-funcionalidade`
5. Abra um Pull Request

---

<div align="center">

**Livraria Adventista IASD**

*Literatura que edifica e transforma.*

Feito com dedicação para a comunidade adventista em Angola e além-fronteiras.

</div>
