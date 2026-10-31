import { getSupabase } from "@/lib/supabase/client";

/**
 * スマホ通知(Web Push)の端末側。
 * supported:使える / needs-install:iPhone でホーム画面に追加していない / unsupported:このブラウザでは使えない /
 * not-configured:VAPID の鍵か Supabase がまだ設定されていない
 */
export type PushSupport = "supported" | "needs-install" | "unsupported" | "not-configured";

const VAPID_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

function isIos(): boolean {
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isStandalone(): boolean {
  return window.matchMedia?.("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
}

export function pushSupport(): PushSupport {
  if (typeof window === "undefined") return "unsupported";
  if (!VAPID_KEY || !getSupabase()) return "not-configured";
  const hasApi = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  if (isIos() && !isStandalone()) return "needs-install";
  return hasApi ? "supported" : "unsupported";
}

/** URL 用の base64 を、pushManager.subscribe に渡す形にする */
function keyBytes(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

async function registration(): Promise<ServiceWorkerRegistration> {
  return (await navigator.serviceWorker.getRegistration()) ?? navigator.serviceWorker.register("/sw.js");
}

async function save(sub: PushSubscription): Promise<void> {
  const json = sub.toJSON();
  const supabase = getSupabase();
  if (!supabase || !json.keys) throw new Error("not configured");
  const { error } = await supabase.rpc("save_push_subscription", {
    p_endpoint: sub.endpoint,
    p_p256dh: json.keys.p256dh,
    p_auth: json.keys.auth,
  });
  if (error) throw error;
}

/** 今この端末で通知がオンか */
export async function pushEnabled(): Promise<boolean> {
  if (pushSupport() !== "supported" || Notification.permission !== "granted") return false;
  const reg = await navigator.serviceWorker.getRegistration();
  return Boolean(await reg?.pushManager.getSubscription());
}

/** 通知をオンにする(ボタンを押したときに呼ぶ)。許可されなければ "denied" */
export async function enablePush(): Promise<"enabled" | "denied"> {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return "denied";
  const reg = await registration();
  await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_KEY!) }));
  await save(sub);
  return "enabled";
}

export async function disablePush(): Promise<void> {
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await getSupabase()?.rpc("delete_push_subscription", { p_endpoint: sub.endpoint });
  await sub.unsubscribe();
}

/** ログインしたときに、通知がオンなら登録し直してアカウントと結び付ける(個別のプレゼントの通知用) */
export async function refreshPushSubscription(): Promise<void> {
  if (!(await pushEnabled())) return;
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (sub) await save(sub);
}
