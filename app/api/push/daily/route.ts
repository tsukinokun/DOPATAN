import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";
import { dailyPushes, type PushBatch } from "@/lib/push/daily";

/**
 * 毎朝7時(日本時間)に Vercel の定期実行から呼ばれ、スマホに通知を送る(vercel.json)。
 * 送り先は Supabase の push_batch から、合言葉(PUSH_SECRET)を使って読む。service_role キーは使わない。
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  const pushSecret = process.env.PUSH_SECRET;
  if (!url || !anonKey || !publicKey || !privateKey || !subject || !pushSecret) {
    return Response.json({ skipped: "not configured" });
  }

  const supabase = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data, error } = await supabase.rpc("push_batch", { p_secret: pushSecret });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!data) return Response.json({ error: "push secret rejected" }, { status: 403 });

  webpush.setVapidDetails(subject, publicKey, privateKey);
  const pushes = dailyPushes(Date.now(), data as PushBatch);
  const results = await Promise.allSettled(
    pushes.map(({ subscription, message }) =>
      webpush.sendNotification(
        { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
        JSON.stringify(message),
        { TTL: 12 * 60 * 60 },
      ),
    ),
  );
  // もう使われていない送り先は消す
  const gone = results.flatMap((r, i) => {
    const status = r.status === "rejected" ? (r.reason as { statusCode?: number })?.statusCode : undefined;
    return status === 404 || status === 410 ? [pushes[i].subscription.endpoint] : [];
  });
  if (gone.length > 0) await supabase.rpc("push_remove", { p_secret: pushSecret, p_endpoints: gone });

  return Response.json({
    sent: results.filter((r) => r.status === "fulfilled").length,
    failed: results.filter((r) => r.status === "rejected").length,
    removed: gone.length,
  });
}
