import { useState, useEffect, useMemo } from 'react';
import { useAuth } from './useAuth';
import { db, handleFirestoreError, OperationType } from '@/lib/firebaseClient';
import { collection, query, where, onSnapshot, setDoc, doc, deleteDoc, serverTimestamp, orderBy } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

export const useReviews = (bookId) => {
  const { user, isAuthed, fetchUserOrders } = useAuth();
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [userOrders, setUserOrders] = useState([]);
  const { toast } = useToast();

  // 1. Fetch all reviews for this book
  useEffect(() => {
    if (!bookId) return;

    setLoading(true);
    const q = query(
      collection(db, 'reviews'),
      where('bookId', '==', bookId),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = [];
      snapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() });
      });
      setReviews(items);
      setLoading(false);
    }, (error) => {
      setLoading(false);
      // Fallback if index is building or query fails
      console.warn('Reviews listing query failed:', error);
      // Try un-ordered query as fallback
      const fallbackQuery = query(
        collection(db, 'reviews'),
        where('bookId', '==', bookId)
      );
      onSnapshot(fallbackQuery, (snapshot) => {
        const items = [];
        snapshot.forEach((doc) => {
          items.push({ id: doc.id, ...doc.data() });
        });
        setReviews(items);
        setLoading(false);
      }, (fallbackError) => {
        handleFirestoreError(fallbackError, OperationType.LIST, `reviews?bookId=${bookId}`);
      });
    });

    return () => unsubscribe();
  }, [bookId]);

  // 2. Fetch user's orders to verify purchase status
  useEffect(() => {
    const loadOrders = async () => {
      if (isAuthed && user?.email) {
        try {
          const orders = await fetchUserOrders(user.email);
          setUserOrders(orders || []);
        } catch (err) {
          console.error('Error loading user orders for verification:', err);
        }
      } else {
        setUserOrders([]);
      }
    };
    loadOrders();
  }, [user?.email, isAuthed, fetchUserOrders]);

  // 3. Check if user has purchased this book (by comparing title or bookId)
  const hasPurchased = useMemo(() => {
    if (!isAuthed || userOrders.length === 0 || !bookId) return false;
    return userOrders.some(order => {
      const items = order.items || [];
      return items.some(item => {
        // Match by title (case-insensitive) or product ID
        const matchTitle = item.title?.toLowerCase() === bookId.toLowerCase() || 
                           item.product_id === bookId;
        return matchTitle;
      });
    });
  }, [userOrders, bookId, isAuthed]);

  // 4. Calculate stats (Average Rating, etc)
  const stats = useMemo(() => {
    if (reviews.length === 0) return { average: 0, total: 0, counts: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } };
    const sum = reviews.reduce((acc, r) => acc + (r.rating || 0), 0);
    const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    reviews.forEach(r => {
      if (counts[r.rating] !== undefined) counts[r.rating]++;
    });
    return {
      average: Number((sum / reviews.length).toFixed(1)),
      total: reviews.length,
      counts
    };
  }, [reviews]);

  // 5. Submit a new review or edit existing
  const submitReview = async (rating, comment) => {
    if (!isAuthed || !user?.id) {
      toast({
        variant: 'destructive',
        title: 'Iniciar sessão necessário',
        description: 'Por favor, inicie sessão para deixar uma avaliação.',
      });
      return false;
    }

    if (rating < 1 || rating > 5) {
      toast({
        variant: 'destructive',
        title: 'Classificação inválida',
        description: 'Por favor, selecione uma classificação entre 1 e 5 estrelas.',
      });
      return false;
    }

    if (!comment || comment.trim().length < 5) {
      toast({
        variant: 'destructive',
        title: 'Comentário muito curto',
        description: 'Por favor, escreva um comentário com pelo menos 5 caracteres.',
      });
      return false;
    }

    setSubmitting(true);
    const docId = `${user.id}_${bookId}`;
    const docRef = doc(db, 'reviews', docId);

    const payload = {
      userId: user.id,
      userName: user.name || user.email.split('@')[0],
      userAvatar: user.avatar || null,
      bookId,
      rating: Number(rating),
      comment: comment.trim(),
      createdAt: serverTimestamp(),
      isVerified: hasPurchased,
    };

    try {
      await setDoc(docRef, payload);
      toast({
        title: 'Avaliação Guardada',
        description: 'A sua avaliação foi registada com sucesso! Obrigado pelo seu feedback.',
      });
      setSubmitting(false);
      return true;
    } catch (error) {
      setSubmitting(false);
      handleFirestoreError(error, OperationType.CREATE, `reviews/${docId}`);
      return false;
    }
  };

  // 6. Delete review
  const deleteReview = async () => {
    if (!isAuthed || !user?.id) return false;
    const docId = `${user.id}_${bookId}`;
    const docRef = doc(db, 'reviews', docId);

    try {
      await deleteDoc(docRef);
      toast({
        title: 'Avaliação Removida',
        description: 'A sua avaliação foi removida.',
      });
      return true;
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `reviews/${docId}`);
      return false;
    }
  };

  // Check if current user has already reviewed
  const userReview = useMemo(() => {
    if (!isAuthed || !user?.id) return null;
    return reviews.find(r => r.userId === user.id) || null;
  }, [reviews, user?.id, isAuthed]);

  return {
    reviews,
    loading,
    submitting,
    stats,
    hasPurchased,
    submitReview,
    deleteReview,
    userReview,
  };
};
