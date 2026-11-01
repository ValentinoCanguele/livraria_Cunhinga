import React, { createContext, useContext, useEffect, useState } from 'react';
import pb from '@/lib/dataClient';
import { canAccessAdmin, hasPermission, getUserPermissions } from '@/lib/permissions';
import { escapeFilterValue } from '@/lib/sanitizeHtml';
import { supabase } from '@/lib/supabaseClient';
import { logoutFirebase } from '@/lib/firebaseClient';
import { normalizeLoginEmail, parsePbAuthError } from '@/lib/pbAuth';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  // A sessão é sempre do Supabase Auth (email/palavra-passe ou Google).
  // O Firebase fica só para as ferramentas do Google Workspace, que pedem o seu próprio acesso.
  const [user, setUser] = useState(() => (pb.authStore.isValid ? pb.authStore.record : null));

  useEffect(() => {
    const unsub = pb.authStore.onChange((_token, record) => setUser(record || null), true);
    return () => unsub();
  }, []);

  const value = {
    user,
    isAuthed: pb.authStore.isValid,
    isAdmin: user?.role === 'admin',
    canAccessAdmin: canAccessAdmin(user),
    hasPermission: (key) => hasPermission(user, key),
    permissions: getUserPermissions(user),
    login: async (email, password) => {
      const identity = normalizeLoginEmail(email);
      try {
        const authData = await pb.collection('users').authWithPassword(identity, password);
        setUser(authData.record);
        return authData;
      } catch (err) {
        throw new Error(parsePbAuthError(err));
      }
    },
    signup: async (email, password, name) => {
      const identity = normalizeLoginEmail(email);
      await pb.collection('users').create({
        email: identity,
        password,
        passwordConfirm: password,
        name: name.trim(),
        role: 'member',
      });
      const authData = await pb.collection('users').authWithPassword(identity, password);
      setUser(authData.record);
      return authData;
    },
    logout: async () => {
      pb.authStore.clear();
      setUser(null);
      // Termina também a ligação ao Google Workspace, se existir.
      sessionStorage.removeItem('google_access_token');
      await logoutFirebase().catch(() => {});
    },
    // Redirecciona para a Google; ao voltar, o Supabase cria a sessão e o perfil.
    loginWithGoogle: async (redirectPath = '/profile') => {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}${redirectPath}` },
      });
      if (error) throw error;
    },
    requestPasswordReset: (email) =>
      pb.collection('users').requestPasswordReset(
        normalizeLoginEmail(email),
        `${window.location.origin}/reset-password`,
      ),
    confirmPasswordReset: (token, password) =>
      pb.collection('users').confirmPasswordReset(token, password, password),
    updateProfile: async ({ name, email, phone }) => {
      const id = pb.authStore.record?.id;
      if (!id) throw new Error('Não autenticado');
      const data = {};
      if (name !== undefined) data.name = name;
      if (email !== undefined) data.email = normalizeLoginEmail(email);
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
    // Encomendas do cliente; as regras (RLS) só devolvem as do email da sessão.
    fetchUserOrders: async (email) => {
      try {
        return await pb.collection('orders').getFullList({
          filter: `customer_email = "${escapeFilterValue(email)}"`,
          sort: '-created',
        });
      } catch (err) {
        console.warn('Failed to fetch orders:', err);
        return [];
      }
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
