import pb from '@/lib/dataClient';
import { APP_API_URL } from '@/lib/supabaseClient';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) arr[i] = raw.charCodeAt(i);
  return arr;
}

export function isPushSupported() {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export async function requestPushPermission() {
  if (!isPushSupported()) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  return Notification.requestPermission();
}

export async function subscribeToPush(vapidPublicKey) {
  if (!vapidPublicKey || !isPushSupported()) return null;
  const permission = await requestPushPermission();
  if (permission !== 'granted') return null;

  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });
  }

  const json = sub.toJSON();
  const body = {
    endpoint: sub.endpoint,
    keys: json.keys,
    user_agent: navigator.userAgent,
    user: pb.authStore.model?.id || '',
  };

  await fetch(`${APP_API_URL}/push/subscribe`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(pb.authStore.token ? { Authorization: `Bearer ${pb.authStore.token}` } : {}),
    },
    body: JSON.stringify(body),
  });

  return sub;
}

export async function showLocalNotification({ title, body, url = '/' }) {
  if (!isPushSupported() || Notification.permission !== 'granted') return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    await reg.showNotification(title, {
      body,
      icon: '/icons/icon-192.svg',
      badge: '/icons/icon-192.svg',
      data: { url },
      tag: 'livraria-order',
    });
    return true;
  } catch {
    try {
      new Notification(title, { body, icon: '/icons/icon-192.svg' });
      return true;
    } catch {
      return false;
    }
  }
}
