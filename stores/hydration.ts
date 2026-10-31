"use client";

import { useEffect, useSyncExternalStore } from "react";
import { getWords, loadWords, subscribeWords } from "@/lib/words";
import { useNews } from "./news";
import { useProgress } from "./progress";
import { useSettings } from "./settings";
import { useWallet } from "./wallet";

let rehydrating: Promise<unknown> | null = null;

function subscribe(onChange: () => void) {
  const unsubSettings = useSettings.persist.onFinishHydration(onChange);
  const unsubProgress = useProgress.persist.onFinishHydration(onChange);
  const unsubWallet = useWallet.persist.onFinishHydration(onChange);
  const unsubNews = useNews.persist.onFinishHydration(onChange);
  const unsubWords = subscribeWords(onChange);
  return () => {
    unsubWords();
    unsubSettings();
    unsubProgress();
    unsubWallet();
    unsubNews();
  };
}

function isHydrated() {
  return (
    useSettings.persist.hasHydrated() &&
    useProgress.persist.hasHydrated() &&
    useWallet.persist.hasHydrated() &&
    useNews.persist.hasHydrated() &&
    getWords().length > 0
  );
}

/**
 * 保存データと単語の読み込みはサーバー描画と食い違わないよう、マウント後に行う。
 * 画面の一部が先にハイドレーションされて読み込みが済んでいても、
 * サーバーと同じ「未読み込み」から始めるため useSyncExternalStore を使う。
 */
export function useStoresHydrated(): boolean {
  const hydrated = useSyncExternalStore(subscribe, isHydrated, () => false);
  useEffect(() => {
    if (isHydrated()) return;
    rehydrating ??= Promise.all([
      useSettings.persist.rehydrate(),
      useProgress.persist.rehydrate(),
      useWallet.persist.rehydrate(),
      useNews.persist.rehydrate(),
      loadWords(),
    ]);
  }, []);
  return hydrated;
}
