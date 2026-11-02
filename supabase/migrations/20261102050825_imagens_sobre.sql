-- Imagens da página "Sobre" editáveis no painel.
--
-- Estavam escritas no código (`/images/site/sobre-topo.webp` e `sobre-livros.webp`), por isso
-- as seis opções do tipo `sobre-topo`/`sobre-lateral` da galeria de imagens prontas não
-- tinham onde ser escolhidas. Com estas colunas passam a aparecer em
-- Configurações → Página Sobre, como já acontece com o fundo do login e o banner da loja.
--
-- Vazio = usa a imagem entregue com o site (a predefinição está na Edge Function).

alter table public.site_settings
  add column if not exists about_top_image_url text,
  add column if not exists about_side_image_url text;

comment on column public.site_settings.about_top_image_url is
  'Imagem do topo da página Sobre. Vazio = a que vem com o site.';
comment on column public.site_settings.about_side_image_url is
  'Imagem lateral da página Sobre. Vazio = a que vem com o site.';
