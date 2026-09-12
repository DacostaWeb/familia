import { api } from "./api";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  try {
    return await navigator.serviceWorker.register("/sw.js");
  } catch {
    return null;
  }
}

export async function enableNotifications(): Promise<{ ok: boolean; message: string }> {
  if (!("Notification" in window) || !("PushManager" in window)) {
    return { ok: false, message: "Este dispositivo não suporta notificações push." };
  }
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return { ok: false, message: "Permissão de notificações recusada." };
  }
  const reg = await registerServiceWorker();
  if (!reg) return { ok: false, message: "Não foi possível registar a aplicação." };
  const config = await api<{ vapidPublicKey: string }>("/api/config");
  if (!config.vapidPublicKey) return { ok: false, message: "Notificações não configuradas no servidor." };
  const existing = await reg.pushManager.getSubscription();
  const subscription =
    existing ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(config.vapidPublicKey) as BufferSource,
    }));
  const jsonSub = subscription.toJSON() as { endpoint: string; keys?: { p256dh?: string; auth?: string } };
  await api("/api/push/subscribe", {
    method: "POST",
    body: JSON.stringify({ endpoint: jsonSub.endpoint, keys: jsonSub.keys }),
  });
  return { ok: true, message: "Notificações ativas neste dispositivo." };
}

export async function disableNotifications(): Promise<void> {
  const reg = await registerServiceWorker();
  if (!reg) return;
  const subscription = await reg.pushManager.getSubscription();
  if (subscription) {
    const jsonSub = subscription.toJSON() as { endpoint: string };
    await api("/api/push/unsubscribe", { method: "POST", body: JSON.stringify({ endpoint: jsonSub.endpoint }) }).catch(() => undefined);
    await subscription.unsubscribe();
  }
}

export async function sendTestNotification(): Promise<{ result: string }> {
  return api<{ result: string }>("/api/push/test", { method: "POST" });
}
