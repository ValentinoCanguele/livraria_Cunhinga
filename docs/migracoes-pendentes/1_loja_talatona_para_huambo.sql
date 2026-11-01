-- Pedido do utilizador: a loja de Talatona passa a ser a loja do Huambo (as lojas ficam Huambo e Benguela).
update public.physical_stores
set name = 'Livraria Adventista — Huambo',
    province = 'Huambo',
    address = 'Cidade do Huambo',
    latitude = -12.7761,
    longitude = 15.7392,
    maps_url = 'https://www.google.com/maps?q=-12.7761,15.7392',
    updated = now()
where id = 'b9b427gh0585i72'
returning id, name, province, address, active, pickup_enabled;
