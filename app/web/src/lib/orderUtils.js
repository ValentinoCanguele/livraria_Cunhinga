export const ORDER_STATUS = {
  pending: { label: 'Pendente', color: 'bg-amber-500/10 text-amber-700' },
  confirmed: { label: 'Confirmada', color: 'bg-blue-500/10 text-blue-700' },
  shipped: { label: 'Enviada', color: 'bg-[#0ea5c9]/10 text-[#0ea5c9]' },
  cancelled: { label: 'Cancelada', color: 'bg-destructive/10 text-destructive' },
};

export const PAYMENT_METHODS = {
  multicaixa: 'Multicaixa Express',
  transferencia: 'Transferência Bancária',
  balcao: 'Pagar no Balcão',
  entrega: 'Pagamento na Entrega',
  unitel_money: 'Unitel Money',
};

export const PAYMENT_STATUS = {
  pending: { label: 'Pendente', color: 'bg-amber-500/10 text-amber-700' },
  awaiting_confirmation: { label: 'Aguarda confirmação', color: 'bg-orange-500/10 text-orange-700' },
  paid: { label: 'Pago', color: 'bg-green-500/10 text-green-700' },
  failed: { label: 'Falhou', color: 'bg-destructive/10 text-destructive' },
  refunded: { label: 'Reembolsado', color: 'bg-purple-500/10 text-purple-700' },
};

export const DELIVERY_STATUS = {
  received: { label: 'Recebida', color: 'bg-slate-500/10 text-slate-700' },
  confirmed: { label: 'Confirmada', color: 'bg-blue-500/10 text-blue-700' },
  preparing: { label: 'A preparar', color: 'bg-indigo-500/10 text-indigo-700' },
  shipped: { label: 'Enviada', color: 'bg-[#0ea5c9]/10 text-[#0ea5c9]' },
  in_transit: { label: 'Em trânsito', color: 'bg-[#0ea5c9]/10 text-[#0ea5c9]' },
  out_for_delivery: { label: 'Saiu para entrega', color: 'bg-amber-500/10 text-amber-700' },
  delivered: { label: 'Entregue', color: 'bg-green-500/10 text-green-700' },
  cancelled: { label: 'Cancelada', color: 'bg-destructive/10 text-destructive' },
};

export function getPaymentStatusLabel(status) {
  return PAYMENT_STATUS[status]?.label || status || '—';
}

export function getPaymentStatusColor(status) {
  return PAYMENT_STATUS[status]?.color || 'bg-muted text-muted-foreground';
}

export function getPaymentMethodLabel(code, methodsMap = PAYMENT_METHODS) {
  return methodsMap[code] || code || '—';
}

export function getOrderStatusLabel(status) {
  return ORDER_STATUS[status]?.label || status;
}

export function getOrderStatusColor(status) {
  return ORDER_STATUS[status]?.color || 'bg-muted text-muted-foreground';
}

export function getDeliveryStatusLabel(status) {
  return DELIVERY_STATUS[status]?.label || status || '—';
}

export function getDeliveryStatusColor(status) {
  return DELIVERY_STATUS[status]?.color || 'bg-muted text-muted-foreground';
}

export function formatOrderNumber(order) {
  return order?.order_number || `#${order?.id?.slice(0, 8).toUpperCase()}`;
}
