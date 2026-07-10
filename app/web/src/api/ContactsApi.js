import pb from '@/lib/pocketbaseClient';
import { escapeFilterValue } from '@/lib/sanitizeHtml';

const PB_URL = import.meta.env.VITE_POCKETBASE_URL || 'http://127.0.0.1:8090';

function getAuthHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: pb.authStore.token ? `Bearer ${pb.authStore.token}` : '',
  };
}

async function apiPost(path, body) {
  if (!pb.authStore.isValid) {
    throw new Error('Sessão PocketBase expirada. Inicie sessão com email e palavra-passe.');
  }
  const res = await fetch(`${PB_URL}${path}`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `Erro ${res.status}`);
  return data;
}

async function apiGet(path) {
  if (!pb.authStore.isValid) {
    throw new Error('Sessão PocketBase expirada. Inicie sessão com email e palavra-passe.');
  }
  const res = await fetch(`${PB_URL}${path}`, {
    headers: { Authorization: pb.authStore.token ? `Bearer ${pb.authStore.token}` : '' },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `Erro ${res.status}`);
  return data;
}

function buildContactFilter({ search = '', source = '' } = {}) {
  const filters = [];
  if (search) {
    const q = escapeFilterValue(search.trim());
    filters.push(`(name ~ "${q}" || email ~ "${q}" || phone ~ "${q}")`);
  }
  if (source) filters.push(`source = "${escapeFilterValue(source)}"`);
  return filters.join(' && ') || '';
}

export function isCrmReady() {
  return pb.authStore.isValid;
}

export async function listContacts({ search = '', source = '' } = {}) {
  const filter = buildContactFilter({ search, source });
  const items = await pb.collection('contacts').getFullList({
    filter,
    sort: '-updated',
  });
  return { items, totalItems: items.length };
}

export async function getContactsByIds(ids = []) {
  if (!ids.length) return [];
  const unique = [...new Set(ids)];
  const chunks = [];
  for (let i = 0; i < unique.length; i += 30) {
    const slice = unique.slice(i, i + 30);
    const filter = slice.map((id) => `id = "${escapeFilterValue(id)}"`).join(' || ');
    const batch = await pb.collection('contacts').getFullList({ filter });
    chunks.push(...batch);
  }
  return chunks;
}

export async function createContact(data) {
  return pb.collection('contacts').create({
    ...data,
    owner: pb.authStore.model?.id,
    source: data.source || 'manual',
    sync_status: 'synced',
    last_synced_at: new Date().toISOString(),
  });
}

export async function updateContact(id, data) {
  return pb.collection('contacts').update(id, data);
}

export async function deleteContact(id) {
  return pb.collection('contacts').delete(id);
}

const SYNC_CHUNK_SIZE = 40;

export async function syncContactsBatch(contacts, onProgress) {
  const payload = contacts
    .filter((c) => c.name || c.email || c.phone)
    .map((c) => ({
      name: c.name || c.email?.split('@')[0] || c.phone || 'Sem Nome',
      email: c.email || '',
      phone: c.phone || '',
      photo_url: c.photo || c.photo_url || '',
      external_id: c.resourceName || c.external_id || '',
      source: c.source || 'google',
      tags: c.tags || [],
    }));

  if (!payload.length) return { created: 0, updated: 0, skipped: 0, total: 0 };

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (let i = 0; i < payload.length; i += SYNC_CHUNK_SIZE) {
    const chunk = payload.slice(i, i + SYNC_CHUNK_SIZE);
    const result = await apiPost('/api/app/contacts/sync-batch', { contacts: chunk });
    created += result.created || 0;
    updated += result.updated || 0;
    skipped += result.skipped || 0;
    if (onProgress) onProgress({ done: Math.min(i + chunk.length, payload.length), total: payload.length });
  }

  return { created, updated, skipped, total: payload.length };
}

export async function importContactsFromSources() {
  return apiPost('/api/app/contacts/import-sources', {});
}

export async function getContactsStats() {
  return apiGet('/api/app/contacts/stats');
}

export async function notifyContacts({ contactIds, channel, subject, body, groupId }) {
  return apiPost('/api/app/contacts/notify', {
    contact_ids: contactIds,
    channel,
    subject,
    body,
    group_id: groupId || '',
  });
}

export async function runDueCampaigns() {
  return apiPost('/api/app/contacts/campaigns/run-due', {});
}

export async function listGroups() {
  return pb.collection('contact_groups').getFullList({ sort: 'name' });
}

export async function createGroup(data) {
  return pb.collection('contact_groups').create({
    ...data,
    owner: pb.authStore.model?.id,
    member_ids: data.member_ids || [],
    channels: data.channels || { email: true, whatsapp: true },
    is_active: true,
  });
}

export async function updateGroup(id, data) {
  return pb.collection('contact_groups').update(id, data);
}

export async function deleteGroup(id) {
  return pb.collection('contact_groups').delete(id);
}

export async function listCampaigns() {
  return pb.collection('contact_campaigns').getFullList({ sort: '-created', expand: 'group' });
}

export async function createCampaign(data) {
  const nextSend = new Date();
  nextSend.setHours(nextSend.getHours() + 1);
  return pb.collection('contact_campaigns').create({
    ...data,
    owner: pb.authStore.model?.id,
    is_active: true,
    next_send_at: nextSend.toISOString(),
  });
}

export async function updateCampaign(id, data) {
  return pb.collection('contact_campaigns').update(id, data);
}

export async function deleteCampaign(id) {
  return pb.collection('contact_campaigns').delete(id);
}

export async function listNotifications({ page = 1, perPage = 30 } = {}) {
  return pb.collection('contact_notifications').getList(page, perPage, {
    sort: '-created',
    expand: 'contact,group,campaign',
  });
}

export const SOURCE_LABELS = {
  manual: 'Manual',
  google: 'Google',
  order: 'Encomenda',
  newsletter: 'Newsletter',
};

export const CHANNEL_LABELS = {
  email: 'Email',
  whatsapp: 'WhatsApp',
  both: 'Email + WhatsApp',
  in_app: 'In-app',
};

export const FREQUENCY_LABELS = {
  daily: 'Diária',
  weekly: 'Semanal',
  biweekly: 'Quinzenal',
  monthly: 'Mensal',
};
