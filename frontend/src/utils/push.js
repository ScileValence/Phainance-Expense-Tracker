import api from "../api/axios";

export const pushSupported = () =>
  "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

const toUint8 = (b64) => {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
};

async function registration() {
  await navigator.serviceWorker.register("/sw.js");
  return navigator.serviceWorker.ready;
}

export async function currentSubscription() {
  if (!pushSupported()) return null;
  const reg = await registration();
  return reg.pushManager.getSubscription();
}

// Subscribe this browser and register it with the backend.
export async function enablePush(vapidPublicKey) {
  const perm = await Notification.requestPermission();
  if (perm !== "granted") throw new Error("Notification permission was not granted");

  const reg = await registration();
  const options = { userVisibleOnly: true, applicationServerKey: toUint8(vapidPublicKey) };

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe(options);
  }
  await api.post("/notifications/push/subscribe", sub.toJSON());
  return sub;
}

// Re-register an existing browser subscription with the backend (keeps both sides in sync).
export async function syncPush() {
  const sub = await currentSubscription();
  if (sub && Notification.permission === "granted") {
    await api.post("/notifications/push/subscribe", sub.toJSON());
  }
  return sub;
}

export async function disablePush() {
  const sub = await currentSubscription();
  if (!sub) return;
  try {
    await api.post("/notifications/push/unsubscribe", { endpoint: sub.endpoint });
  } finally {
    await sub.unsubscribe();
  }
}
