import { supabase } from '@/lib/supabaseClient';

const THREAD_FIELDS = 'id, customer_id, order_id, subject, status, assigned_to, customer_last_read_at, staff_last_read_at, last_sender_id, last_message_at, created_at, updated_at';
const MESSAGE_FIELDS = 'id, thread_id, sender_id, body, created_at';
const NOTIFICATION_FIELDS = 'id, kind, title, body, href, order_id, thread_id, read_at, created_at';

function throwOnError(error) {
  if (error) throw new Error(error.message || 'Não foi possível carregar o atendimento.');
}

export async function listSupportThreads({ staff, customerId }) {
  let query = supabase
    .from('support_threads')
    .select(THREAD_FIELDS)
    .order('last_message_at', { ascending: false })
    .limit(100);
  if (!staff) query = query.eq('customer_id', customerId);

  const { data: threads, error } = await query;
  throwOnError(error);
  if (!threads?.length) return [];

  const customerIds = [...new Set(threads.map((thread) => thread.customer_id).filter(Boolean))];
  const orderIds = [...new Set(threads.map((thread) => thread.order_id).filter(Boolean))];
  const [profilesResult, ordersResult] = await Promise.all([
    staff && customerIds.length
      ? supabase.from('profiles').select('id, name, email').in('id', customerIds)
      : Promise.resolve({ data: [], error: null }),
    orderIds.length
      ? supabase.from('orders')
        .select('id, order_number, status, payment_status, delivery_status, total, created')
        .in('id', orderIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  throwOnError(profilesResult.error);
  throwOnError(ordersResult.error);

  const profiles = new Map((profilesResult.data || []).map((profile) => [profile.id, profile]));
  const orders = new Map((ordersResult.data || []).map((order) => [order.id, order]));
  return threads.map((thread) => ({
    ...thread,
    customer: profiles.get(thread.customer_id) || null,
    order: orders.get(thread.order_id) || null,
  }));
}

export async function listSupportMessages(threadId) {
  const { data, error } = await supabase
    .from('support_messages')
    .select(MESSAGE_FIELDS)
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })
    .limit(200);
  throwOnError(error);
  return data || [];
}

export async function sendSupportMessage(threadId, body) {
  const trimmed = String(body || '').trim();
  if (!threadId || !trimmed || trimmed.length > 4000) {
    throw new Error('A mensagem deve ter entre 1 e 4000 caracteres.');
  }
  const { data, error } = await supabase
    .from('support_messages')
    .insert({ thread_id: threadId, body: trimmed })
    .select(MESSAGE_FIELDS)
    .single();
  throwOnError(error);
  return data;
}

export async function createSupportThread({ subject, body, orderId = null }) {
  const { data, error } = await supabase.rpc('support_create_thread', {
    p_subject: String(subject || '').trim(),
    p_body: String(body || '').trim(),
    p_order_id: orderId || null,
  });
  throwOnError(error);
  return data;
}

export async function markSupportThreadRead(threadId) {
  const { error } = await supabase.rpc('support_mark_read', { p_thread_id: threadId });
  throwOnError(error);
}

export async function updateSupportThread({ threadId, status, assignedTo }) {
  const { data, error } = await supabase.rpc('support_update_thread', {
    p_thread_id: threadId,
    p_status: status,
    p_assigned_to: assignedTo || null,
  });
  throwOnError(error);
  return data;
}

export async function listCustomerNotifications() {
  const { data, error } = await supabase
    .from('customer_notifications')
    .select(NOTIFICATION_FIELDS)
    .order('created_at', { ascending: false })
    .limit(100);
  throwOnError(error);
  return data || [];
}

export async function listStaffNotifications() {
  const { data, error } = await supabase
    .from('staff_notifications')
    .select(NOTIFICATION_FIELDS)
    .order('created_at', { ascending: false })
    .limit(100);
  throwOnError(error);
  return data || [];
}

export async function markCustomerNotificationRead(notificationId) {
  const { error } = await supabase.rpc('customer_mark_notification_read', {
    p_notification_id: notificationId,
  });
  throwOnError(error);
}

export async function markStaffNotificationRead(notificationId) {
  const { error } = await supabase.rpc('staff_mark_notification_read', {
    p_notification_id: notificationId,
  });
  throwOnError(error);
}

export async function listCustomerOrdersForSupport(customerId) {
  const { data, error } = await supabase
    .from('orders')
    .select('id, order_number, status, created')
    .eq('customer_id', customerId)
    .order('created', { ascending: false })
    .limit(30);
  throwOnError(error);
  return data || [];
}

export async function listSupportAssignees() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, email, role, permissions')
    .in('role', ['admin', 'manager'])
    .order('name', { ascending: true })
    .limit(200);
  throwOnError(error);
  return (data || []).filter((profile) => (
    profile.role === 'admin' || profile.permissions?.manage_orders === true
  ));
}
