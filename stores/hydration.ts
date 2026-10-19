"use client";

import { useEffect, useState } from "react";
import { useProgress } from "./progress";
import { useSettings } from "./settings";

/**
 * 保存データの読み込みはサーバー描画と食い違わないよう、マウント後に行う。
 * 読み込みが終わるまで true にならない。
 */
export function useStoresHydrated(): boolean {
  const [hydrated, setHydrated] = useState(
    () => useSettings.persist.hasHydrated() && useProgress.persist.hasHydrated(),
  );
  useEffect(() => {
    if (hydrated) return;
    let cancelled = false;
    Promise.all([useSettings.persist.rehydrate(), useProgress.persist.rehydrate()]).then(
      () => {
        if (!cancelled) setHydrated(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [hydrated]);
  return hydrated;
}
