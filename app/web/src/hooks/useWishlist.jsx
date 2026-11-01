import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import { db, handleFirestoreError, OperationType } from '@/lib/firebaseClient';
import { collection, query, where, onSnapshot, setDoc, doc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

export const useWishlist = () => {
  const { user, isAuthed } = useAuth();
  const [wishlist, setWishlist] = useState([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!isAuthed || !user?.id) {
      try {
        const stored = localStorage.getItem('local-wishlist');
        setWishlist(stored ? JSON.parse(stored) : []);
      } catch {
        setWishlist([]);
      }
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(
      collection(db, 'wishlists'),
      where('userId', '==', user.id)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = [];
      snapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() });
      });
      setWishlist(items);
      setLoading(false);
    }, (error) => {
      setLoading(false);
      handleFirestoreError(error, OperationType.LIST, 'wishlists');
    });

    return () => unsubscribe();
  }, [user?.id, isAuthed]);

  const isInWishlist = (bookId) => {
    return wishlist.some(item => item.bookId === bookId);
  };

  const addToWishlist = async (book) => {
    const bookTitle = book.title || 'Sem título';

    // Resolve book cover image reliably
    let bookCover = '';
    if (book.image) {
      bookCover = book.image;
    } else if (book.cover) {
      bookCover = book.cover;
    } else if (book.cover_url) {
      bookCover = book.cover_url;
    } else if (book.images && book.images.length > 0) {
      bookCover = book.images[0].url || '';
    } else if (book.expand?.images && book.expand.images.length > 0) {
      bookCover = book.expand.images[0].url || '';
    }

    const bookPrice = typeof book.price === 'number' ? book.price : 0;

    if (!isAuthed || !user?.id) {
      const newItem = {
        id: `local_${book.id}`,
        bookId: book.id,
        bookTitle,
        bookCover,
        bookPrice,
        addedAt: new Date().toISOString()
      };
      setWishlist((prev) => {
        const alreadyIn = prev.some(item => item.bookId === book.id);
        if (alreadyIn) return prev;
        const updated = [...prev, newItem];
        localStorage.setItem('local-wishlist', JSON.stringify(updated));
        return updated;
      });
      toast({
        title: 'Adicionado aos Favoritos',
        description: `"${bookTitle}" foi adicionado com sucesso.`,
      });
      return;
    }

    const docId = `${user.id}_${book.id}`;
    const docRef = doc(db, 'wishlists', docId);

    const payload = {
      userId: user.id,
      bookId: book.id,
      bookTitle,
      bookCover,
      bookPrice,
      addedAt: serverTimestamp(),
    };

    try {
      await setDoc(docRef, payload);
      toast({
        title: 'Adicionado à Lista de Desejos',
        description: `"${bookTitle}" foi adicionado com sucesso.`,
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `wishlists/${docId}`);
    }
  };

  const removeFromWishlist = async (bookId) => {
    if (!isAuthed || !user?.id) {
      setWishlist((prev) => {
        const updated = prev.filter(item => item.bookId !== bookId);
        localStorage.setItem('local-wishlist', JSON.stringify(updated));
        return updated;
      });
      toast({
        title: 'Removido dos Favoritos',
        description: 'O livro foi removido com sucesso.',
      });
      return;
    }

    const docId = `${user.id}_${bookId}`;
    const docRef = doc(db, 'wishlists', docId);

    try {
      await deleteDoc(docRef);
      toast({
        title: 'Removido da Lista de Desejos',
        description: 'O livro foi removido com sucesso.',
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `wishlists/${docId}`);
    }
  };

  const toggleWishlist = async (book) => {
    if (isInWishlist(book.id)) {
      await removeFromWishlist(book.id);
    } else {
      await addToWishlist(book);
    }
  };

  return {
    wishlist,
    loading,
    isInWishlist,
    addToWishlist,
    removeFromWishlist,
    toggleWishlist,
  };
};
