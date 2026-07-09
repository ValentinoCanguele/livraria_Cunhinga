function escapeCsv(val) {
  const s = String(val ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function fmtItems(items) {
  if (!items?.length) return '';
  return items.map((i) => `${i.quantity || 1}× ${i.title || i.book_code || '—'}`).join('; ');
}

function orderRow(o) {
  const items = o.items || [];
  const subtotal = items.reduce((s, i) => s + (Number(i.price) || 0) * (Number(i.quantity) || 1), 0);
  const shipping = Number(o.shipping_cost) || 0;
  const channel = o.order_type === 'whatsapp_order' || o.sale_channel === 'whatsapp' ? 'WhatsApp' : 'Compra Online';
  const type = o.order_type === 'whatsapp_order' ? 'Encomenda' : 'Compra';

  return [
    o.order_number || o.id,
    new Date(o.created).toLocaleString('pt-AO'),
    type,
    channel,
    o.customer_name || '',
    o.customer_email || '',
    o.phone || '',
    o.address || '',
    o.city || '',
    o.shipping_method === 'pickup' ? 'Levantamento' : o.shipping_method === 'express' ? 'Expressa' : 'Domicílio',
    o.pickup_store || '',
    subtotal.toFixed(2),
    shipping.toFixed(2),
    Number(o.total || 0).toFixed(2),
    o.status || '',
    o.payment_status || '',
    o.payment_method || o.payment_method_code || '',
    o.delivery_status || '',
    fmtItems(items),
    o.notes || '',
  ];
}

const HEADERS = [
  'Nº Pedido', 'Data', 'Tipo', 'Canal', 'Cliente', 'Email', 'Telefone',
  'Morada', 'Cidade', 'Método Envio', 'Loja Levantamento',
  'Subtotal (Kz)', 'Envio (Kz)', 'Total (Kz)',
  'Estado', 'Estado Pagamento', 'Método Pagamento', 'Estado Entrega',
  'Itens', 'Notas',
];

export function exportOrdersToExcel(orders, filename = 'historico-vendas') {
  const rows = [HEADERS, ...orders.map(orderRow)];
  const csv = '\uFEFF' + rows.map((r) => r.map(escapeCsv).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function computeSalesReport(orders) {
  const active = orders.filter((o) => o.status !== 'cancelled');
  const cancelled = orders.filter((o) => o.status === 'cancelled');
  const online = active.filter((o) => o.order_type !== 'whatsapp_order' && o.sale_channel !== 'whatsapp');
  const whatsapp = active.filter((o) => o.order_type === 'whatsapp_order' || o.sale_channel === 'whatsapp');
  const purchases = active.filter((o) => o.order_type === 'online_purchase' || (!o.order_type && o.sale_channel !== 'whatsapp'));
  const enquiries = active.filter((o) => o.order_type === 'whatsapp_order');

  const sum = (list) => list.reduce((s, o) => s + Number(o.total || 0), 0);
  const byMonth = {};
  active.forEach((o) => {
    const key = new Date(o.created).toLocaleDateString('pt-AO', { year: 'numeric', month: 'long' });
    if (!byMonth[key]) byMonth[key] = { count: 0, total: 0 };
    byMonth[key].count += 1;
    byMonth[key].total += Number(o.total || 0);
  });

  const byStatus = {};
  orders.forEach((o) => {
    const st = o.status || 'pending';
    if (!byStatus[st]) byStatus[st] = { count: 0, total: 0 };
    byStatus[st].count += 1;
    byStatus[st].total += Number(o.total || 0);
  });

  return {
    totalOrders: orders.length,
    activeOrders: active.length,
    cancelledOrders: cancelled.length,
    onlineOrders: online.length,
    whatsappOrders: whatsapp.length,
    purchases: purchases.length,
    enquiries: enquiries.length,
    totalRevenue: sum(active),
    onlineRevenue: sum(online),
    whatsappRevenue: sum(whatsapp),
    cancelledRevenue: sum(cancelled),
    averageOrder: active.length ? sum(active) / active.length : 0,
    byMonth,
    byStatus,
  };
}

export function exportSalesReportSummary(orders, filename = 'relatorio-vendas') {
  const report = computeSalesReport(orders);
  const lines = [
    ['Relatório de Vendas — Livraria Adventista'],
    ['Gerado em', new Date().toLocaleString('pt-AO')],
    [],
    ['Métrica', 'Valor'],
    ['Total de pedidos', report.totalOrders],
    ['Pedidos activos', report.activeOrders],
    ['Cancelados', report.cancelledOrders],
    ['Compras online', report.onlineOrders],
    ['Encomendas WhatsApp', report.whatsappOrders],
    [],
    ['Receita total (Kz)', report.totalRevenue.toFixed(2)],
    ['Receita online (Kz)', report.onlineRevenue.toFixed(2)],
    ['Receita WhatsApp (Kz)', report.whatsappRevenue.toFixed(2)],
    ['Ticket médio (Kz)', report.averageOrder.toFixed(2)],
    [],
    ['Por mês', 'Pedidos', 'Total (Kz)'],
    ...Object.entries(report.byMonth).map(([m, d]) => [m, d.count, d.total.toFixed(2)]),
    [],
    ['Por estado', 'Pedidos', 'Total (Kz)'],
    ...Object.entries(report.byStatus).map(([s, d]) => [s, d.count, d.total.toFixed(2)]),
  ];
  const csv = '\uFEFF' + lines.map((r) => r.map(escapeCsv).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
