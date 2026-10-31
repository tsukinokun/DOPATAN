import { eventAt, EVENTS } from "@/lib/events";

export type PushSubscriptionRow = { endpoint: string; p256dh: string; auth: string; userId: string | null };

/** push_batch(0006_news_push.sql)が返すもの */
export type PushBatch = {
  subscriptions: PushSubscriptionRow[];
  announcements: { id: string; title: string; body: string; link: string | null }[];
  presents: { id: string; title: string; userId: string | null }[];
};

export type PushMessage = { title: string; body: string; url: string; tag: string };

const JST_OFFSET = 9 * 60 * 60 * 1000;

/** 日本時間の曜日(0 = 日曜、1 = 月曜) */
export const jstWeekday = (now: number) => new Date(now + JST_OFFSET).getUTCDay();

const clip = (text: string, max = 100) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

/** 曜日で決まる、全員向けのイベントの通知(月曜は開始、日曜は終了の前日) */
export function eventMessage(now: number): PushMessage | null {
  const day = jstWeekday(now);
  if (day !== 1 && day !== 0) return null;
  const ev = eventAt(now);
  const rules = EVENTS[ev.id];
  return day === 1
    ? { title: `${rules.emoji} 今週のイベント「${rules.name}」が始まったよ!`, body: rules.tagline, url: "/event", tag: `event-start:${ev.week}` }
    : {
        title: `⏰ 今週の「${rules.name}」は今日まで!`,
        body: "完走して限定スキンをゲットしよう。報酬の受け取りも忘れずに!",
        url: "/event",
        tag: `event-end:${ev.week}`,
      };
}

/**
 * 毎朝7時に送る通知を、端末ごとに決める。1つの端末には1日1通まで(いくつもあればまとめる)。
 * イベントとお知らせは全員に、プレゼントは全員向けなら全員・個別ならその人の端末にだけ送る。
 */
export function dailyPushes(now: number, batch: PushBatch): { subscription: PushSubscriptionRow; message: PushMessage }[] {
  const event = eventMessage(now);
  const news: PushMessage[] = batch.announcements.map((a) => ({
    title: `📢 ${a.title}`,
    body: clip(a.body),
    url: a.link || "/news",
    tag: `news:${a.id}`,
  }));
  return batch.subscriptions.flatMap((subscription) => {
    const gifts: PushMessage[] = batch.presents
      .filter((p) => p.userId === null || p.userId === subscription.userId)
      .map((p) => ({ title: "🎁 プレゼントが届いています", body: p.title, url: "/presents", tag: `present:${p.id}` }));
    const items = [...(event ? [event] : []), ...news, ...gifts];
    if (items.length === 0) return [];
    const message: PushMessage =
      items.length === 1
        ? items[0]
        : {
            title: `DOPATAN からのお知らせが${items.length}件あります`,
            body: clip(items.map((m) => m.title).join(" / "), 120),
            url: event ? event.url : news.length > 0 ? "/news" : "/presents",
            tag: `daily:${new Date(now + JST_OFFSET).toISOString().slice(0, 10)}`,
          };
    return [{ subscription, message }];
  });
}
