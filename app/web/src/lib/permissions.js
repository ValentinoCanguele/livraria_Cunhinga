export const PERMISSIONS = {
  manage_catalog: { label: 'Gerir Catálogo', description: 'Livros, coleções e slides' },
  manage_orders: { label: 'Gerir Encomendas', description: 'Ver e actualizar encomendas' },
  manage_settings: { label: 'Configurações', description: 'Marca, rodapé, lojas físicas' },
  manage_users: { label: 'Utilizadores', description: 'Gerir contas e permissões' },
  manage_payments: { label: 'Pagamentos', description: 'Métodos P2P e pagamentos' },
  manage_marketing: { label: 'Marketing', description: 'Mensagens, barra superior, SEO' },
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

export function getUserPermissions(user) {
  if (!user) return { ...DEFAULT_PERMISSIONS };
  if (user.role === 'admin') {
    return Object.fromEntries(Object.keys(PERMISSIONS).map((k) => [k, true]));
  }
  return { ...DEFAULT_PERMISSIONS, ...(user.permissions || {}) };
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
