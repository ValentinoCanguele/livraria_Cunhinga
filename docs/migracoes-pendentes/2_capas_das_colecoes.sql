-- Capas das colecções: trocar as fotos genéricas do Unsplash pelas imagens feitas com as
-- capas reais do catálogo (galeria de imagens prontas, tipo `slide`, 1920×1080 — a capa da
-- colecção é 16:9).
--
-- Antes: as quatro apontavam para images.unsplash.com, fotos de bibliotecas quaisquer que
-- não têm nada a ver com os livros à venda.
--
-- Correr com:  npx supabase db push  não serve (isto são dados, não esquema).
-- Correr no SQL Editor do painel do Supabase, ou com psql.
--
-- Cada imagem foi escolhida pelo tema da colecção. Para mudar, é mais fácil pelo painel:
-- Admin → Colecções → Capa da colecção → aba Galeria.

update public.book_collections set
  cover = case id
    -- Essenciais da Fé → Fé e doutrina
    when '5958xsw75k3929q' then 'https://livraria-adventista.pages.dev/images/site/opcoes/slide-doutrina-leque.webp'
    -- Obras de Ellen G. White → Ellen G. White
    when '311xv9lv292i7d1' then 'https://livraria-adventista.pages.dev/images/site/opcoes/slide-ellen-white-prateleira.webp'
    -- Família e Educação → Família e relacionamentos
    when '3i9kf14o7kbo7bi' then 'https://livraria-adventista.pages.dev/images/site/opcoes/slide-familia-leque.webp'
    -- Devocionais Diários → Destaques
    when 'u30yl9sx68nx1zt' then 'https://livraria-adventista.pages.dev/images/site/opcoes/slide-destaques-duas-filas.webp'
    else cover
  end,
  updated = now()
where id in (
  '5958xsw75k3929q',
  '311xv9lv292i7d1',
  '3i9kf14o7kbo7bi',
  'u30yl9sx68nx1zt'
)
returning id, title, cover;
