import React, { createContext, useContext, useEffect, useState } from 'react';
import pb from '@/lib/pocketbaseClient';
import { canAccessAdmin, hasPermission, getUserPermissions } from '@/lib/permissions';
import { escapeFilterValue } from '@/lib/sanitizeHtml';
import { auth, loginWithGoogleFirebase, logoutFirebase } from '@/lib/firebaseClient';
import { onAuthStateChanged } from 'firebase/auth';

const AuthContext = createContext(null);
const PB_URL = import.meta.env.VITE_POCKETBASE_URL || 'http://127.0.0.1:8090';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [firebaseUser, setFirebaseUser] = useState(null);

  useEffect(() => {
    // 1. Listen to PocketBase auth changes
    const unsubPB = pb.authStore.onChange((_t, record) => {
      if (record) {
        setUser(record);
        setFirebaseUser(null);
      } else if (!auth.currentUser) {
        setUser(null);
      }
    });

    // 2. Listen to Firebase auth changes
    const unsubFirebase = onAuthStateChanged(auth, (fbUser) => {
      if (fbUser) {
        setFirebaseUser(fbUser);
        setUser({
          id: fbUser.uid,
          uid: fbUser.uid,
          email: fbUser.email,
          name: fbUser.displayName || fbUser.email.split('@')[0],
          role: fbUser.email === 'ValentinoCanguele@gmail.com' ? 'admin' : 'member',
          isFirebase: true,
          avatar: fbUser.photoURL,
        });
        pb.authStore.clear(); // Clear PocketBase to ensure single source of truth
      } else {
        setFirebaseUser(null);
        if (pb.authStore.isValid) {
          setUser(pb.authStore.record);
        } else {
          setUser(null);
        }
      }
    });

    // Initialize state
    if (pb.authStore.isValid && !auth.currentUser) {
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
    login: (email, password) => pb.collection('users').authWithPassword(email, password),
    signup: async (email, password, name) => {
      await pb.collection('users').create({ email, password, passwordConfirm: password, name, role: 'member' });
      return pb.collection('users').authWithPassword(email, password);
    },
    logout: async () => {
      pb.authStore.clear();
      await logoutFirebase();
    },
    loginWithGoogle: async () => {
      return await loginWithGoogleFirebase();
    },
    requestPasswordReset: (email) =>
      pb.collection('users').requestPasswordReset(email, `${window.location.origin}/reset-password`),
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
      if (email !== undefined) data.email = email;
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
