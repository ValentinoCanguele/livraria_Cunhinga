import React, { createContext, useContext, useEffect, useState } from 'react';
import pb from '@/lib/dataClient';
import { canAccessAdmin, hasPermission, getUserPermissions } from '@/lib/permissions';
import { escapeFilterValue } from '@/lib/sanitizeHtml';
import { supabase } from '@/lib/supabaseClient';
import { normalizeLoginEmail, parsePbAuthError } from '@/lib/pbAuth';
import { requestWelcomeEmail, safeInternalPath } from '@/lib/authSession';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  // A sessão é sempre do Supabase Auth (email/palavra-passe ou Google).
  // O Firebase fica só para as ferramentas do Google Workspace, que pedem o seu próprio acesso.
  const [user, setUser] = useState(() => (pb.authStore.isValid ? pb.authStore.record : null));
  // `ready` é falso até o arranque determinar se existe sessão. Quem protege uma página tem
  // de esperar por ele: decidir antes disso expulsava para `/login` quem tinha sessão válida
  // mas ainda não lida — o caso de todas as voltas do login com a Google, que trazem a sessão
  // no endereço e não no armazenamento.
  const [ready, setReady] = useState(() => pb.authStore.isReady);

  useEffect(() => {
    const unsub = pb.authStore.onChange((_token, record) => setUser(record || null), true);
    const unsubReady = pb.authStore.onReady(() => setReady(true));
    return () => {
      unsub();
      unsubReady();
    };
  }, []);

  // Boas-vindas no primeiro acesso de cada conta. Serve tanto o registo por email como a
  // primeira entrada com a Google, que cria a conta sem passar pela nossa API.
  useEffect(() => {
    if (!ready || !user?.id) return;
    requestWelcomeEmail(pb, user.id);
  }, [ready, user?.id]);

  const value = {
    user,
    ready,
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
      try {
        const created = await pb.collection('users').create({
          email: identity,
          password,
          passwordConfirm: password,
          name: name.trim(),
        });
        if (created?.needsConfirmation) return { needsConfirmation: true, email: identity };
        setUser(created);
        return { record: created };
      } catch (err) {
        throw new Error(parsePbAuthError(err));
      }
    },
    logout: async () => {
      pb.authStore.clear();
      setUser(null);
      // Termina também a ligação ao Google Workspace, se existir. O Firebase só serve as
      // ferramentas Workspace do painel: é carregado aqui, e não no arranque da loja, para
      // não pôr 154 KB gzip no caminho crítico de quem só vem comprar um livro.
      const tinhaGoogle = !!sessionStorage.getItem('google_access_token');
      sessionStorage.removeItem('google_access_token');
      if (tinhaGoogle) {
        await import('@/lib/firebaseClient')
          .then((m) => m.logoutFirebase())
          .catch(() => {});
      }
    },
    // Redirecciona para a Google; ao voltar, o Supabase cria a sessão e o perfil.
    // O destino é validado aqui também, e não só em quem chama: é o que acaba em
    // `redirectTo`, e um caminho não verificado levava o utilizador para fora da loja
    // logo a seguir a autenticar-se.
    loginWithGoogle: async (redirectPath = '/profile') => {
      const target = safeInternalPath(redirectPath, '/profile');
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}${target}` },
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
      try {
        await pb.collection('users').authWithPassword(email, oldPassword);
      } catch {
        throw new Error('A palavra-passe actual está incorrecta. Se entrou com a Google e nunca definiu uma, use "Esqueceu?" no ecrã de entrada.');
      }
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
