import React, { useEffect, useState } from 'react';
import { db, handleFirestoreError, OperationType } from '@/lib/firebaseClient';
import { collection, getDocs, addDoc } from 'firebase/firestore';
import { useCart } from '@/hooks/useCart';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, BookOpen, Loader2, Check } from 'lucide-react';

export default function FirestoreBooksList({ onCartOpen }) {
  const { addToCart } = useCart();
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addingBook, setAddingBook] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [addedItemIds, setAddedItemIds] = useState({});

  // Form states
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [price, setPrice] = useState('');
  const [cover, setCover] = useState('');
  const [description, setDescription] = useState('');
  const [genre, setGenre] = useState('');

  const fetchBooks = async () => {
    setLoading(true);
    const path = 'books';
    try {
      const snapshot = await getDocs(collection(db, path));
      const list = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setBooks(list);
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, path);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBooks();
  }, []);

  const handleCreateBook = async (e) => {
    e.preventDefault();
    if (!title || !author || !price || !cover) return;

    setAddingBook(true);
    const path = 'books';
    const payload = {
      title,
      author,
      price: parseFloat(price),
      cover,
      description: description || 'Sem descrição detalhada.',
      genre: genre || 'Geral'
    };

    try {
      await addDoc(collection(db, path), payload);
      // Reset form
      setTitle('');
      setAuthor('');
      setPrice('');
      setCover('');
      setDescription('');
      setGenre('');
      setShowForm(false);
      // Re-fetch list
      await fetchBooks();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    } finally {
      setAddingBook(false);
    }
  };

  const handleAddToCart = (book) => {
    // Adapt Firestore book to cart format
    const cartProduct = {
      id: `firestore_${book.id}`,
      title: book.title,
      author: book.author,
      price: book.price,
      image: book.cover || 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?w=500',
      cover: book.cover || 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?w=500',
      stock: 99
    };
    
    const cartVariant = {
      id: `variant_firestore_${book.id}`,
      price_in_cents: (Number(book.price) || 0) * 100,
      price_formatted: `${book.price} Kz`,
      inventory_quantity: 99,
      manage_inventory: false,
      currency_info: { code: 'AOA', symbol: 'Kz' }
    };

    addToCart(cartProduct, cartVariant, 1, 99);
    if (onCartOpen) onCartOpen();

    setAddedItemIds(prev => ({ ...prev, [book.id]: true }));
    setTimeout(() => {
      setAddedItemIds(prev => ({ ...prev, [book.id]: false }));
    }, 1500);
  };

  return (
    <div className="bg-card border rounded-2xl p-6 md:p-8 shadow-sm space-y-8" id="firestore-books-section">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Coleção da Comunidade (Firestore)</h2>
          <p className="text-sm text-muted-foreground mt-1">Livros armazenados dinamicamente na base de dados Firestore.</p>
        </div>
        <Button 
          onClick={() => setShowForm(!showForm)} 
          variant={showForm ? "outline" : "default"}
          className="rounded-full flex items-center gap-2 text-xs md:text-sm"
        >
          {showForm ? 'Fechar Formulário' : (
            <>
              <Plus className="h-4 w-4" />
              <span>Publicar Livro</span>
            </>
          )}
        </Button>
      </div>

      {showForm && (
        <form onSubmit={handleCreateBook} className="bg-muted/40 p-5 rounded-xl border border-border/60 space-y-4 max-w-2xl">
          <h3 className="text-base font-bold text-foreground">Preencher Detalhes do Livro</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Título *</label>
              <Input 
                value={title} 
                onChange={e => setTitle(e.target.value)} 
                placeholder="Ex: O Grande Conflito" 
                required 
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Autor *</label>
              <Input 
                value={author} 
                onChange={e => setAuthor(e.target.value)} 
                placeholder="Ex: Ellen G. White" 
                required 
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Preço (Kz) *</label>
              <Input 
                type="number" 
                value={price} 
                onChange={e => setPrice(e.target.value)} 
                placeholder="Ex: 5000" 
                required 
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">URL da Imagem de Capa *</label>
              <Input 
                value={cover} 
                onChange={e => setCover(e.target.value)} 
                placeholder="Ex: https://images.unsplash.com/photo-..." 
                required 
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Categoria / Gênero</label>
              <Input 
                value={genre} 
                onChange={e => setGenre(e.target.value)} 
                placeholder="Ex: Religioso, Educativo" 
              />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-semibold text-muted-foreground">Descrição Curta</label>
              <Input 
                value={description} 
                onChange={e => setDescription(e.target.value)} 
                placeholder="Ex: Uma reflexão profunda sobre as escrituras sagradas..." 
              />
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={addingBook} className="rounded-full">
              {addingBook ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  A guardar...
                </>
              ) : 'Gravar no Firestore'}
            </Button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6" id="firestore-books-skeleton">
          {[1, 2, 3, 4].map((index) => (
            <div key={index} className="bg-card rounded-xl overflow-hidden border border-border/80 flex flex-col h-full animate-pulse">
              <div className="aspect-[3/4] bg-muted relative flex items-center justify-center">
                <div className="w-12 h-12 rounded-full bg-slate-200/50 dark:bg-slate-700/50" />
              </div>
              <div className="p-4 flex flex-col flex-1 space-y-3">
                <div className="space-y-2 flex-1">
                  <div className="h-3 bg-muted rounded-full w-1/2" />
                  <div className="h-4 bg-muted rounded-full w-11/12" />
                  <div className="h-4 bg-muted rounded-full w-4/5" />
                </div>
                <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between">
                  <div className="h-5 bg-muted rounded-full w-1/3" />
                  <div className="h-8 bg-muted rounded-full w-1/4" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : books.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {books.map((book) => (
            <div key={book.id} className="bg-card rounded-xl overflow-hidden border border-border/80 hover:shadow-lg transition-all duration-300 flex flex-col group h-full">
              <div className="aspect-[3/4] overflow-hidden relative bg-muted flex items-center justify-center">
                <img 
                  src={book.cover || 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?w=500'} 
                  alt={book.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  onError={(e) => {
                    e.target.src = 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?w=500';
                  }}
                />
                {book.genre && (
                  <span className="absolute top-2 left-2 bg-black/60 text-white text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider backdrop-blur-sm">
                    {book.genre}
                  </span>
                )}
              </div>
              <div className="p-4 flex flex-col flex-1">
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground font-medium truncate mb-1">{book.author}</p>
                  <h4 className="text-sm font-bold text-foreground line-clamp-2 leading-tight min-h-[2.5rem]">{book.title}</h4>
                </div>
                <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between">
                  <span className="text-sm font-extrabold text-foreground">{Number(book.price).toLocaleString('pt-AO')} Kz</span>
                  <Button 
                    size="sm" 
                    onClick={() => handleAddToCart(book)}
                    className="rounded-full text-xs h-8"
                  >
                    {addedItemIds[book.id] ? <Check className="h-3.5 w-3.5" /> : 'Comprar'}
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 border-2 border-dashed border-border/60 rounded-xl max-w-md mx-auto space-y-4">
          <BookOpen className="h-10 w-10 mx-auto text-muted-foreground/60" />
          <div>
            <h4 className="text-base font-bold text-foreground">Nenhum livro publicado</h4>
            <p className="text-xs text-muted-foreground max-w-xs mx-auto mt-1">A base de dados Firestore está vazia. Seja o primeiro a publicar um livro nesta coleção!</p>
          </div>
          <Button onClick={() => setShowForm(true)} size="sm" className="rounded-full">
            Criar Primeiro Livro
          </Button>
        </div>
      )}
    </div>
  );
}
