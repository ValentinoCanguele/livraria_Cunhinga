# Migração do repositório

A 2026-11-03 o projecto passou de **`ValentinoCanguele/livraria_Cunhinga`** (público) para
**[`fernandotunas6-bot/Livraria-Editora-Adventista`](https://github.com/fernandotunas6-bot/Livraria-Editora-Adventista)** (privado).

Um push leva commits, ramos e etiquetas. **Não leva mais nada.** Este documento lista o que
ficou atrás e o que tem de ser refeito à mão.

## O que migrou

Todo o histórico, desde o primeiro commit, mais sete ramos e a etiqueta `v0.2.0`:

| Ramo | Commit | Nota |
|------|--------|------|
| `main` | `f4d9885` | igual ao `main` antigo; a migração do Supabase já integrada (2026-11-02) |
| `claude/youthful-heisenberg-rq5gnw` | `da8546b` | o ramo de trabalho, 49 commits à frente do `main` |
| `supabase/migracao` | `4c52064` | já integrado no `main` |
| `deploy/atendimento-20261103` | `dda616d` | — |
| `a5/refino` | `7c26aa1` | — |
| `cursor/fix-sw-dev-blank-screen` | `dd33668` | sem backend |
| `cursor/fix-pocketbase-payment-hooks` | `553a5b9` | era PocketBase |

Não migraram o `main` **local** antigo (era PocketBase, 114 commits atrás) nem o
`publicar-tmp`, que é um worktree temporário do script de publicação.

Em cima do `main` foi feito um commit só para o README da página de entrada não apontar para o
repositório antigo (`e8c55c7`). A revisão completa da documentação está no ramo de trabalho e
chega ao `main` com o PR desse ramo.

Os workflows em `.github/workflows/` migraram como ficheiros — não a configuração de que
precisam (secção 1).

## O que NÃO migrou — por fazer no repositório novo

### 1. Segredos e variáveis do Actions

Settings → Secrets and variables → Actions. Sem isto, `deploy-cloudflare.yml` e
`deploy-supabase.yml` param logo no passo que confirma os segredos.

| Tipo | Nome | Valor |
|------|------|-------|
| Variável | `VITE_SUPABASE_URL` | `https://bggqkjjqbjhbjsckzopj.supabase.co` |
| Variável | `VITE_SUPABASE_PUBLISHABLE_KEY` | Chave *publishable* (Supabase → API Keys) |
| Variável | `CLOUDFLARE_PAGES_PROJECT` | `livraria-adventista` |
| Variável | `SUPABASE_PROJECT_REF` | `bggqkjjqbjhbjsckzopj` |
| Secret | `CLOUDFLARE_API_TOKEN` | Token com *Cloudflare Pages: Edit* |
| Secret | `CLOUDFLARE_ACCOUNT_ID` | ID da conta Cloudflare |
| Secret | `SUPABASE_ACCESS_TOKEN` | Token pessoal do Supabase |
| Secret | `SUPABASE_DB_PASSWORD` | Palavra-passe da base de dados |

Os valores estão na conta de cada serviço, não neste repositório. Detalhe em
[LANCAMENTO.md](LANCAMENTO.md), secção 2.

### 2. Actions: verificar se a conta nova corre workflows

Na conta antiga o Actions estava bloqueado por um problema de facturação. Fazer um push e ver
se o workflow arranca. Se não arrancar, é da conta nova — ver [HANDOFF.md](HANDOFF.md),
"Bloqueios". Enquanto isso, o gate real é `npm run deploy:site`, que corre lint, testes e
build antes de publicar.

### 3. Pull requests abertos

Ficaram no repositório antigo e **não se transferem**:

- **#2** — "Migração do backend: PocketBase → Supabase + deploy no Cloudflare Pages"
  (`supabase/migracao`). O conteúdo já está no `main`; pode fechar-se.
- **#4** — "Autenticação verificada no arranque e sistema de emails transaccionais"
  (`claude/youthful-heisenberg-rq5gnw`). **Trabalho vivo.** O ramo migrou com o código;
  abrir o PR de novo no repositório novo, contra o `main`.

O #1 e o #3 estão integrados (merged) e o seu código está no `main`.

### 4. Acessos e configuração do repositório

- Colaboradores e permissões.
- Protecção de ramos / rulesets no `main`.
- Ramo por omissão: confirmar que é `main`.
- Descrição e tópicos do repositório.
- Webhooks e integrações (nenhuma activa, mas confirmar).
- **Visibilidade: privado.** Se algum dia passar a público, rever o histórico antes — ele
  guarda tudo o que já lá esteve.

### 5. Cloudflare Pages

Ambos os projectos vivem na conta `canguelev@fata.adventist.org` e publicam por Wrangler, que
não depende do GitHub. Se alguma vez se ligar o Pages directamente ao Git, é o repositório
novo que tem de ser autorizado.

- `livraria-editora-adventista` — criado a 2026-11-03 para receber o domínio
  `livrariaadventista.ao`. Ainda sem deploy nenhum.
- `livraria-adventista` — continua a servir produção até o domínio estar activo.

A variável `CLOUDFLARE_PAGES_PROJECT` do Actions (secção 1) tem de dizer
`livraria-editora-adventista`, senão o deploy automático publica no projecto antigo.

O domínio `livrariaadventista.ao` **não está registado** e não se compra no Cloudflare —
passos em [LANCAMENTO.md](LANCAMENTO.md), secção 7.

### 6. Supabase

Nada a mudar: o projecto `bggqkjjqbjhbjsckzopj` não conhece o repositório. Só o
`deploy-supabase.yml` o toca, e esse depende dos segredos da secção 1.

## Cópias de trabalho locais

Nesta máquina o repositório novo já está como remoto `novo`; o `origin` continua a apontar
para o antigo, de propósito: havia uma sessão a publicar e trocar o `origin` por baixo dela
parte o `deploy-site.sh`, que faz `git fetch origin` e exige que o HEAD seja a ponta do ramo
remoto. Quando não houver nenhum deploy a correr, trocar:

```bash
git remote rename origin antigo
git remote rename novo origin
git fetch origin
```

Noutra máquina, ou num clone novo:

```bash
git remote set-url origin https://github.com/fernandotunas6-bot/Livraria-Editora-Adventista.git
git fetch origin
```

Dois avisos:

- **Autenticação.** O repositório é privado e da conta `fernandotunas6-bot`. Um `git` com
  credenciais de outra conta do GitHub guardadas leva 403. Resolve-se com
  `gh auth switch -u fernandotunas6-bot && gh auth setup-git`.
- **O `main` local.** Em cópias antigas ainda aponta para a era PocketBase, 114 commits atrás
  do `origin/main`. Usar sempre `origin/main` como referência, e nunca publicar a partir de um
  `main` local sem o actualizar.

### Se o push se desligar a meio

Nesta máquina o primeiro push morreu com `send-pack: unexpected disconnect while reading
sideband packet`. É o HTTP/2 do git no macOS, não o repositório. Com HTTP/1.1 passa:

```bash
git -c http.version=HTTP/1.1 push origin <ramo>
```

Se acontecer com frequência, fixar: `git config --global http.version HTTP/1.1`.

## O repositório antigo

`ValentinoCanguele/livraria_Cunhinga` fica como está, público e com o histórico até à
migração. Decidir se arquivar (Settings → Archive this repository) para deixar claro que o
trabalho passou para cá.
