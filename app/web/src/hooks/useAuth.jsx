import React, { createContext, useContext, useEffect, useState } from 'react';
import pb from '@/lib/pocketbaseClient';
import { canAccessAdmin, hasPermission, getUserPermissions } from '@/lib/permissions';
import { escapeFilterValue } from '@/lib/sanitizeHtml';

const AuthContext = createContext(null);
const PB_URL = import.meta.env.VITE_POCKETBASE_URL || 'http://127.0.0.1:8090';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(pb.authStore.record);

  useEffect(() => {
    const unsub = pb.authStore.onChange((_t, record) => setUser(record));
    return unsub;
  }, []);

  const value = {
    user,
    isAuthed: pb.authStore.isValid,
    isAdmin: user?.role === 'admin',
    canAccessAdmin: canAccessAdmin(user),
    hasPermission: (key) => hasPermission(user, key),
    permissions: getUserPermissions(user),
    login: (email, password) => pb.collection('users').authWithPassword(email, password),
    signup: async (email, password, name) => {
      await pb.collection('users').create({ email, password, passwordConfirm: password, name, role: 'member' });
      return pb.collection('users').authWithPassword(email, password);
    },
    logout: () => pb.authStore.clear(),
    loginWithGoogle: async () => {
      return pb.collection('users').authWithOAuth2({ provider: 'google' });
    },
    requestPasswordReset: (email) =>
      pb.collection('users').requestPasswordReset(email, `${window.location.origin}/reset-password`),
    confirmPasswordReset: (token, password) =>
      pb.collection('users').confirmPasswordReset(token, password, password),
    updateProfile: async ({ name, email, phone }) => {
      const id = pb.authStore.record?.id;
      if (!id) throw new Error('Não autenticado');
      const data = {};
      if (name !== undefined) data.name = name;
      if (email !== undefined) data.email = email;
      if (phone !== undefined) data.phone = phone;
      const updated = await pb.collection('users').update(id, data);
      setUser(updated);
      return updated;
    },
    updateAvatar: async (file) => {
      const id = pb.authStore.record?.id;
      if (!id) throw new Error('Não autenticado');
      const formData = new FormData();
      formData.append('avatar', file);
      const updated = await pb.collection('users').update(id, formData);
      setUser(updated);
      return updated;
    },
    changePassword: async (oldPassword, newPassword) => {
      const email = pb.authStore.record?.email;
      if (!email) throw new Error('Não autenticado');
      await pb.collection('users').authWithPassword(email, oldPassword);
      await pb.collection('users').update(pb.authStore.record.id, {
        oldPassword,
        password: newPassword,
        passwordConfirm: newPassword,
      });
    },
    fetchUserOrders: async (email) => {
      try {
        return await pb.collection('orders').getFullList({
          filter: `customer_email = "${escapeFilterValue(email)}"`,
          sort: '-created',
        });
      } catch {
        return [];
      }
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
