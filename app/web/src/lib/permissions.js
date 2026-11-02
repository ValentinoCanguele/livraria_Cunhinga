// Permissões granulares do painel. As mesmas chaves são verificadas no servidor
// (private.has_permission na base de dados e requirePermission na Edge Function).
export const PERMISSIONS = {
  manage_catalog: { label: 'Gerir Catálogo', description: 'Livros, coleções e slides' },
  manage_orders: { label: 'Gerir Encomendas', description: 'Ver e actualizar encomendas' },
  manage_settings: { label: 'Configurações', description: 'Marca, rodapé, lojas físicas e integrações' },
  manage_users: { label: 'Utilizadores e Clientes', description: 'Gerir contas de clientes (a equipa é só para administradores)' },
  manage_payments: { label: 'Pagamentos', description: 'Métodos de pagamento' },
  manage_marketing: { label: 'Marketing', description: 'Mensagens, barra superior, SEO' },
};

export const ROLES = {
  member: { label: 'Cliente', description: 'Compra na loja e acompanha as suas encomendas. Sem acesso ao painel.' },
  manager: { label: 'Gestor', description: 'Acesso ao painel apenas nas áreas que lhe forem permitidas.' },
  admin: { label: 'Administrador', description: 'Acesso total, incluindo a equipa, papéis e permissões.' },
};

export const DEFAULT_PERMISSIONS = {
  manage_catalog: false,
  manage_orders: false,
  manage_settings: false,
  manage_users: false,
  manage_payments: false,
  manage_marketing: false,
};

export const MANAGER_PERMISSIONS = {
  manage_catalog: true,
  manage_orders: true,
  manage_settings: false,
  manage_users: false,
  manage_payments: false,
  manage_marketing: true,
};

/** Só os gestores usam permissões granulares; clientes não têm nenhuma e administradores têm todas. */
export function getUserPermissions(user) {
  if (!user) return { ...DEFAULT_PERMISSIONS };
  if (user.role === 'admin') {
    return Object.fromEntries(Object.keys(PERMISSIONS).map((k) => [k, true]));
  }
  if (user.role !== 'manager') return { ...DEFAULT_PERMISSIONS };
  const own = user.permissions || {};
  return Object.fromEntries(Object.keys(PERMISSIONS).map((k) => [k, own[k] === true]));
}

export function hasPermission(user, key) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  return !!getUserPermissions(user)[key];
}

export function canAccessAdmin(user) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  return Object.values(getUserPermissions(user)).some(Boolean);
}
