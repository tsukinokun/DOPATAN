"use client";

import { useEffect, useState } from "react";
import { APP_NEWS } from "@/lib/news/catalog";
import { eventNews, mergeNews, unreadCount, type News } from "@/lib/news/news";
import { getSupabase } from "@/lib/supabase/client";
import { useNews } from "@/stores/news";

type Row = { id: string; title: string; body: string; link: string | null; startsAt: string; expiresAt: string | null };

let fetched = false;

/** サーバーのお知らせを1回だけ読む(ゲストも読める。失敗したら出さないだけ) */
function useServerNews() {
  useEffect(() => {
    if (fetched) return;
    const supabase = getSupabase();
    if (!supabase) return;
    fetched = true;
    void supabase.rpc("list_announcements").then(({ data, error }) => {
      if (error || !data) return;
      useNews.getState().setServerNews(
        (data as Row[]).map((r) => ({
          id: `server:${r.id}`,
          kind: "server",
          title: r.title,
          body: r.body,
          link: r.link ?? undefined,
          at: Date.parse(r.startsAt),
          expiresAt: r.expiresAt ? Date.parse(r.expiresAt) : null,
        })),
      );
    });
  }, []);
}

/** 公開中のお知らせ(新しい順)と未読の数 */
export function useNewsList(): { news: News[]; unread: number; readIds: string[] } {
  useServerNews();
  const [now] = useState(Date.now);
  const serverNews = useNews((s) => s.serverNews);
  const readIds = useNews((s) => s.readIds);
  const news = mergeNews([[eventNews(now)], APP_NEWS, serverNews], now);
  return { news, unread: unreadCount(news, readIds), readIds };
}
