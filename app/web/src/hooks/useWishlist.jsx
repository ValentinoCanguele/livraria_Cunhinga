import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import { supabase, mediaUrl } from '@/lib/supabaseClient';
import { useToast } from '@/hooks/use-toast';

const LOCAL_KEY = 'local-wishlist';

function readLocal() {
  try {
    const stored = localStorage.getItem(LOCAL_KEY);
    const items = stored ? JSON.parse(stored) : [];
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
}

function writeLocal(items) {
  try {
    if (items.length) localStorage.setItem(LOCAL_KEY, JSON.stringify(items));
    else localStorage.removeItem(LOCAL_KEY);
  } catch {
    // Sem armazenamento local (modo privado): a lista fica só em memória.
  }
}

function bookCoverOf(book) {
  if (!book) return '';
  if (book.image) return book.image;
  if (book.cover) return book.cover;
  if (book.cover_url) return book.cover_url;
  if (book.cover_image) return mediaUrl('stock_books', book.id, book.cover_image);
  if (book.images?.length) return book.images[0].url || '';
  if (book.expand?.images?.length) return book.expand.images[0].url || '';
  return '';
}

function toItem(bookId, book, addedAt) {
  return {
    id: bookId,
    bookId,
    bookTitle: book?.title || 'Sem título',
    bookCover: bookCoverOf(book),
    bookPrice: typeof book?.price === 'number' ? book.price : 0,
    addedAt,
  };
}

// Estado partilhado por todos os componentes (cada cartão de livro usa o hook).
const store = { userId: undefined, items: [], loading: false, listeners: new Set() };

function setStore(patch) {
  Object.assign(store, patch);
  store.listeners.forEach((fn) => fn());
}

function setItems(updater) {
  setStore({ items: typeof updater === 'function' ? updater(store.items) : updater });
}

async function loadFor(userId) {
  if (!userId) {
    setStore({ items: readLocal(), loading: false });
    return;
  }
  setStore({ loading: true });
  try {
    const pending = readLocal();
    if (pending.length) {
      const rows = pending.map((item) => ({ user_id: userId, book_id: item.bookId }));
      const { error } = await supabase
        .from('wishlists')
        .upsert(rows, { onConflict: 'user_id,book_id', ignoreDuplicates: true });
      if (!error) writeLocal([]);
    }
    const { data, error } = await supabase
      .from('wishlists')
      .select('book_id, created, stock_books (id, title, price, cover, cover_image)')
      .eq('user_id', userId)
      .order('created', { ascending: false });
    if (error) throw error;
    if (store.userId === userId) {
      setItems((data || []).map((row) => toItem(row.book_id, row.stock_books, row.created)));
    }
  } catch (error) {
    console.warn('Não foi possível carregar a lista de desejos:', error);
  } finally {
    if (store.userId === userId) setStore({ loading: false });
  }
}

/**
 * Lista de desejos. Com sessão, fica na tabela "wishlists" do Supabase; sem sessão,
 * no armazenamento local do browser. Ao iniciar sessão, os livros guardados sem
 * sessão passam para a conta.
 */
export const useWishlist = () => {
  const { user, isAuthed } = useAuth();
  const userId = isAuthed ? user?.id || null : null;
  const [, rerender] = useState(0);
  const { toast } = useToast();

  useEffect(() => {
    const listener = () => rerender((n) => n + 1);
    store.listeners.add(listener);
    return () => { store.listeners.delete(listener); };
  }, []);

  useEffect(() => {
    if (store.userId === userId) return;
    store.userId = userId;
    loadFor(userId);
  }, [userId]);

  const wishlist = store.items;
  const loading = store.loading;

  const isInWishlist = (bookId) => wishlist.some((item) => item.bookId === bookId);

  const addToWishlist = async (book) => {
    const item = toItem(book.id, book, new Date().toISOString());

    if (!userId) {
      if (!store.items.some((i) => i.bookId === book.id)) {
        setItems((prev) => [...prev, item]);
        writeLocal(store.items);
      }
      toast({ title: 'Adicionado aos Favoritos', description: `"${item.bookTitle}" foi adicionado com sucesso.` });
      return;
    }

    setItems((prev) => (prev.some((i) => i.bookId === book.id) ? prev : [item, ...prev]));
    const { error } = await supabase
      .from('wishlists')
      .upsert({ user_id: userId, book_id: book.id }, { onConflict: 'user_id,book_id', ignoreDuplicates: true });
    if (error) {
      setItems((prev) => prev.filter((i) => i.bookId !== book.id));
      toast({ variant: 'destructive', title: 'Não foi possível guardar', description: error.message });
      return;
    }
    toast({ title: 'Adicionado à Lista de Desejos', description: `"${item.bookTitle}" foi adicionado com sucesso.` });
  };

  const removeFromWishlist = async (bookId) => {
    if (!userId) {
      setItems((prev) => prev.filter((item) => item.bookId !== bookId));
      writeLocal(store.items);
      toast({ title: 'Removido dos Favoritos', description: 'O livro foi removido com sucesso.' });
      return;
    }

    const removed = store.items.find((item) => item.bookId === bookId);
    setItems((prev) => prev.filter((item) => item.bookId !== bookId));
    const { error } = await supabase.from('wishlists').delete().eq('user_id', userId).eq('book_id', bookId);
    if (error) {
      if (removed) setItems((prev) => [removed, ...prev]);
      toast({ variant: 'destructive', title: 'Não foi possível remover', description: error.message });
      return;
    }
    toast({ title: 'Removido da Lista de Desejos', description: 'O livro foi removido com sucesso.' });
  };

  const toggleWishlist = async (book) => {
    if (isInWishlist(book.id)) await removeFromWishlist(book.id);
    else await addToWishlist(book);
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
