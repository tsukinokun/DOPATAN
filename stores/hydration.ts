"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useProgress } from "./progress";
import { useSettings } from "./settings";

let rehydrating: Promise<unknown> | null = null;

function subscribe(onChange: () => void) {
  const unsubSettings = useSettings.persist.onFinishHydration(onChange);
  const unsubProgress = useProgress.persist.onFinishHydration(onChange);
  return () => {
    unsubSettings();
    unsubProgress();
  };
}

function isHydrated() {
  return useSettings.persist.hasHydrated() && useProgress.persist.hasHydrated();
}

/**
 * 保存データの読み込みはサーバー描画と食い違わないよう、マウント後に行う。
 * 画面の一部が先にハイドレーションされて読み込みが済んでいても、
 * サーバーと同じ「未読み込み」から始めるため useSyncExternalStore を使う。
 */
export function useStoresHydrated(): boolean {
  const hydrated = useSyncExternalStore(subscribe, isHydrated, () => false);
  useEffect(() => {
    if (isHydrated()) return;
    rehydrating ??= Promise.all([useSettings.persist.rehydrate(), useProgress.persist.rehydrate()]);
  }, []);
  return hydrated;
}
