import React, { createContext, useContext, useEffect, useState } from 'react';
import pb from '@/lib/pocketbaseClient';
import { canAccessAdmin, hasPermission, getUserPermissions } from '@/lib/permissions';
import { escapeFilterValue } from '@/lib/sanitizeHtml';

const AuthContext = createContext(null);
const PB_URL = import.meta.env.VITE_POCKETBASE_URL || 'http://127.0.0.1:8090';

export const AuthProvider = ({ children }) => {
  const [authSnapshot, setAuthSnapshot] = useState(() => ({
    user: pb.authStore.record,
    isAuthed: pb.authStore.isValid,
  }));

  const { user, isAuthed } = authSnapshot;

  useEffect(() => {
    const unsub = pb.authStore.onChange((_t, record) => {
      setAuthSnapshot({
        user: record,
        isAuthed: pb.authStore.isValid,
      });
    });
    return unsub;
  }, []);

  const syncUser = (record) => {
    setAuthSnapshot({
      user: record,
      isAuthed: pb.authStore.isValid,
    });
  };

  const value = {
    user,
    isAuthed,
    isAdmin: user?.role === 'admin',
    canAccessAdmin: canAccessAdmin(user),
    hasPermission: (key) => hasPermission(user, key),
    permissions: getUserPermissions(user),
    login: async (email, password) => {
      const auth = await pb.collection('users').authWithPassword(email, password);
      setAuthSnapshot({ user: auth.record, isAuthed: true });
      return auth;
    },
    signup: async (email, password, name) => {
      await pb.collection('users').create({ email, password, passwordConfirm: password, name, role: 'member' });
      const auth = await pb.collection('users').authWithPassword(email, password);
      setAuthSnapshot({ user: auth.record, isAuthed: true });
      return auth;
    },
    logout: () => {
      pb.authStore.clear();
      setAuthSnapshot({ user: null, isAuthed: false });
    },
    loginWithGoogle: async () => {
      const auth = await pb.collection('users').authWithOAuth2({ provider: 'google' });
      setAuthSnapshot({ user: auth.record, isAuthed: true });
      return auth;
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
      syncUser(updated);
      return updated;
    },
    updateAvatar: async (file) => {
      const id = pb.authStore.record?.id;
      if (!id) throw new Error('Não autenticado');
      const formData = new FormData();
      formData.append('avatar', file);
      const updated = await pb.collection('users').update(id, formData);
      syncUser(updated);
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
