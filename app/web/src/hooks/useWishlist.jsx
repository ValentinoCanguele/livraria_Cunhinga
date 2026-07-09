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
      setWishlist([]);
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
    if (!isAuthed || !user?.id) {
      toast({
        variant: 'destructive',
        title: 'Iniciar sessão necessário',
        description: 'Por favor, inicie sessão para adicionar livros à sua lista de desejos.',
      });
      return;
    }

    const docId = `${user.id}_${book.id}`;
    const docRef = doc(db, 'wishlists', docId);

    // Resolve book cover image reliably
    let bookCover = '';
    if (book.cover_url) {
      bookCover = book.cover_url;
    } else if (book.images && book.images.length > 0) {
      bookCover = book.images[0].url || '';
    } else if (book.expand?.images && book.expand.images.length > 0) {
      bookCover = book.expand.images[0].url || '';
    }

    const bookTitle = book.title || 'Sem título';
    const bookPrice = typeof book.price === 'number' ? book.price : 0;

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
    if (!isAuthed || !user?.id) return;

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
