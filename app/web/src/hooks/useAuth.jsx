import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import pb from '@/lib/pocketbaseClient';
import { canAccessAdmin, hasPermission, getUserPermissions } from '@/lib/permissions';
import { escapeFilterValue } from '@/lib/sanitizeHtml';
import { auth, loginWithGoogleFirebase, logoutFirebase } from '@/lib/firebaseClient';
import { onAuthStateChanged } from 'firebase/auth';
import { normalizeLoginEmail, parsePbAuthError } from '@/lib/pbAuth';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [firebaseUser, setFirebaseUser] = useState(null);
  const preferPocketBaseRef = useRef(false);

  useEffect(() => {
    const unsubPB = pb.authStore.onChange((_token, record) => {
      if (record) {
        preferPocketBaseRef.current = true;
        setUser(record);
        setFirebaseUser(null);
      } else if (!auth.currentUser) {
        preferPocketBaseRef.current = false;
        setUser(null);
      }
    });

    const unsubFirebase = onAuthStateChanged(auth, (fbUser) => {
      if (fbUser) {
        if (preferPocketBaseRef.current && pb.authStore.isValid) {
          return;
        }
        preferPocketBaseRef.current = false;
        setFirebaseUser(fbUser);
        setUser({
          id: fbUser.uid,
          uid: fbUser.uid,
          email: fbUser.email,
          name: fbUser.displayName || fbUser.email?.split('@')[0] || 'Utilizador',
          role: fbUser.email === 'ValentinoCanguele@gmail.com' ? 'admin' : 'member',
          isFirebase: true,
          avatar: fbUser.photoURL,
        });
        if (pb.authStore.isValid) pb.authStore.clear();
      } else {
        setFirebaseUser(null);
        if (pb.authStore.isValid) {
          setUser(pb.authStore.record);
        } else {
          preferPocketBaseRef.current = false;
          setUser(null);
        }
      }
    });

    if (pb.authStore.isValid) {
      preferPocketBaseRef.current = true;
      setUser(pb.authStore.record);
    }

    return () => {
      unsubPB();
      unsubFirebase();
    };
  }, []);

  const value = {
    user,
    isAuthed: pb.authStore.isValid || !!firebaseUser,
    isAdmin: user?.role === 'admin',
    canAccessAdmin: canAccessAdmin(user),
    hasPermission: (key) => hasPermission(user, key),
    permissions: getUserPermissions(user),
    login: async (email, password) => {
      await logoutFirebase().catch(() => {});
      preferPocketBaseRef.current = true;
      const identity = normalizeLoginEmail(email);
      try {
        const authData = await pb.collection('users').authWithPassword(identity, password);
        setUser(authData.record);
        setFirebaseUser(null);
        return authData;
      } catch (err) {
        preferPocketBaseRef.current = false;
        throw new Error(parsePbAuthError(err));
      }
    },
    signup: async (email, password, name) => {
      await logoutFirebase().catch(() => {});
      preferPocketBaseRef.current = true;
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
      preferPocketBaseRef.current = false;
      pb.authStore.clear();
      setUser(null);
      await logoutFirebase();
    },
    loginWithGoogle: async () => {
      preferPocketBaseRef.current = false;
      pb.authStore.clear();
      const fbUser = await loginWithGoogleFirebase();
      return fbUser;
    },
    requestPasswordReset: (email) =>
      pb.collection('users').requestPasswordReset(
        normalizeLoginEmail(email),
        `${window.location.origin}/reset-password`,
      ),
    confirmPasswordReset: (token, password) =>
      pb.collection('users').confirmPasswordReset(token, password, password),
    updateProfile: async ({ name, email, phone }) => {
      if (user?.isFirebase) {
        const updated = { ...user, name, email, phone };
        setUser(updated);
        return updated;
      }
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
      if (user?.isFirebase) {
        throw new Error('O avatar do utilizador Google é gerido pela sua conta Google');
      }
      const id = pb.authStore.record?.id;
      if (!id) throw new Error('Não autenticado');
      const formData = new FormData();
      formData.append('avatar', file);
      const updated = await pb.collection('users').update(id, formData);
      setUser(updated);
      return updated;
    },
    changePassword: async (oldPassword, newPassword) => {
      if (user?.isFirebase) {
        throw new Error('A palavra-passe do utilizador Google é gerida pela Google');
      }
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
