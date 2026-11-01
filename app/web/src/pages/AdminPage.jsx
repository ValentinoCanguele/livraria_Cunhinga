import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { Plus, Pencil, Trash2, LogOut, Loader2, X, PackageSearch, Image, ShoppingBag, ChevronDown, ChevronUp, Phone, MapPin, Settings, Users, CreditCard, Plug, Layers, AlertTriangle } from 'lucide-react';
import CollectionsTab from '@/components/admin/CollectionsTab';
import SlidesTab from '@/components/admin/SlidesTab';
import { sanitizeBookPayload } from '@/lib/bookSave';
import { pbErrorMessage } from '@/lib/mediaSave';
import BrandLogo from '@/components/BrandLogo';
import BookFormModal from '@/components/admin/BookFormModal';
import SettingsTab from '@/components/admin/SettingsTab';
import UsersTab from '@/components/admin/UsersTab';
import CRMContactsTab from '@/components/admin/CRMContactsTab';
import PaymentsTab from '@/components/admin/PaymentsTab';
import AppsTab from '@/components/admin/AppsTab';
import ContactsManager from '@/components/ContactsManager';
import { pageTitle } from '@/lib/brand';
import pb from '@/lib/pocketbaseClient';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import SalesReportsPanel from '@/components/admin/SalesReportsPanel';
import { getOrderStatusLabel, getOrderStatusColor, formatOrderNumber, PAYMENT_METHODS, ORDER_STATUS, getPaymentStatusLabel, getDeliveryStatusLabel, getDeliveryStatusColor } from '@/lib/orderUtils';
import { displayAngolaPhone } from '@/lib/angolaPhone';
import { getLowStockBooks, clearStockAlert } from '@/api/EcommerceApi';

const AdminPage = () => {
  const { user, isAuthed, isAdmin, canAccessAdmin, hasPermission, logout } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [books, setBooks] = useState([]);
  const [slides, setSlides] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showBookForm, setShowBookForm] = useState(false);
  const [editingBook, setEditingBook] = useState(null);
  const [saving, setSaving] = useState(false);

  const [orderFilter, setOrderFilter] = useState('all');
  const [orderSearch, setOrderSearch] = useState('');
  const [expandedOrder, setExpandedOrder] = useState(null);
  const [lowStockBooks, setLowStockBooks] = useState([]);

  useEffect(() => {
    if (!isAuthed) navigate('/login', { state: { from: '/admin' } });
    else if (!canAccessAdmin) navigate('/profile');
  }, [isAuthed, canAccessAdmin, navigate]);

  const canManageCatalog = isAdmin || hasPermission('manage_catalog');
  const canManageOrders = isAdmin || hasPermission('manage_orders');
  const canManageSettings = isAdmin || hasPermission('manage_settings');
  const canManageUsers = isAdmin || hasPermission('manage_users');
  const canManagePayments = isAdmin || hasPermission('manage_payments');
  const canManageMarketing = isAdmin || hasPermission('manage_marketing');

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [booksList, slidesList, ordersList, lowStock] = await Promise.all([
        pb.collection('stock_books').getFullList({ sort: '-featured,title' }),
        pb.collection('hero_slides').getFullList({ sort: 'sort_order' }).catch(() => []),
        canManageOrders ? pb.collection('orders').getFullList({ sort: '-created' }).catch(() => []) : [],
        canManageCatalog ? getLowStockBooks() : [],
      ]);
      setBooks(booksList);
      setSlides(slidesList);
      setOrders(ordersList);
      setLowStockBooks(lowStock);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [canManageOrders, canManageCatalog]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const handleSaveBook = async (data) => {
    setSaving(true);
    try {
      const payload = sanitizeBookPayload(data);
      if (!payload.title?.trim()) {
        throw new Error('O título do livro é obrigatório.');
      }
      if (editingBook) {
        await pb.collection('stock_books').update(editingBook.id, payload);
        toast({ title: 'Livro atualizado', description: `Código: ${payload.book_code || editingBook.book_code}` });
      } else {
        const created = await pb.collection('stock_books').create(payload);
        toast({ title: 'Livro publicado', description: `ID: ${created.id.slice(0, 8)}… · Código: ${created.book_code}` });
      }
      setShowBookForm(false);
      setEditingBook(null);
      loadAll();
    } catch (err) {
      const msg = pbErrorMessage(err);
      toast({ variant: 'destructive', title: 'Erro ao guardar livro', description: msg });
    } finally {
      setSaving(false);
    }
  };

  const openEditBook = (b) => {
    setEditingBook(b);
    setShowBookForm(true);
  };

  const handleDeleteBook = async (b) => {
    if (!confirm(`Eliminar "${b.title}"?`)) return;
    await pb.collection('stock_books').delete(b.id);
    toast({ title: 'Livro eliminado' });
    loadAll();
  };

  const handleOrderStatus = async (order, newStatus) => {
    try {
      if (newStatus === 'cancelled' && order.status !== 'cancelled') {
        for (const item of order.items || []) {
          if (item.book_id) {
            try {
              const book = await pb.collection('stock_books').getOne(item.book_id);
              await pb.collection('stock_books').update(book.id, {
                stock: (Number(book.stock) || 0) + (Number(item.quantity) || 0),
              });
            } catch { /* ignore */ }
          }
        }
      }
      await pb.collection('orders').update(order.id, { status: newStatus });
      toast({ title: 'Estado atualizado', description: getOrderStatusLabel(newStatus) });
      loadAll();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erro', description: err.message });
    }
  };

  const handleDeliveryStatus = async (order, deliveryStatus) => {
    try {
      await pb.collection('orders').update(order.id, { delivery_status: deliveryStatus });
      toast({ title: 'Estado de entrega actualizado' });
      loadAll();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erro', description: err.message });
    }
  };

  const updateTracking = async (order, tracking, carrier, estimatedDelivery) => {
    try {
      const data = { tracking_number: tracking, carrier };
      if (estimatedDelivery !== undefined) data.estimated_delivery = estimatedDelivery || '';
      await pb.collection('orders').update(order.id, data);
      toast({ title: 'Tracking actualizado' });
      loadAll();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erro', description: err.message });
    }
  };

  const handleClearStockAlert = async (book) => {
    try {
      await clearStockAlert(book.id);
      toast({ title: 'Alerta resolvido', description: `"${book.title}" — reabasteça o stock quando possível.` });
      loadAll();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erro', description: err.message });
    }
  };

  const getOrderChannelLabel = (o) => {
    if (o.order_type === 'whatsapp_order' || o.sale_channel === 'whatsapp') return 'WhatsApp';
    if (o.order_type === 'online_purchase' || o.sale_channel === 'web_purchase') return 'Compra Online';
    return o.sale_channel || o.order_type || '—';
  };

  const handlePaymentStatus = async (order, paymentStatus) => {
    try {
      await pb.collection('orders').update(order.id, { payment_status: paymentStatus });
      toast({ title: 'Pagamento actualizado', description: getPaymentStatusLabel(paymentStatus) });
      loadAll();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erro', description: err.message });
    }
  };

  const filteredOrders = orders.filter((o) => {
    if (orderFilter !== 'all' && o.status !== orderFilter) return false;
    if (orderSearch.trim()) {
      const q = orderSearch.toLowerCase();
      const hay = [o.order_number, o.id, o.customer_name, o.customer_email, o.phone].filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const pendingCount = orders.filter((o) => o.status === 'pending').length;
  const totalRevenue = orders.filter((o) => o.status !== 'cancelled').reduce((s, o) => s + Number(o.total), 0);

  const defaultTab = canManageCatalog ? 'books' : canManageOrders ? 'orders' : canManageSettings ? 'settings' : canManageUsers ? 'users' : 'payments';

  return (
    <>
      <Helmet><title>{pageTitle('Painel Admin')}</title></Helmet>
      <div className="min-h-screen bg-muted/20">
        <header className="bg-background border-b border-border sticky top-0 z-40">
          <div className="container-custom flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <BrandLogo linkTo="/" />
              <span className="font-bold text-lg hidden md:inline border-l border-border pl-3">Painel Admin</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground hidden sm:inline">
                {user?.name || user?.email} {isAdmin && <span className="text-[#0ea5c9] font-medium">· Admin</span>}
              </span>
              <Button variant="outline" size="sm" onClick={() => navigate('/profile')}>Perfil</Button>
              <Button variant="outline" size="sm" onClick={() => { logout(); navigate('/'); }}>
                <LogOut className="h-4 w-4 mr-2" /> Sair
              </Button>
            </div>
          </div>
        </header>

        <main className="container-custom py-10">
          {!canAccessAdmin && (
            <div className="mb-6 p-4 rounded-lg bg-secondary/40 text-sm">Sem permissões de acesso ao painel.</div>
          )}

          {canManageCatalog && lowStockBooks.length > 0 && (
            <div className="mb-6 p-4 rounded-xl border border-amber-500/40 bg-amber-50/80 dark:bg-amber-950/20">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-amber-900 dark:text-amber-200">
                    {lowStockBooks.length} livro{lowStockBooks.length !== 1 ? 's' : ''} precisam de reabastecimento
                  </p>
                  <ul className="mt-2 space-y-1 text-sm">
                    {lowStockBooks.slice(0, 5).map((b) => (
                      <li key={b.id} className="flex flex-wrap items-center justify-between gap-2">
                        <span>
                          <code className="text-xs font-mono text-[#0ea5c9]">{b.book_code}</code>
                          {' '}{b.title} — <strong className={Number(b.stock) <= 0 ? 'text-red-600' : 'text-amber-700'}>{b.stock} un.</strong>
                          {b.stock_alert && <span className="ml-1 text-xs text-red-600">(esgotado)</span>}
                        </span>
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleClearStockAlert(b)}>
                          Marcar resolvido
                        </Button>
                      </li>
                    ))}
                  </ul>
                  {lowStockBooks.length > 5 && (
                    <p className="text-xs text-muted-foreground mt-2">+{lowStockBooks.length - 5} mais na tabela de livros</p>
                  )}
                </div>
              </div>
            </div>
          )}

          <Tabs defaultValue={defaultTab}>
            <TabsList className="mb-8 flex-wrap h-auto gap-1">
              {canManageCatalog && <TabsTrigger value="books"><PackageSearch className="h-4 w-4 mr-1.5" />Livros ({books.length})</TabsTrigger>}
              {canManageCatalog && <TabsTrigger value="collections"><Layers className="h-4 w-4 mr-1.5" />Coleções</TabsTrigger>}
              {canManageCatalog && <TabsTrigger value="slides"><Image className="h-4 w-4 mr-1.5" />Slider ({slides.length})</TabsTrigger>}
              {canManageOrders && <TabsTrigger value="orders"><ShoppingBag className="h-4 w-4 mr-1.5" />Encomendas ({orders.length})</TabsTrigger>}
              {canManageSettings && <TabsTrigger value="settings"><Settings className="h-4 w-4 mr-1.5" />Configurações</TabsTrigger>}
              {canManageUsers && <TabsTrigger value="users"><Users className="h-4 w-4 mr-1.5" />Utilizadores</TabsTrigger>}
              {canManageUsers && <TabsTrigger value="crm"><Users className="h-4 w-4 mr-1.5" />CRM & Contactos</TabsTrigger>}
              {canManagePayments && <TabsTrigger value="payments"><CreditCard className="h-4 w-4 mr-1.5" />Pagamentos</TabsTrigger>}
              {canManageMarketing && <TabsTrigger value="contacts"><Users className="h-4 w-4 mr-1.5" />CRM Contactos</TabsTrigger>}
              {isAdmin && <TabsTrigger value="apps"><Plug className="h-4 w-4 mr-1.5" />Apps</TabsTrigger>}
            </TabsList>

            {canManageSettings && <TabsContent value="settings"><SettingsTab /></TabsContent>}
            {canManageUsers && <TabsContent value="users"><UsersTab /></TabsContent>}
            {canManageUsers && <TabsContent value="crm"><CRMContactsTab /></TabsContent>}
            {canManagePayments && <TabsContent value="payments"><PaymentsTab /></TabsContent>}
            {canManageMarketing && <TabsContent value="contacts"><ContactsManager /></TabsContent>}
            {isAdmin && <TabsContent value="apps"><AppsTab /></TabsContent>}
            {canManageCatalog && (
              <TabsContent value="collections">
                <CollectionsTab books={books} onBooksChange={loadAll} />
              </TabsContent>
            )}

            {loading ? (
              <div className="flex justify-center py-20"><Loader2 className="h-10 w-10 animate-spin text-[#0ea5c9]" /></div>
            ) : (
              <>
                {canManageCatalog && (
                <TabsContent value="books">
                  <div className="flex justify-between mb-6">
                    <div>
                      <h2 className="text-2xl font-bold">Catálogo</h2>
                      <p className="text-sm text-muted-foreground mt-1">{books.length} livros · cada um com ID e código único</p>
                    </div>
                    <Button className="btn-primary" onClick={() => { setEditingBook(null); setShowBookForm(true); }} disabled={!canManageCatalog}>
                      <Plus className="h-4 w-4 mr-2" /> Adicionar
                    </Button>
                  </div>
                  <div className="bg-card border rounded-xl overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50 text-left">
                        <tr>
                          <th className="p-4 w-14" />
                          <th className="p-4">Código</th>
                          <th className="p-4">Título</th>
                          <th className="p-4 hidden lg:table-cell">Autor</th>
                          <th className="p-4 hidden md:table-cell">Género</th>
                          <th className="p-4">Preço</th>
                          <th className="p-4">Stock</th>
                          <th className="p-4 hidden sm:table-cell">Destaque</th>
                          <th className="p-4 text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {books.length === 0 && (
                          <tr>
                            <td colSpan={9} className="p-12 text-center text-muted-foreground">
                              <PackageSearch className="h-10 w-10 mx-auto mb-3 opacity-40" />
                              <p className="font-medium">Nenhum livro no catálogo</p>
                              <p className="text-sm mt-1">Clique em Adicionar para publicar o primeiro livro.</p>
                            </td>
                          </tr>
                        )}
                        {books.map((b) => (
                          <tr key={b.id} className="hover:bg-muted/30">
                            <td className="p-4">
                              <div className="h-12 w-9 rounded overflow-hidden bg-muted border shrink-0">
                                {b.cover ? (
                                  <img src={b.cover} alt="" className="h-full w-full object-cover" onError={(e) => { e.target.style.display = 'none'; }} />
                                ) : (
                                  <div className="h-full w-full flex items-center justify-center text-muted-foreground/40 text-[10px]">—</div>
                                )}
                              </div>
                            </td>
                            <td className="p-4">
                              <code className="text-xs font-mono text-[#0ea5c9]">{b.book_code || '—'}</code>
                              {b.sku && b.sku !== b.book_code && (
                                <span className="block text-[10px] text-muted-foreground font-mono">{b.sku}</span>
                              )}
                            </td>
                            <td className="p-4 font-medium max-w-[180px] truncate">{b.title}</td>
                            <td className="p-4 text-muted-foreground hidden lg:table-cell">{b.author}</td>
                            <td className="p-4 text-muted-foreground hidden md:table-cell">{b.genre}</td>
                            <td className="p-4 whitespace-nowrap">Kz {Number(b.price).toFixed(2)}</td>
                            <td className="p-4">
                              <span className={Number(b.stock) <= 5 ? 'text-red-600 font-medium' : ''}>{b.stock}</span>
                              {(b.stock_alert || b.stock_low) && (
                                <span className="ml-1 inline-flex items-center text-[10px] text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                                  <AlertTriangle className="h-3 w-3 mr-0.5" />
                                  {b.stock_alert ? 'Esgotado' : 'Baixo'}
                                </span>
                              )}
                            </td>
                            <td className="p-4 hidden sm:table-cell">{b.featured ? '★' : '—'}</td>
                            <td className="p-4 text-right whitespace-nowrap">
                              <Button variant="ghost" size="icon" onClick={() => openEditBook(b)} disabled={!canManageCatalog}><Pencil className="h-4 w-4" /></Button>
                              <Button variant="ghost" size="icon" onClick={() => handleDeleteBook(b)} disabled={!canManageCatalog}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </TabsContent>
                )}

                {canManageCatalog && (
                <TabsContent value="slides">
                  <SlidesTab onChange={loadAll} />
                </TabsContent>
                )}

                {canManageOrders && (
                <TabsContent value="orders">
                  <SalesReportsPanel orders={orders} />

                  <div className="grid sm:grid-cols-3 gap-4 mb-6">
                    <div className="bg-card border rounded-xl p-4">
                      <p className="text-sm text-muted-foreground">Total Encomendas</p>
                      <p className="text-2xl font-bold">{orders.length}</p>
                    </div>
                    <div className="bg-card border rounded-xl p-4">
                      <p className="text-sm text-muted-foreground">Pendentes</p>
                      <p className="text-2xl font-bold text-amber-600">{pendingCount}</p>
                    </div>
                    <div className="bg-card border rounded-xl p-4">
                      <p className="text-sm text-muted-foreground">Receita Total</p>
                      <p className="text-2xl font-bold text-[#0ea5c9]">Kz {totalRevenue.toLocaleString('pt-AO', { minimumFractionDigits: 2 })}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap justify-between items-center mb-4 gap-3">
                    <h2 className="text-2xl font-bold">Encomendas</h2>
                    <div className="flex flex-wrap gap-2 items-center">
                      <Input
                        value={orderSearch}
                        onChange={(e) => setOrderSearch(e.target.value)}
                        placeholder="Pesquisar cliente, email, nº..."
                        className="w-48 h-9"
                      />
                      <Select value={orderFilter} onValueChange={setOrderFilter}>
                      <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas</SelectItem>
                        {Object.keys(ORDER_STATUS).map((s) => (
                          <SelectItem key={s} value={s}>{getOrderStatusLabel(s)}</SelectItem>
                        ))}
                      </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {filteredOrders.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground border rounded-xl bg-card">
                      <ShoppingBag className="h-10 w-10 mx-auto mb-3 opacity-40" />
                      <p>Nenhuma encomenda encontrada</p>
                    </div>
                  )}

                  <div className="space-y-3">
                    {filteredOrders.map((o) => (
                      <div key={o.id} className="bg-card border rounded-xl overflow-hidden">
                        <div
                          className="p-4 flex flex-wrap justify-between gap-3 cursor-pointer hover:bg-muted/20"
                          onClick={() => setExpandedOrder(expandedOrder === o.id ? null : o.id)}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-semibold">{formatOrderNumber(o)}</p>
                              <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${getOrderStatusColor(o.status)}`}>
                                {getOrderStatusLabel(o.status)}
                              </span>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${o.order_type === 'whatsapp_order' ? 'bg-green-100 text-green-800' : 'bg-[#0ea5c9]/10 text-[#0ea5c9]'}`}>
                                {getOrderChannelLabel(o)}
                              </span>
                              {o.delivery_status && (
                                <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${getDeliveryStatusColor(o.delivery_status)}`}>
                                  {getDeliveryStatusLabel(o.delivery_status)}
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              {o.customer_name || 'Cliente'} · {o.customer_email}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(o.created).toLocaleString('pt-AO')} · {(o.items || []).length} itens
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <p className="font-bold text-[#0ea5c9]">Kz {Number(o.total).toFixed(2)}</p>
                            {expandedOrder === o.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </div>
                        </div>

                        {expandedOrder === o.id && (
                          <div className="px-4 pb-4 border-t border-border pt-4 space-y-4">
                            <div className="grid sm:grid-cols-2 gap-3 text-sm">
                              {o.phone && (
                                <p className="flex items-center gap-2 text-muted-foreground">
                                  <Phone className="h-4 w-4" /> {displayAngolaPhone(o.phone)}
                                </p>
                              )}
                              {(o.delivery_relative_name || o.delivery_relative_phone) && (
                                <p className="flex items-start gap-2 text-muted-foreground text-sm">
                                  <Phone className="h-4 w-4 shrink-0 mt-0.5" />
                                  <span>
                                    Contacto próximo: <strong>{o.delivery_relative_name || '—'}</strong>
                                    {o.delivery_relative_phone && (
                                      <span className="block text-xs">{displayAngolaPhone(o.delivery_relative_phone)}</span>
                                    )}
                                  </span>
                                </p>
                              )}
                              {(o.delivery_address_full || o.address) && (
                                <p className="flex items-start gap-2 text-muted-foreground">
                                  <MapPin className="h-4 w-4 shrink-0 mt-0.5" />
                                  <span>
                                    {o.delivery_address_full || `${o.address}${o.city ? `, ${o.city}` : ''}`}
                                    {o.delivery_province && (
                                      <span className="block text-xs mt-0.5">
                                        {[o.delivery_locality, o.delivery_municipality, o.delivery_province].filter(Boolean).join(' · ')}
                                      </span>
                                    )}
                                    {o.delivery_reference && <span className="block text-xs text-[#0ea5c9]">Ref: {o.delivery_reference}</span>}
                                    {o.delivery_confirmed_at && (
                                      <span className="block text-xs text-green-700 mt-1">
                                        ✓ Confirmado por {o.delivery_confirmed_by || o.delivery_recipient_name} em {new Date(o.delivery_confirmed_at).toLocaleString('pt-AO')}
                                      </span>
                                    )}
                                  </span>
                                </p>
                              )}
                              {o.payment_method && (
                                <p className="text-muted-foreground">
                                  Pagamento: {PAYMENT_METHODS[o.payment_method] || o.payment_method_code || o.payment_method}
                                </p>
                              )}
                              {o.payment_status && (
                                <p className="text-muted-foreground">
                                  Estado pagamento: {getPaymentStatusLabel(o.payment_status)}
                                </p>
                              )}
                              {o.shipping_method && (
                                <p className="text-muted-foreground">
                                  Envio: {o.shipping_method === 'pickup' ? `Levantamento — ${o.pickup_store || 'Loja'}` : o.shipping_method === 'express' ? 'Expressa' : 'Domicílio'}
                                </p>
                              )}
                            </div>

                            <div className="rounded-lg bg-muted/30 p-3 space-y-2">
                              {(o.items || []).map((item, i) => (
                                <div key={i} className="flex justify-between text-sm">
                                  <span>{item.quantity}× {item.title}</span>
                                  <span className="font-medium">Kz {(Number(item.price) * item.quantity).toFixed(2)}</span>
                                </div>
                              ))}
                            </div>

                            {o.notes && (
                              <p className="text-sm text-muted-foreground italic">Nota: {o.notes}</p>
                            )}

                            <div className="space-y-2">
                              <p className="text-xs font-medium text-muted-foreground">Confirmar pagamento</p>
                              <div className="flex flex-wrap gap-1">
                                {['pending', 'awaiting_confirmation', 'paid', 'failed'].map((ps) => (
                                  <Button key={ps} size="sm" variant={o.payment_status === ps ? 'default' : 'outline'} className={`text-xs h-7 ${o.payment_status === ps ? 'btn-primary' : ''}`} onClick={() => handlePaymentStatus(o, ps)}>
                                    {getPaymentStatusLabel(ps)}
                                  </Button>
                                ))}
                              </div>
                            </div>

                            <div className="space-y-2">
                              <p className="text-xs font-medium text-muted-foreground">Estado da encomenda</p>
                              <div className="flex flex-wrap gap-2">
                                {Object.keys(ORDER_STATUS).map((status) => (
                                  <Button key={status} size="sm" variant={o.status === status ? 'default' : 'outline'} className={o.status === status ? 'btn-primary' : ''} onClick={() => handleOrderStatus(o, status)} disabled={o.status === status}>
                                    {getOrderStatusLabel(status)}
                                  </Button>
                                ))}
                              </div>
                            </div>

                            <div className="space-y-2">
                              <p className="text-xs font-medium text-muted-foreground">Estado da entrega</p>
                              <div className="flex flex-wrap gap-1">
                                {['received', 'confirmed', 'preparing', 'shipped', 'in_transit', 'out_for_delivery', 'delivered'].map((ds) => (
                                  <Button key={ds} size="sm" variant={o.delivery_status === ds ? 'default' : 'outline'} className={`text-xs h-7 ${o.delivery_status === ds ? 'btn-primary' : ''}`} onClick={() => handleDeliveryStatus(o, ds)}>
                                    {getDeliveryStatusLabel(ds)}
                                  </Button>
                                ))}
                              </div>
                            </div>

                            <div className="grid sm:grid-cols-2 gap-2">
                              <Input placeholder="Nº tracking" defaultValue={o.tracking_number || ''} onBlur={(e) => updateTracking(o, e.target.value, o.carrier, o.estimated_delivery)} />
                              <Input placeholder="Transportadora" defaultValue={o.carrier || ''} onBlur={(e) => updateTracking(o, o.tracking_number, e.target.value, o.estimated_delivery)} />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs">Data prevista de entrega</Label>
                              <Input
                                type="date"
                                defaultValue={o.estimated_delivery ? String(o.estimated_delivery).slice(0, 10) : ''}
                                onBlur={(e) => updateTracking(o, o.tracking_number, o.carrier, e.target.value)}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                    {filteredOrders.length === 0 && (
                      <p className="text-muted-foreground text-center py-8">Sem encomendas{orderFilter !== 'all' ? ' com este estado' : ''}.</p>
                    )}
                  </div>
                </TabsContent>
                )}
              </>
            )}
          </Tabs>
        </main>

        <BookFormModal
          open={showBookForm}
          onClose={() => { setShowBookForm(false); setEditingBook(null); }}
          onSave={handleSaveBook}
          editing={editingBook}
          saving={saving}
        />

      </div>
    </>
  );
};

export default AdminPage;
