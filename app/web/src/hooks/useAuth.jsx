import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import pb from '@/lib/pocketbaseClient';
import { canAccessAdmin, hasPermission, getUserPermissions } from '@/lib/permissions';
import { escapeFilterValue } from '@/lib/sanitizeHtml';
import { auth, db, loginWithGoogleFirebase, logoutFirebase } from '@/lib/firebaseClient';
import { onAuthStateChanged } from 'firebase/auth';
import { normalizeLoginEmail, parsePbAuthError } from '@/lib/pbAuth';
import { doc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { getCachedGoogleToken, syncGoogleWorkspaceToFirestore } from '@/lib/googleAuth';

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
        
        // Load custom user profile overrides if any (localStorage fallback + firestore backend sync)
        const savedCustom = localStorage.getItem(`custom_profile_${fbUser.uid}`);
        const customData = savedCustom ? JSON.parse(savedCustom) : {};

        setUser({
          id: fbUser.uid,
          uid: fbUser.uid,
          email: fbUser.email,
          name: customData.name || fbUser.displayName || fbUser.email?.split('@')[0] || 'Utilizador',
          phone: customData.phone || '',
          role: fbUser.email === 'ValentinoCanguele@gmail.com' ? 'admin' : 'member',
          isFirebase: true,
          avatar: customData.avatar || fbUser.photoURL,
        });
        if (pb.authStore.isValid) pb.authStore.clear();

        // Save user profile metadata to Firestore
        const userDocRef = doc(db, 'users', fbUser.uid);
        const userDocData = {
          uid: fbUser.uid,
          displayName: customData.name || fbUser.displayName || fbUser.email?.split('@')[0] || 'Utilizador',
          email: fbUser.email,
          photoURL: customData.avatar || fbUser.photoURL || '',
          lastLogin: new Date().toISOString(),
          createdAt: fbUser.metadata.creationTime ? new Date(fbUser.metadata.creationTime).toISOString() : new Date().toISOString()
        };
        setDoc(userDocRef, userDocData, { merge: true }).catch((err) => {
          console.warn('Failed to sync user metadata to Firestore /users collection:', err);
        });

        // Trigger Google Workspace background copy/sync if token exists
        const token = getCachedGoogleToken();
        if (token) {
          syncGoogleWorkspaceToFirestore(fbUser.uid, token).catch((err) => {
            console.warn('Silent auto-sync from useAuth hook failed:', err);
          });
        }
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
      sessionStorage.removeItem('google_access_token');
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
        const customKey = `custom_profile_${user.uid}`;
        const saved = localStorage.getItem(customKey);
        const customData = saved ? JSON.parse(saved) : {};
        if (name !== undefined) customData.name = name;
        if (phone !== undefined) customData.phone = phone;
        localStorage.setItem(customKey, JSON.stringify(customData));

        const updated = { ...user, ...customData };
        setUser(updated);

        try {
          await setDoc(doc(db, 'users', user.uid, 'profile', 'custom'), customData, { merge: true });
        } catch (e) {
          console.warn('Failed to save profile overrides to Firestore:', e);
        }
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
        const reader = new FileReader();
        const base64Promise = new Promise((resolve, reject) => {
          reader.onload = () => resolve(reader.result);
          reader.onerror = (e) => reject(e);
          reader.readAsDataURL(file);
        });
        const base64Url = await base64Promise;

        const customKey = `custom_profile_${user.uid}`;
        const saved = localStorage.getItem(customKey);
        const customData = saved ? JSON.parse(saved) : {};
        customData.avatar = base64Url;
        localStorage.setItem(customKey, JSON.stringify(customData));

        const updated = { ...user, avatar: base64Url };
        setUser(updated);

        try {
          await setDoc(doc(db, 'users', user.uid, 'profile', 'custom'), customData, { merge: true });
        } catch (e) {
          console.warn('Failed to save avatar override to Firestore:', e);
        }
        return updated;
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
      const firestoreOrders = [];
      try {
        const q = query(
          collection(db, 'orders'),
          where('customer_email', '==', email)
        );
        const querySnapshot = await getDocs(q);
        querySnapshot.forEach((doc) => {
          firestoreOrders.push({ id: doc.id, ...doc.data() });
        });
        firestoreOrders.sort((a, b) => new Date(b.created) - new Date(a.created));
      } catch (err) {
        console.warn('Failed to fetch orders from Firestore:', err);
      }

      try {
        const pbOrders = await pb.collection('orders').getFullList({
          filter: `customer_email = "${escapeFilterValue(email)}"`,
          sort: '-created',
        });
        
        const mergedMap = new Map();
        firestoreOrders.forEach(o => mergedMap.set(o.id, o));
        pbOrders.forEach(o => {
          if (!mergedMap.has(o.id)) {
            mergedMap.set(o.id, o);
          }
        });
        const merged = Array.from(mergedMap.values());
        merged.sort((a, b) => new Date(b.created) - new Date(a.created));
        return merged;
      } catch {
        return firestoreOrders;
      }
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
