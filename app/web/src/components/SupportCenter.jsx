import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, Check, ChevronLeft, Loader2, MessageCircle, RefreshCw, Send, UserRound } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { normalizeForSearch } from '@/lib/searchUtils';
import { getDeliveryStatusLabel, getOrderStatusLabel, getPaymentStatusLabel } from '@/lib/orderUtils';
import {
  createSupportThread,
  listCustomerNotifications,
  listCustomerOrdersForSupport,
  listStaffNotifications,
  listSupportAssignees,
  listSupportMessages,
  listSupportThreads,
  markCustomerNotificationRead,
  markStaffNotificationRead,
  markSupportThreadRead,
  sendSupportMessage,
  updateSupportThread,
} from '@/lib/supportApi';

const STATUS_LABELS = {
  open: 'Aberta',
  pending: 'A aguardar cliente',
  closed: 'Resolvida',
};

const NOTIFICATION_KINDS = {
  order: 'Encomenda',
  payment: 'Pagamento',
  delivery: 'Entrega',
  support: 'Atendimento',
  new_order: 'Nova encomenda',
};

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleString('pt-AO', { dateStyle: 'short', timeStyle: 'short' });
}

function unreadThread(thread, staff, userId) {
  const lastRead = staff ? thread.staff_last_read_at : thread.customer_last_read_at;
  return thread.last_sender_id !== userId
    && new Date(thread.last_message_at).getTime() > new Date(lastRead).getTime();
}

export default function SupportCenter({ compact = false }) {
  const { user, isAdmin, hasPermission } = useAuth();
  const navigate = useNavigate();
  const staff = isAdmin || hasPermission('manage_orders');
  const [section, setSection] = useState(staff ? 'threads' : 'notifications');
  const [threads, setThreads] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [orders, setOrders] = useState([]);
  const [assignees, setAssignees] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [threadSearch, setThreadSearch] = useState('');
  const [threadStatusFilter, setThreadStatusFilter] = useState('active');
  const [assigneeFilter, setAssigneeFilter] = useState('all');
  const [messages, setMessages] = useState([]);
  const [messageDraft, setMessageDraft] = useState('');
  const [newSubject, setNewSubject] = useState('');
  const [newBody, setNewBody] = useState('');
  const [newOrderId, setNewOrderId] = useState('');
  const [creating, setCreating] = useState(false);
  const [showNewThread, setShowNewThread] = useState(false);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    if (!user?.id) return;
    setError('');
    try {
      const [threadRows, notificationRows, extra] = await Promise.all([
        listSupportThreads({ staff, customerId: user.id }),
        staff ? listStaffNotifications() : listCustomerNotifications(),
        staff ? listSupportAssignees() : listCustomerOrdersForSupport(user.id),
      ]);
      setThreads(threadRows);
      setNotifications(notificationRows);
      if (staff) setAssignees(extra);
      else setOrders(extra);
    } catch (err) {
      setError(err.message || 'Não foi possível carregar o atendimento.');
    } finally {
      setLoading(false);
    }
  }, [staff, user?.id]);

  useEffect(() => {
    refresh();
    const timer = window.setInterval(refresh, 30000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const selectedThread = useMemo(
    () => threads.find((thread) => thread.id === selectedId) || null,
    [threads, selectedId],
  );

  const visibleThreads = useMemo(() => {
    const query = normalizeForSearch(threadSearch);
    return threads.filter((thread) => {
      if (staff && threadStatusFilter === 'active' && thread.status === 'closed') return false;
      if (staff && threadStatusFilter !== 'active' && threadStatusFilter !== 'all'
        && thread.status !== threadStatusFilter) return false;
      if (staff && assigneeFilter === 'mine' && thread.assigned_to !== user?.id) return false;
      if (staff && assigneeFilter === 'unassigned' && thread.assigned_to) return false;
      if (!query) return true;
      return [
        thread.subject,
        thread.customer?.name,
        thread.customer?.email,
        thread.order?.order_number,
        thread.order_id,
      ].some((value) => normalizeForSearch(value).includes(query));
    });
  }, [threads, staff, threadStatusFilter, assigneeFilter, threadSearch, user?.id]);

  const loadMessages = useCallback(async (threadId) => {
    if (!threadId) {
      setMessages([]);
      return;
    }
    try {
      const rows = await listSupportMessages(threadId);
      setMessages(rows);
    } catch (err) {
      setError(err.message || 'Não foi possível carregar as mensagens.');
    }
  }, []);

  useEffect(() => {
    loadMessages(selectedId);
  }, [loadMessages, selectedId]);

  useEffect(() => {
    if (!selectedId) return undefined;
    const timer = window.setInterval(async () => {
      try {
        await markSupportThreadRead(selectedId);
        await loadMessages(selectedId);
      } catch (err) {
        setError(err.message || 'Não foi possível actualizar a conversa.');
      }
    }, 10000);
    return () => window.clearInterval(timer);
  }, [loadMessages, selectedId]);

  const unreadNotifications = notifications.filter((notification) => !notification.read_at).length;
  const unreadMessages = threads.filter((thread) => unreadThread(thread, staff, user?.id)).length;

  const openThread = async (thread) => {
    setSelectedId(thread.id);
    setShowNewThread(false);
    setSection('threads');
    try {
      await markSupportThreadRead(thread.id);
      await Promise.all([loadMessages(thread.id), refresh()]);
    } catch (err) {
      setError(err.message || 'Não foi possível abrir esta conversa.');
    }
  };

  const markNotificationRead = async (notification) => {
    try {
      if (!notification.read_at) {
        if (staff) await markStaffNotificationRead(notification.id);
        else await markCustomerNotificationRead(notification.id);
      }
      if (notification.thread_id) {
        const thread = threads.find((item) => item.id === notification.thread_id);
        if (thread) {
          await openThread(thread);
          return;
        }
      }
      await refresh();
      if (notification.order_id) {
        navigate(staff ? '/admin?tab=orders' : notification.href || '/profile?tab=orders');
      } else if (notification.href?.startsWith('/')) {
        navigate(notification.href);
      }
    } catch (err) {
      setError(err.message || 'Não foi possível actualizar a notificação.');
    }
  };

  const submitMessage = async (event) => {
    event.preventDefault();
    if (!selectedId || !messageDraft.trim() || sending) return;
    setSending(true);
    setError('');
    try {
      await sendSupportMessage(selectedId, messageDraft);
      setMessageDraft('');
      await Promise.all([loadMessages(selectedId), refresh()]);
    } catch (err) {
      setError(err.message || 'A mensagem não foi enviada.');
    } finally {
      setSending(false);
    }
  };

  const submitNewThread = async (event) => {
    event.preventDefault();
    if (creating) return;
    setCreating(true);
    setError('');
    try {
      const id = await createSupportThread({
        subject: newSubject,
        body: newBody,
        orderId: newOrderId || null,
      });
      setNewSubject('');
      setNewBody('');
      setNewOrderId('');
      setShowNewThread(false);
      setSelectedId(id);
      setSection('threads');
      await Promise.all([refresh(), loadMessages(id)]);
    } catch (err) {
      setError(err.message || 'Não foi possível iniciar a conversa.');
    } finally {
      setCreating(false);
    }
  };

  const changeThread = async (field, value) => {
    if (!selectedThread) return;
    const next = {
      threadId: selectedThread.id,
      status: field === 'status' ? value : selectedThread.status,
      assignedTo: field === 'assigned_to' ? (value === '_none' ? null : value) : selectedThread.assigned_to,
    };
    try {
      await updateSupportThread(next);
      await refresh();
    } catch (err) {
      setError(err.message || 'Não foi possível actualizar a conversa.');
    }
  };

  const viewNotifications = (
    <div className="space-y-2">
      {notifications.length === 0 ? (
        <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          <Bell className="mx-auto mb-2 h-6 w-6 opacity-50" />
          Ainda não tem notificações.
        </div>
      ) : notifications.map((notification) => (
        <button
          key={notification.id}
          type="button"
          onClick={() => markNotificationRead(notification)}
          className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors hover:bg-muted/50 ${notification.read_at ? 'bg-card' : 'border-primary/30 bg-primary/5'}`}
        >
          <span className="mt-0.5 rounded-full bg-primary/10 p-2 text-primary"><Bell className="h-4 w-4" /></span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center justify-between gap-2">
              <span className="font-semibold">{notification.title}</span>
              {!notification.read_at && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />}
            </span>
            <span className="mt-1 block text-sm text-muted-foreground">{notification.body}</span>
            <span className="mt-2 block text-[11px] text-muted-foreground">
              {NOTIFICATION_KINDS[notification.kind] || 'Aviso'} · {formatDate(notification.created_at)}
            </span>
          </span>
        </button>
      ))}
    </div>
  );

  const viewThreadList = (
    <div className="space-y-2">
      {!staff && (
        <Button type="button" className="w-full btn-primary" onClick={() => { setShowNewThread(true); setSelectedId(''); }}>
          <MessageCircle className="mr-2 h-4 w-4" /> Nova conversa
        </Button>
      )}
      {staff && !compact && (
        <div className="space-y-2 rounded-xl border bg-muted/20 p-3">
          <Input
            value={threadSearch}
            onChange={(event) => setThreadSearch(event.target.value)}
            placeholder="Pesquisar cliente ou assunto…"
            aria-label="Pesquisar conversas"
          />
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
            <Select value={threadStatusFilter} onValueChange={setThreadStatusFilter}>
              <SelectTrigger aria-label="Filtrar conversas por estado"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Abertas e pendentes</SelectItem>
                <SelectItem value="open">Abertas</SelectItem>
                <SelectItem value="pending">A aguardar cliente</SelectItem>
                <SelectItem value="closed">Resolvidas</SelectItem>
                <SelectItem value="all">Todos os estados</SelectItem>
              </SelectContent>
            </Select>
            <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
              <SelectTrigger aria-label="Filtrar conversas por responsável"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os responsáveis</SelectItem>
                <SelectItem value="mine">Atribuídas a mim</SelectItem>
                <SelectItem value="unassigned">Sem responsável</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {visibleThreads.length} de {threads.length} conversas (máximo de 100 recentes)
          </p>
        </div>
      )}
      {visibleThreads.length === 0 ? (
        <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          <MessageCircle className="mx-auto mb-2 h-6 w-6 opacity-50" />
          {threads.length === 0
            ? (staff ? 'Ainda não há conversas de clientes.' : 'Ainda não iniciou uma conversa com a equipa.')
            : 'Nenhuma conversa corresponde a estes filtros.'}
        </div>
      ) : visibleThreads.map((thread) => {
        const unread = unreadThread(thread, staff, user?.id);
        return (
          <button
            key={thread.id}
            type="button"
            onClick={() => openThread(thread)}
            className={`w-full rounded-xl border p-3 text-left transition-colors hover:bg-muted/50 ${selectedId === thread.id ? 'border-primary bg-primary/5' : 'bg-card'}`}
          >
            <span className="flex items-start justify-between gap-2">
              <span className="min-w-0">
                <span className="block truncate font-semibold">{thread.subject}</span>
                {staff && <span className="mt-1 block truncate text-xs text-muted-foreground">{thread.customer?.name || thread.customer?.email || 'Cliente'}</span>}
              </span>
              {unread && <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-primary" />}
            </span>
            <span className="mt-2 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
              <span>{STATUS_LABELS[thread.status] || thread.status}</span>
              <span>{formatDate(thread.last_message_at)}</span>
            </span>
          </button>
        );
      })}
    </div>
  );

  const threadView = selectedThread && (
    <section className="flex min-h-[360px] flex-col overflow-hidden rounded-xl border bg-card">
      <header className="space-y-3 border-b p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            {compact && (
              <Button type="button" size="sm" variant="ghost" className="-ml-2 mb-1 h-7" onClick={() => setSelectedId('')}>
                <ChevronLeft className="mr-1 h-4 w-4" /> Conversas
              </Button>
            )}
            <h3 className="truncate font-semibold">{selectedThread.subject}</h3>
            {staff && (
              <p className="mt-1 text-xs text-muted-foreground">
                {selectedThread.customer?.name || selectedThread.customer?.email || 'Cliente'}
                {selectedThread.customer?.email && selectedThread.customer?.name ? ` · ${selectedThread.customer.email}` : ''}
              </p>
            )}
          </div>
          <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold ${selectedThread.status === 'closed' ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary'}`}>
            {STATUS_LABELS[selectedThread.status] || selectedThread.status}
          </span>
        </div>
        {staff && (
          <div className="grid gap-2 sm:grid-cols-2">
            <Select value={selectedThread.status} onValueChange={(value) => changeThread('status', value)}>
              <SelectTrigger aria-label="Estado da conversa" className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Aberta</SelectItem>
                <SelectItem value="pending">A aguardar cliente</SelectItem>
                <SelectItem value="closed">Resolvida</SelectItem>
              </SelectContent>
            </Select>
            <Select value={selectedThread.assigned_to || '_none'} onValueChange={(value) => changeThread('assigned_to', value)}>
              <SelectTrigger aria-label="Responsável pela conversa" className="h-9"><SelectValue placeholder="Sem responsável" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">Sem responsável</SelectItem>
                {assignees.map((assignee) => (
                  <SelectItem key={assignee.id} value={assignee.id}>
                    {assignee.name || assignee.email || 'Funcionário'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        {selectedThread.order && (
          <div className="rounded-lg bg-muted/50 p-2.5 text-xs">
            <p className="font-semibold">Encomenda {selectedThread.order.order_number || selectedThread.order.id}</p>
            <p className="mt-1 text-muted-foreground">
              Estado: {getOrderStatusLabel(selectedThread.order.status) || '—'}
              {' · '}Pagamento: {getPaymentStatusLabel(selectedThread.order.payment_status)}
              {' · '}Entrega: {getDeliveryStatusLabel(selectedThread.order.delivery_status)}
            </p>
          </div>
        )}
      </header>
      <div className={`flex-1 space-y-3 overflow-y-auto p-3 ${compact ? 'max-h-64' : 'max-h-[480px]'}`}>
        {messages.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Ainda não há mensagens nesta conversa.</p>
        ) : messages.map((message) => {
          const mine = message.sender_id === user?.id;
          return (
            <div key={message.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[88%] rounded-2xl px-3 py-2 text-sm ${mine ? 'rounded-br-sm bg-primary text-primary-foreground' : 'rounded-bl-sm bg-muted'}`}>
                <p className="whitespace-pre-wrap break-words">{message.body}</p>
                <time className={`mt-1 block text-[10px] ${mine ? 'text-primary-foreground/70' : 'text-muted-foreground'}`} dateTime={message.created_at}>
                  {formatDate(message.created_at)}
                </time>
              </div>
            </div>
          );
        })}
      </div>
      {selectedThread.status !== 'closed' ? (
        <form onSubmit={submitMessage} className="flex items-end gap-2 border-t p-3">
          <Textarea
            value={messageDraft}
            onChange={(event) => setMessageDraft(event.target.value)}
            maxLength={4000}
            rows={2}
            placeholder={staff ? 'Responder ao cliente…' : 'Escreva à equipa…'}
            aria-label="Mensagem de atendimento"
            className="min-h-10 resize-y text-sm"
          />
          <Button type="submit" size="icon" aria-label="Enviar mensagem" disabled={sending || !messageDraft.trim()}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </form>
      ) : (
        <p className="border-t p-3 text-center text-xs text-muted-foreground">
          Conversa resolvida. {staff ? 'Reabra-a para responder.' : 'Inicie uma nova conversa se precisar de mais ajuda.'}
        </p>
      )}
    </section>
  );

  const newThreadForm = (
    <form onSubmit={submitNewThread} className="space-y-3 rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold">Falar com a equipa</h3>
        <Button type="button" size="sm" variant="ghost" onClick={() => setShowNewThread(false)}>Cancelar</Button>
      </div>
      <Input value={newSubject} onChange={(event) => setNewSubject(event.target.value)} maxLength={160} placeholder="Assunto" required />
      {orders.length > 0 && (
        <Select value={newOrderId || '_none'} onValueChange={(value) => setNewOrderId(value === '_none' ? '' : value)}>
          <SelectTrigger aria-label="Associar encomenda"><SelectValue placeholder="Associar encomenda (opcional)" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="_none">Sem encomenda associada</SelectItem>
            {orders.map((order) => (
              <SelectItem key={order.id} value={order.id}>
              {order.order_number || order.id} · {getOrderStatusLabel(order.status) || 'Em processamento'}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <Textarea value={newBody} onChange={(event) => setNewBody(event.target.value)} maxLength={4000} rows={4} placeholder="Como podemos ajudar?" required />
      <Button type="submit" className="w-full btn-primary" disabled={creating || !newSubject.trim() || !newBody.trim()}>
        {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Enviar mensagem
      </Button>
    </form>
  );

  return (
    <div className={`space-y-4 ${compact ? '' : 'rounded-2xl border bg-background p-4 sm:p-6'}`}>
      {!compact && (
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold">{staff ? 'Atendimento ao cliente' : 'Notificações e atendimento'}</h2>
            <p className="text-sm text-muted-foreground">
              {staff ? 'Organize conversas, responsáveis, estados e contexto das encomendas.' : 'Acompanhe avisos e fale directamente com a equipa.'}
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={refresh} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Actualizar
          </Button>
        </header>
      )}

      <nav className="flex gap-2 border-b pb-2" aria-label="Área de atendimento">
        <Button
          type="button"
          size="sm"
          variant={section === 'notifications' ? 'default' : 'ghost'}
          onClick={() => { setSection('notifications'); setSelectedId(''); setShowNewThread(false); }}
        >
          <Bell className="mr-1.5 h-4 w-4" />
          Notificações{unreadNotifications > 0 ? ` (${unreadNotifications})` : ''}
        </Button>
        <Button
          type="button"
          size="sm"
          variant={section === 'threads' ? 'default' : 'ghost'}
          onClick={() => { setSection('threads'); setShowNewThread(false); }}
        >
          <MessageCircle className="mr-1.5 h-4 w-4" />
          {staff ? 'Conversas' : 'Mensagens'}{unreadMessages > 0 ? ` (${unreadMessages})` : ''}
        </Button>
      </nav>

      {error && (
        <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
          {error.toLowerCase().includes('support_') || error.toLowerCase().includes('customer_notifications')
            ? <span className="mt-1 block">O centro de atendimento ainda precisa da migração do Supabase.</span>
            : null}
        </div>
      )}

      {loading && threads.length === 0 && notifications.length === 0 ? (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> A carregar…
        </div>
      ) : section === 'notifications' ? viewNotifications : (
        <div className={compact ? 'space-y-3' : 'grid gap-4 lg:grid-cols-[minmax(240px,320px)_minmax(0,1fr)]'}>
          {!(compact && (selectedThread || showNewThread)) && viewThreadList}
          <div className="min-w-0">
            {showNewThread ? newThreadForm : threadView || (
              <div className="hidden min-h-[360px] items-center justify-center rounded-xl border border-dashed text-center text-sm text-muted-foreground lg:flex">
                <div>
                  <UserRound className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  Seleccione uma conversa para ver o histórico e o contexto.
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {!compact && (
        <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <Check className="h-3 w-3" /> As conversas são privadas e visíveis apenas ao cliente e à equipa autorizada.
          <Link to={staff ? '/admin?tab=orders' : '/profile?tab=orders'} className="ml-auto text-primary hover:underline">
            {staff ? 'Encomendas' : 'A minha conta'}
          </Link>
        </p>
      )}
    </div>
  );
}
