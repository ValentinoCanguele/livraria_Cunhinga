# Migrações pendentes (ainda NÃO aplicadas)

Estes ficheiros ficam fora de `supabase/migrations` porque ainda não foram aplicados: lá só entram migrações com a versão e o SQL exactos que estão na base de dados.

Aplicar por esta ordem, com acesso ao Supabase (MCP ou CLI com token da conta dona do projecto):

1. `1_loja_talatona_para_huambo.sql`: **dados**, com `execute_sql`. Pedido do dono: a loja de Talatona passa a ser a do Huambo, e as lojas ficam Huambo e Benguela. Depois, acertar a morada, o telefone e o horário reais em Admin → Lojas.
2. `2_painel_vendas_por_loja.sql`: **migração**, com `apply_migration` e o nome `painel_vendas_por_loja`. Depois ler a versão em `supabase_migrations.schema_migrations` e guardar o ficheiro em `supabase/migrations/<versão>_painel_vendas_por_loja.sql` com o mesmo SQL. Por fim, apagar este ficheiro pendente.

O painel (separador "Vendas por loja") funciona antes e depois da migração. Sem ela mostra os dados actuais da Loja do Huambo; com ela aparece a escolha de loja e cada loja passa a ter os seus anos, metas e histórico.
