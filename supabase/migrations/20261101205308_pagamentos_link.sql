-- Link de pagamento por método (ex.: Multicaixa Express). Aparece no checkout, na página de
-- sucesso e nos recibos. Edita-se em Vendas → Pagamentos; vazio = sem link.
alter table public.payment_methods
  add column if not exists payment_link text not null default '';

alter table public.payment_methods
  add constraint payment_methods_payment_link_valido check (payment_link = '' or (payment_link ~ '^https://[^\s]+$' and length(payment_link) <= 500));

-- Link de demonstração pedido pelo dono para o Multicaixa Express (a retirar depois).
update public.payment_methods
set payment_link = 'https://pay.kursinha.com/c/6ae5ab5718cca2df1c3e8f94'
where code = 'multicaixa';
