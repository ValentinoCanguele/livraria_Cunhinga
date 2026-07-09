# Livraria Adventista — Desenvolvimento Local

Projeto com **Vite + React** e **PocketBase** como backend completo.

## Pré-requisitos

- Node.js 18+
- npm

## Instalação

```bash
npm install
```

## Executar em desenvolvimento

```bash
npm run dev
```

Isso inicia:

- **Frontend:** http://localhost:3000
- **PocketBase:** http://127.0.0.1:8090
- **Admin PocketBase:** http://127.0.0.1:8090/_/

Na primeira execução, o PocketBase é descarregado automaticamente.

## Configuração inicial do PocketBase

Com o servidor a correr, execute:

```bash
npm run seed
```

Isto cria o superuser, o utilizador admin da app e 4 livros de exemplo.

### Credenciais

| | Email | Password |
|---|---|---|
| **App** (`/login`) | `admin@livraria.ao` | `admin123456` |
| **PocketBase Admin** | `admin@livraria.local` | `Admin123456!` |

## Variáveis de ambiente

Copie `app/web/.env.example` para `app/web/.env`:

```
VITE_POCKETBASE_URL=http://127.0.0.1:8090
```

## Scripts

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Frontend + PocketBase em modo dev |
| `npm run build` | Build de produção do frontend |
| `npm run start` | PocketBase + preview do frontend |
| `npm run seed:books` | Adiciona livros e slides em falta |

## Backend (PocketBase)

- **stock_books** — catálogo com `featured`, `isbn`, stock
- **hero_slides** — fotos do slider da homepage (gerível em `/admin`)
- **orders** — encomendas com desconto automático de stock
- **newsletter** — subscrições de email

### APIs customizadas

- `POST /api/app/checkout` — finalizar compra
- `POST /api/app/newsletter` — subscrever newsletter

- API de ecommerce Hostinger (`EcommerceApi` → PocketBase local)
- Checkout Hostinger (redireciona para `/success` localmente)
- Branding e imagens `images.hostinger.com`
- Script `generate-llms.js` do build
- Meta tags "Hostinger Horizons"
