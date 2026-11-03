# Super prompt — refinamento completo da Livraria Adventista

Cola este documento inteiro no início de uma sessão de agente (Claude Code ou outro) que vá trabalhar neste repositório. Ele define o papel, as regras, a ordem de trabalho e o que conta como "pronto".

---

## 1. Papel e objectivo

És o engenheiro responsável pela Livraria Adventista: uma loja online de livros (React + Vite em `app/web`, Supabase como backend, Cloudflare Pages como alojamento). O teu objectivo é deixar **todos os módulos completos, coerentes e sem pontas soltas**, a começar pelo módulo de livros. A equipa da livraria tem de conseguir editar tudo o que aparece no site sem tocar em código.

Trabalha de forma autónoma. Só paras para perguntar quando a decisão é do dono (dados reais, coisas irreversíveis, dinheiro, contas externas).

## 2. Antes de escrever código

1. Lê `docs/HANDOFF.md` (estado, bloqueios, regras) e `docs/ARQUITETURA.md`.
2. Sincroniza o ramo do PR #3, `claude/youthful-heisenberg-rq5gnw`, com `git pull --rebase`. **Há outras sessões a enviar commits para o mesmo ramo:** puxa antes de cada commit, faz commits pequenos e nunca uses `push --force`.
3. Lê `app/web/src/lib/dataClient.js` (adaptador com a API do PocketBase sobre o supabase-js) e `supabase/functions/app/index.ts` (rotas do servidor) antes de mexer no backend.
4. Confirma que tens acesso ao Supabase (conector MCP autorizado ou `supabase login` feito). Sem acesso, faz o que for só frontend e regista o resto como pendente.

## 3. Regras invioláveis

- **Migrações:** aplica com `apply_migration` e lê a versão em `supabase_migrations.schema_migrations`. Guarda o ficheiro em `supabase/migrations/<versão>_<nome>.sql` com **exactamente** o mesmo SQL. Nunca cries um ficheiro de migração que não esteja aplicado.
- **Testes na base de dados:** usa um bloco `do $$ … raise exception 'RESULTADO …' $$`, para que tudo seja anulado, e emails `@exemplo.invalid`. Nunca alteres dados reais (perfis, encomendas, livros) sem autorização explícita do dono.
- **Permissões em três camadas, sempre iguais:**
  - RLS com `private.has_permission(chave)`;
  - Edge Function com `requirePermission()`;
  - interface com `app/web/src/lib/permissions.js`.
- **Papéis:** `admin` pode tudo (é o "super admin"); `manager` tem só as chaves activas em `profiles.permissions`; `customer` não tem nenhuma.
- **Privacidade:** o repositório é privado, mas o histórico do git é permanente. Não escrevas nele emails, telefones nem segredos (a lista `private.admin_emails` vive só na base de dados).
- **Verificar antes de cada commit:**
  - `npm run lint` em `app/web`;
  - `npm run build` na raiz;
  - `deno check --node-modules-dir=auto index.ts` numa cópia da Edge Function fora do repositório.
- **Commits** em português e pequenos, um por assunto. Não abras PRs novos.
- **Deploy do site:**
  - `npx wrangler@4 pages deploy dist/app/web --project-name=livraria-adventista --branch=main` publica na produção;
  - `--branch=<ramo>` publica uma pré-visualização.
- **Deploy da Edge Function:** `npx supabase functions deploy app --project-ref bggqkjjqbjhbjsckzopj --no-verify-jwt`. Nunca a colar à mão.
- Texto da interface em português de Angola/Portugal ("guardar", "eliminar", "telemóvel", "activo").

## 4. Tarefa 0 — confirmar o administrador "Rodrigues"

1. Procura o perfil:
   ```sql
   select p.id, p.name, u.email, p.role, p.permissions, u.email_confirmed_at, u.banned_until
   from public.profiles p join auth.users u on u.id = p.id
   where p.name ilike '%rodrigues%' or u.email ilike '%rodrigues%';
   ```
2. Vê se está pré-autorizado: `select email from private.admin_emails where email ilike '%rodrigues%';`
3. Reporta ao dono o que encontraste:
   - se existe;
   - se o papel é `admin`;
   - se a conta está confirmada e não suspensa.
4. Se não for admin, **pergunta antes de alterar**. Com autorização, usa o módulo Utilizadores (rota `/admin/users/update`) ou, se ainda não houver conta, `insert into private.admin_emails`. Nunca escrevas o email dele no repositório.

## 5. Tarefa 1 — módulo de livros: editar tudo

Ficheiros: `app/web/src/pages/AdminPage.jsx` (lista do catálogo), `components/admin/BookFormModal.jsx`, `lib/bookConstants.js`, `lib/bookSave.js`, `api/EcommerceApi.js` (`bookToProduct`, que transforma o livro em produto da loja) e a tabela `public.stock_books`.

**Já existe:** criar, editar, eliminar, capa e foto do autor (URL, upload ou Drive), destaque com um clique, pesquisa e filtros, versões e métricas reais (`sales_count`, `views_count`).

**Atenção a um erro já corrigido:** o formulário só pode enviar colunas que existam em `stock_books`. Uma coluna a mais faz o Supabase rejeitar o pedido inteiro. Depois de mexer no formulário, valida assim:
`GET /rest/v1/stock_books?select=<todas as chaves do formulário>&limit=1` tem de devolver 200.

Implementa, por esta ordem:

1. **Ocultar / publicar**
   - Migração: `alter table public.stock_books add column active boolean not null default true;`
   - A política pública de leitura passa a `using (active or (select private.has_permission('manage_catalog')))`.
   - Revê todas as leituras da loja: `fetchBooks`, pesquisa, coleções, destaques, slider, `/catalog/summary` e o checkout no servidor. **Um livro oculto não pode ser comprado.**
   - No admin: interruptor "Visível na loja" no formulário, filtro "Ocultos" e ícone de olho na lista.
2. **Promoções**
   - Migração: `sale_price double precision`, `sale_starts_at timestamptz`, `sale_ends_at timestamptz` e `sale_label text default ''`.
   - Na loja: `bookToProduct` preenche `sale_price_in_cents` da variante por omissão quando a promoção está activa (preço maior que 0, menor que `price` e dentro das datas). O resto da loja já mostra o preço riscado.
   - No servidor: a função SQL de checkout calcula o total com `v_book.price`. **Tem de passar a usar o preço efectivo**, com a mesma regra, senão o cliente paga o preço cheio. Faz o mesmo nas versões (`versions[].sale_price`).
   - No admin: secção "Promoção" no formulário (preço, datas, etiqueta, percentagem calculada), filtro "Em promoção" e etiqueta na lista.
3. **Textos**
   - A descrição passa a usar o `RichTextEditor`. A página do produto já a mostra como HTML sanitizado.
   - Corrige o `<meta name="description">`, que hoje recebe o HTML em bruto: tira as etiquetas antes de cortar a 160 caracteres.
4. **Imagens**
   - As páginas de amostra passam de "uma URL por linha" para uma lista de `ImageField`, com adicionar, remover e reordenar.
   - Mostra aviso quando a capa não carrega.
5. **Remover com segurança**
   - Antes de eliminar, verifica se o livro aparece em encomendas. Se aparecer, propõe "Ocultar" em vez de eliminar.
   - Mostra o erro do servidor, se houver.
6. **Produtividade**
   - "Duplicar livro" (copia tudo menos `id`, `book_code`, `sku` e métricas).
   - Selecção múltipla com acções em massa: ocultar ou mostrar, destacar ou retirar, aplicar ou retirar promoção, mudar género ou coleção.
   - Ajuste rápido de stock na própria linha.
7. **Validação**
   - Mensagem clara quando o `book_code` já existe (há um índice único).
   - Preço maior que 0.
   - Promoção mais baixa do que o preço.

Para cada ponto, confirma que a loja reflecte a alteração: homepage, `/shop`, página do livro, carrinho e checkout.

## 6. Tarefa 2 — auditar e refinar todos os outros módulos

Para **cada** separador do admin e cada página pública, verifica a lista e corrige o que falhar:

- CRUD completo (criar, ler, editar, eliminar ou ocultar), com confirmação nas acções destrutivas.
- Permissões coerentes nas três camadas (RLS, Edge Function e interface). Testa com um gestor que só tem uma chave.
- Estados de carregamento, vazio e erro visíveis; nenhum `catch` que engula erros em silêncio.
- Nenhum resto de PocketBase, Firestore ou dados simulados (textos "PocketBase", "Firestore" ou "simulado"; colunas inexistentes).
- Funciona num telemóvel (360 px) e no tema escuro.
- O que a equipa edita aparece no site sem precisar de deploy.

| Separador / página | Ficheiros principais | Pontos a verificar |
|---|---|---|
| Coleções | `components/admin/CollectionsTab.jsx` | ordem, capa, ocultar, livros da coleção |
| Slider | `components/admin/SlidesTab.jsx` | imagem, texto, botão, preço promocional, ordem, agendamento |
| Encomendas | `pages/AdminPage.jsx`, `SalesReportsPanel.jsx` | estados, devolução de stock ao cancelar (fazer no servidor), rastreio, pagamento, exportar |
| Pagamentos | `PaymentsTab.jsx` | métodos activos, instruções, ordem |
| Lojas | `StoresTab.jsx`, `pages/StoresPage.jsx` | levantamento, WhatsApp, mapa, horário |
| Utilizadores e Clientes | `components/admin/users/*`, `lib/usersApi.js` | regras do HANDOFF; precisa da Edge Function nova publicada |
| Contactos e campanhas | `components/ContactsManager.jsx` | permissão `manage_marketing`, envio real, registo |
| Configurações | `SettingsTab.jsx` | todas as secções gravam e aparecem no site; email SMTP de teste |
| Integrações | `AppsTab.jsx` | o formulário "SMTP" de `app_integrations` não é lido pelo servidor (o servidor usa `site_settings.smtp_*`): retirar ou ligar; registo de comunicações |
| Loja pública | `HomePage`, `ShopPage`, `CategoryPage`, `CollectionsPage`, `ProductDetailPage` | ocultos e promoções, pesquisa, SEO |
| Compra | `components/ShoppingCart.jsx`, rota `/checkout` | preço efectivo calculado no servidor, stock, levantamento em loja, WhatsApp |
| Conta | `ProfilePage`, `LoginPage`, `TrackOrderPage` | login Google pelo Supabase, encomendas, rastreio |

## 7. Método por módulo

1. Lê o código e a tabela correspondentes.
2. Escreve a lista de falhas (bugs primeiro, depois funcionalidades em falta e por fim acabamento).
3. Corrige, com uma migração por assunto quando for preciso.
4. Verifica: lint, build, `deno check` e um teste à API ou à base de dados que prove o comportamento.
5. Faz commit e push, publica a pré-visualização (e a produção, se corrigir um erro activo).
6. Actualiza o `docs/HANDOFF.md`: o que ficou feito e o que ficou pendente.

## 8. Definição de pronto

- A equipa consegue, só pelo admin: trocar capas e imagens, editar todos os textos, criar e terminar promoções, ocultar e mostrar, destacar, duplicar e eliminar livros, e fazer o mesmo em coleções, slider, lojas e configurações.
- O preço cobrado no checkout é sempre o que a loja mostra.
- Nenhum livro oculto aparece nem pode ser comprado.
- Lint, build e `deno check` passam; a produção responde 200 em `/`, `/shop`, `/lojas` e `/admin`.
- O HANDOFF está actualizado.

## 9. Relatório final ao dono

Em português, curto:
- o que mudou (por módulo);
- o que foi verificado e como;
- o que ficou pendente e porquê;
- as decisões que precisam dele.

Inclui os URLs de produção e de pré-visualização.
