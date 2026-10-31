import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { News } from "@/lib/news/news";
import { appStorage } from "@/lib/storage";

type NewsStore = {
  /** 読んだお知らせの ID(この端末だけ。同期はしない) */
  readIds: string[];
  /** サーバー(announcements)から届いたお知らせ */
  serverNews: News[];
  markRead: (ids: string[]) => void;
  setServerNews: (news: News[]) => void;
};

/** 古い既読はいらないので、新しい方からこの数だけ残す */
const KEEP = 200;

export const useNews = create<NewsStore>()(
  persist(
    (set) => ({
      readIds: [],
      serverNews: [],
      markRead: (ids) =>
        set((s) => {
          const fresh = ids.filter((id) => !s.readIds.includes(id));
          return fresh.length === 0 ? s : { readIds: [...s.readIds, ...fresh].slice(-KEEP) };
        }),
      setServerNews: (serverNews) => set({ serverNews }),
    }),
    { name: "dopatan-news", storage: appStorage, skipHydration: true, partialize: ({ readIds }) => ({ readIds }) },
  ),
);
