# Importação do Catálogo Real

Este pacote contém o **catálogo oficial** da Livraria (102 livros + capas).

## Importação automática (recomendado)

Com o PocketBase a correr, na raiz do projeto:

```bash
npm run import:catalog
```

O script:
1. Remove todos os livros de demonstração (`stock_books`)
2. Importa o CSV `catalogo_livraria_pocketbase_FINAL.csv`
3. Anexa as capas de `capas_final_named/`
4. Preenche `book_code`, preço, stock, género e descrição

Credenciais por defeito (desenvolvimento local):
- URL: `http://127.0.0.1:8090`
- Email: `admin@livraria.local`
- Password: `Admin123456!`

Para sobrescrever, use variáveis de ambiente:
`PB_URL`, `PB_ADMIN_EMAIL`, `PB_ADMIN_PASSWORD`

Para atualizar sem apagar o catálogo existente:
```bash
npm run import:catalog -- --no-purge
```

## Estrutura

```
pb_import/
├── catalogo_livraria_pocketbase_FINAL.csv
├── capas_final_named/
│   ├── LIV-001.jpg … LIV-100.jpg
│   └── COL-001.jpg, COL-002.jpg
└── import.js          ← script legado (coleção "livros"); use import:catalog na raiz
```

## Script legado (`import.js`)

O `import.js` original foi feito para uma coleção `livros` com campos em português.
O projeto usa a coleção **`stock_books`** — prefira `npm run import:catalog` na raiz.
