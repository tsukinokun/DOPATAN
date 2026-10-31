import { eventAt, EVENTS } from "@/lib/events";

/** お知らせ1件。event はイベント開始(自動)、app はコードに書いたもの、server は Supabase の announcements */
export type News = {
  id: string;
  kind: "event" | "app" | "server";
  title: string;
  body: string;
  /** 載せた日時(ミリ秒) */
  at: number;
  /** 一覧で左に出す絵文字(無ければ種類で決まる) */
  icon?: string;
  /** ボタンで開く画面(例:/event) */
  link?: string;
  /** これより後は出さない */
  expiresAt?: number | null;
};

/** 今週のイベント開始のお知らせ(週から自動で作る) */
export function eventNews(now: number): News {
  const ev = eventAt(now);
  const rules = EVENTS[ev.id];
  return {
    id: `event-start:${ev.week}`,
    kind: "event",
    icon: rules.emoji,
    title: `今週のイベント「${rules.name}」開催中!`,
    body: `${rules.tagline}\n\n${rules.rules.map((r) => `・${r}`).join("\n")}\n\n期間は次の月曜0時(日本時間)までです。`,
    at: ev.start,
    link: "/event",
  };
}

/** 公開中のお知らせを新しい順に並べる。同じ ID は1つにする */
export function mergeNews(lists: readonly (readonly News[])[], now: number): News[] {
  const byId = new Map<string, News>();
  for (const n of lists.flat()) {
    if (n.at > now || (n.expiresAt != null && n.expiresAt <= now)) continue;
    if (!byId.has(n.id)) byId.set(n.id, n);
  }
  return [...byId.values()].sort((a, b) => b.at - a.at);
}

export function unreadCount(news: readonly News[], readIds: readonly string[]): number {
  const read = new Set(readIds);
  return news.filter((n) => !read.has(n.id)).length;
}
