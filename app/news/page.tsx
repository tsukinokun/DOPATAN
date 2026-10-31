"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { PushCard } from "@/components/news/PushCard";
import { useNewsList } from "@/components/news/useNewsList";
import { Hydrated, Panel, PopButton } from "@/components/ui";
import type { News } from "@/lib/news/news";
import { useNews } from "@/stores/news";

export default function NewsPage() {
  return (
    <Hydrated>
      <NewsList />
    </Hydrated>
  );
}

const ICON: Record<News["kind"], string> = { event: "🎉", app: "📢", server: "📢" };

const formatDate = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
};

function NewsList() {
  const { news, readIds } = useNewsList();
  // 開いたときの未読を覚えておき(印を出すため)、全部既読にする
  const [unreadAtOpen] = useState(() => new Set(news.filter((n) => !readIds.includes(n.id)).map((n) => n.id)));
  const ids = news.map((n) => n.id).join(",");
  useEffect(() => {
    if (ids) useNews.getState().markRead(ids.split(","));
  }, [ids]);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-4 px-4 py-6">
      <header className="flex items-center gap-3">
        <PopButton href="/" color="white" className="px-3 py-2">
          ←
        </PopButton>
        <h1 className="text-3xl font-black text-white text-stroke">お知らせ</h1>
      </header>

      <PushCard />

      {news.length === 0 ? (
        <Panel className="py-10 text-center font-black text-slate-500">お知らせはありません</Panel>
      ) : (
        <ul className="flex flex-col gap-3" data-testid="news-list">
          {news.map((n, i) => (
            <motion.li key={n.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <NewsCard news={n} unread={unreadAtOpen.has(n.id)} />
            </motion.li>
          ))}
        </ul>
      )}
    </main>
  );
}

function NewsCard({ news: n, unread }: { news: News; unread: boolean }) {
  const [open, setOpen] = useState(false);
  const long = n.body.length > 80 || n.body.split("\n").length > 3;
  return (
    <Panel className="flex flex-col gap-2" testId={`news-${n.id}`}>
      <div className="flex items-start gap-2">
        <span className="text-2xl" aria-hidden>
          {n.icon ?? ICON[n.kind]}
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-[11px] font-black text-slate-400">
            {formatDate(n.at)}
            {unread && <span className="ml-2 rounded-full bg-pink-500 px-1.5 text-white">NEW</span>}
          </span>
          <span className="font-black leading-tight">{n.title}</span>
        </div>
      </div>
      <p className={`whitespace-pre-wrap text-sm text-slate-600 ${long && !open ? "line-clamp-3" : ""}`}>{n.body}</p>
      <div className="flex items-center justify-between">
        {long ? (
          <button type="button" onClick={() => setOpen((o) => !o)} className="text-xs font-black text-sky-600">
            {open ? "とじる" : "もっと見る"}
          </button>
        ) : (
          <span />
        )}
        {n.link && (
          <PopButton href={n.link} color="yellow" className="px-3 py-1 text-sm">
            {n.link === "/event" ? "イベントを見る ▶" : "ひらく ▶"}
          </PopButton>
        )}
      </div>
    </Panel>
  );
}
