"use client";

import { useEffect } from "react";
import { useAuth } from "@/stores/auth";
import { useSocial } from "@/stores/social";

const REFRESH_INTERVAL_MS = 60_000;

/** ログイン中は、通知(応援・申請・リーグ報酬など)を取りに行き、報酬を台帳に入れる */
export function SocialSync() {
  const status = useAuth((s) => s.status);
  const syncState = useAuth((s) => s.syncState);

  useEffect(() => {
    if (status !== "signedIn") {
      useSocial.getState().reset();
      return;
    }
    // クラウドとのマージが終わってから報酬を入れる(同じ ID なので重複はしないが、表示がちらつかないように)
    if (syncState === "syncing") return;
    let last = 0;
    const refresh = () => {
      if (Date.now() - last < REFRESH_INTERVAL_MS) return;
      last = Date.now();
      void useSocial.getState().refresh().catch(() => {});
    };
    void useSocial
      .getState()
      .acceptPendingInvite()
      .finally(refresh);
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    const timer = setInterval(refresh, REFRESH_INTERVAL_MS);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(timer);
    };
  }, [status, syncState]);

  return null;
}
