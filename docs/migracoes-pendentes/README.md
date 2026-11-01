# Migrações pendentes (ainda NÃO aplicadas)

Estes ficheiros ficam fora de `supabase/migrations` porque ainda não foram aplicados: lá só entram migrações com a versão e o SQL exactos que estão na base de dados.

- ~~`2_painel_vendas_por_loja.sql`~~: aplicada a 2026-11-01 como `20261101205332_painel_vendas_por_loja` (dados de vendas ligados à loja do Huambo, `tlp93hkif52qxmy`).
- `1_loja_talatona_para_huambo.sql`: **não aplicar como está.** O id `b9b427gh0585i72` é hoje a loja **"Livraria Adventista — Catumbela"** (Benguela), e já existe uma loja do Huambo (`tlp93hkif52qxmy`). Correr este SQL transformaria Catumbela numa segunda loja do Huambo. As lojas actuais são Catumbela (Benguela), Huambo e Lubango (Huíla). Falta o dono confirmar o que quer.
- `3_utilizadores_rpc.sql`: **migração**, `apply_migration` com o nome `utilizadores_rpc`. Põe a gestão de utilizadores (listar, encomendas, editar, suspender, apagar) em funções da base de dados com as mesmas regras da Edge Function. Com ela, Admin → Utilizadores funciona mesmo com a Edge Function antiga publicada. Depois, guardar em `supabase/migrations/<versão>_utilizadores_rpc.sql` e apagar daqui.
