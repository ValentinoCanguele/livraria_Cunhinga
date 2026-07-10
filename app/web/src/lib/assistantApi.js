import pb from '@/lib/pocketbaseClient';

const PB_URL = import.meta.env.VITE_POCKETBASE_URL || 'http://127.0.0.1:8090';

function getSessionId() {
  const key = 'livraria_chat_session';
  try {
    let id = sessionStorage.getItem(key);
    if (!id) {
      id = crypto.randomUUID?.() || `s-${Date.now()}`;
      sessionStorage.setItem(key, id);
    }
    return id;
  } catch {
    return `s-${Date.now()}`;
  }
}

export async function fetchChatConfig() {
  try {
    const res = await fetch(`${PB_URL}/api/app/chat/config`);
    return res.ok ? await res.json() : { enabled: true, ai: false, provider: 'faq' };
  } catch {
    return { enabled: true, ai: false, provider: 'faq' };
  }
}

/**
 * @param {{ message: string, history?: Array<{role:string,content:string}>, page?: string }} payload
 */
export async function sendChatMessage({ message, history = [], page = '/' }) {
  const res = await fetch(`${PB_URL}/api/app/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(pb.authStore.token ? { Authorization: `Bearer ${pb.authStore.token}` } : {}),
    },
    body: JSON.stringify({
      message: message.trim(),
      history: history.slice(-8),
      page,
      session_id: getSessionId(),
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Erro no assistente');
  return data;
}
