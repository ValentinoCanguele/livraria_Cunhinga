import { supabase } from '@/lib/supabaseClient';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;
const MESSAGE_FORMATS = new Set(['mls_private_message', 'mls_public_message', 'mls_welcome']);
const MAX_CIPHERTEXT_LENGTH = 100000;

export function buildEncryptedMessageRecord({
  threadId,
  clientMessageId,
  wireFormat,
  epoch = null,
  ciphertextBase64url,
}) {
  if (!UUID_PATTERN.test(threadId || '')) throw new Error('Thread inválida.');
  if (!UUID_PATTERN.test(clientMessageId || '')) throw new Error('ID de mensagem inválido.');
  if (!MESSAGE_FORMATS.has(wireFormat)) throw new Error('Formato MLS não suportado.');
  if (epoch !== null && (!Number.isSafeInteger(epoch) || epoch < 0)) {
    throw new Error('Época MLS inválida.');
  }
  if (
    typeof ciphertextBase64url !== 'string'
    || ciphertextBase64url.length < 1
    || ciphertextBase64url.length > MAX_CIPHERTEXT_LENGTH
    || !BASE64URL_PATTERN.test(ciphertextBase64url)
  ) {
    throw new Error('Ciphertext MLS inválido.');
  }

  return {
    thread_id: threadId,
    client_message_id: clientMessageId,
    wire_format: wireFormat,
    epoch,
    ciphertext_base64url: ciphertextBase64url,
  };
}

export async function publishDeviceKeyPackage({ deviceId, keyPackage, expiresAt }) {
  if (!UUID_PATTERN.test(deviceId || '')) throw new Error('ID de dispositivo inválido.');
  if (typeof keyPackage !== 'string' || !BASE64URL_PATTERN.test(keyPackage) || keyPackage.length > 32768) {
    throw new Error('Key package MLS inválido.');
  }
  const parsedExpiry = Date.parse(expiresAt);
  if (!Number.isFinite(parsedExpiry) || parsedExpiry <= Date.now()) {
    throw new Error('A validade da chave tem de estar no futuro.');
  }

  const { data, error } = await supabase
    .from('e2ee_device_keys')
    .insert({ device_id: deviceId, key_package: keyPackage, expires_at: new Date(parsedExpiry).toISOString() })
    .select('device_id, expires_at')
    .single();
  if (error) throw error;
  return data;
}

export async function listAdminKeyPackages() {
  const { data, error } = await supabase.rpc('e2ee_admin_key_packages');
  if (error) throw error;
  return data || [];
}

export async function createSecureSupportThread({ bookId = null, reviewId = null, mlsGroupId }) {
  if (typeof mlsGroupId !== 'string' || !BASE64URL_PATTERN.test(mlsGroupId) || mlsGroupId.length > 128) {
    throw new Error('ID de grupo MLS inválido.');
  }

  const { data, error } = await supabase
    .from('secure_support_threads')
    .insert({ book_id: bookId, review_id: reviewId, mls_group_id: mlsGroupId })
    .select('id, book_id, review_id, mls_group_id, status, created_at')
    .single();
  if (error) throw error;
  return data;
}

export async function listSecureSupportThreads() {
  const { data, error } = await supabase
    .from('secure_support_threads')
    .select('id, customer_id, book_id, review_id, mls_group_id, status, created_at')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function listSecureSupportMessages(threadId) {
  if (!UUID_PATTERN.test(threadId || '')) throw new Error('Thread inválida.');
  const { data, error } = await supabase
    .from('secure_support_messages')
    .select('id, thread_id, sender_id, client_message_id, wire_format, epoch, ciphertext_base64url, created_at')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function appendEncryptedSupportMessage(envelope) {
  const record = buildEncryptedMessageRecord(envelope);
  const { data, error } = await supabase
    .from('secure_support_messages')
    .insert(record)
    .select('id, thread_id, sender_id, client_message_id, wire_format, epoch, ciphertext_base64url, created_at')
    .single();
  if (error) throw error;
  return data;
}