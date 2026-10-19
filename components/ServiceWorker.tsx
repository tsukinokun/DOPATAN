"use client";

import { useEffect } from "react";

/** PWA としてインストールできるように Service Worker を登録する(オフライン対応はしない) */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}
