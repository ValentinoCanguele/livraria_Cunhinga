/** Categorias principais de pagamento no checkout */
export const PAYMENT_CATEGORIES = {
  gateway: {
    id: 'gateway',
    label: 'Pagar',
    shortLabel: 'Pagar online',
    description: 'Pague pelo gateway configurado (Multicaixa Express, transferência, etc.)',
    icon: 'gateway',
  },
  balcao: {
    id: 'balcao',
    label: 'Pagar no Balcão',
    shortLabel: 'Balcão',
    description: 'Pague presencialmente numa das nossas lojas físicas',
    icon: 'balcao',
  },
  on_delivery: {
    id: 'on_delivery',
    label: 'Pagar na Entrega',
    shortLabel: 'Na entrega',
    description: 'Pague quando receber a encomenda em casa',
    icon: 'delivery',
  },
};

export const GATEWAY_PROVIDERS = {
  multicaixa_express: 'Multicaixa Express',
  unitel_money: 'Unitel Money',
  bank_transfer: 'Transferência Bancária',
  other: 'Outro gateway',
};

/** Mapeia tipos antigos para categoria quando `category` não existe */
export function inferPaymentCategory(method) {
  if (method?.category) return method.category;
  const code = method?.code || '';
  if (code === 'balcao') return 'balcao';
  if (code === 'entrega') return 'on_delivery';
  if (method?.type === 'p2p' || method?.type === 'transfer') return 'gateway';
  if (method?.type === 'offline') return 'on_delivery';
  return 'gateway';
}

export function normalizePaymentMethod(method) {
  const category = inferPaymentCategory(method);
  return {
    ...method,
    category,
    requires_reference: method.requires_reference ?? (category === 'gateway' && method.type !== 'offline'),
    gateway_provider: method.gateway_provider || '',
  };
}

export function groupPaymentMethods(methods = []) {
  const normalized = methods.map(normalizePaymentMethod);
  const grouped = { gateway: [], balcao: [], on_delivery: [] };
  for (const m of normalized) {
    const cat = grouped[m.category] ? m.category : 'gateway';
    grouped[cat].push(m);
  }
  return grouped;
}

export function getAvailableCategories(methods = []) {
  const grouped = groupPaymentMethods(methods);
  return Object.values(PAYMENT_CATEGORIES).filter((c) => grouped[c.id]?.length > 0);
}

export function getDefaultPaymentSelection(methods = []) {
  const grouped = groupPaymentMethods(methods);
  const categories = getAvailableCategories(methods);
  const category = categories[0]?.id || 'gateway';
  const method = grouped[category]?.[0];
  return {
    paymentCategory: category,
    paymentMethod: method?.code || 'multicaixa',
  };
}

export function methodRequiresReference(method) {
  const m = normalizePaymentMethod(method);
  if (m.category === 'balcao' || m.category === 'on_delivery') return false;
  return !!m.requires_reference;
}

export function getPaymentStatusForCategory(category) {
  if (category === 'gateway') return 'awaiting_confirmation';
  return 'pending';
}

export function buildPaymentMethodsMap(methods = []) {
  const map = {};
  for (const m of methods) {
    map[m.code] = m.name;
  }
  return map;
}

export function resolveOrderPaymentLabel(order, methodsMap = {}) {
  return order?.payment_method_name
    || methodsMap[order?.payment_method_code]
    || methodsMap[order?.payment_method]
    || order?.payment_method_code
    || order?.payment_method
    || '—';
}

export function resolveOrderPaymentCategory(order) {
  if (order?.payment_category) return order.payment_category;
  const code = order?.payment_method_code || order?.payment_method || '';
  if (code === 'balcao') return 'balcao';
  if (code === 'entrega') return 'on_delivery';
  return 'gateway';
}
