"use client";

import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { useEffect } from "react";
import { loadRemote, saveRemote } from "@/lib/storage/cloud";
import { mergeData, type SyncedData } from "@/lib/storage/merge";
import { getSupabase } from "@/lib/supabase/client";
import { useAuth } from "@/stores/auth";
import { useStoresHydrated } from "@/stores/hydration";
import { useProgress } from "@/stores/progress";
import { DEFAULT_SETTINGS, useSettings, type Settings } from "@/stores/settings";
import { EMPTY_WALLET } from "@/lib/economy/walletData";
import { useWallet, walletSnapshot } from "@/stores/wallet";

const SAVE_DELAY_MS = 2000;

/** クラウドに保存する設定。ゲストの名前は端末だけのもの(ログイン後はクラウドのニックネームを使う) */
type CloudSettings = Omit<Settings, "guestName">;

function snapshot(): SyncedData<CloudSettings> {
  const { progress, sessions, bestScore, bestCombo } = useProgress.getState();
  const { showJapanese, effectIntensity, sound, bgm, vibration, modes, bands, themes } = useSettings.getState();
  return {
    progress,
    stats: { sessions, bestScore, bestCombo },
    settings: { showJapanese, effectIntensity, sound, bgm, vibration, modes, bands, themes },
    wallet: walletSnapshot(),
  };
}

function apply(data: SyncedData<CloudSettings>) {
  useProgress.setState({ progress: data.progress, ...data.stats });
  if (data.settings) useSettings.setState({ ...DEFAULT_SETTINGS, ...data.settings, guestName: useSettings.getState().guestName });
  if (data.wallet) useWallet.setState(data.wallet);
}

function clearLocal() {
  useProgress.setState({ progress: {}, sessions: 0, bestScore: 0, bestCombo: 0, lastResult: null });
  useSettings.setState(DEFAULT_SETTINGS);
  useWallet.setState({ ...EMPTY_WALLET, lastRewards: [] });
}

/**
 * ログイン状態を見張り、端末の記録とクラウドの記録を同期する。
 * - ログインしたとき:クラウドと端末の記録をマージして両方に反映
 * - ログイン中:記録や設定が変わったら少し待ってから保存(プレイ終了時はすぐ保存)
 * - ログアウトしたとき:共用端末に記録が残らないよう端末の記録を消す
 */
export function AuthSync() {
  const hydrated = useStoresHydrated();

  useEffect(() => {
    const supabase = getSupabase();
    const auth = useAuth.getState();
    if (!supabase) {
      auth.set({ status: "disabled" });
      return;
    }
    if (!hydrated) return;

    let saveTimer: ReturnType<typeof setTimeout> | null = null;
    let applying = false;

    const save = async () => {
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = null;
      const { userId, set } = useAuth.getState();
      if (!userId) return;
      set({ syncState: "syncing" });
      try {
        await saveRemote(supabase, userId, snapshot());
        set({ syncState: "synced" });
      } catch {
        set({ syncState: "error" });
      }
    };

    const scheduleSave = () => {
      if (applying || useAuth.getState().status !== "signedIn") return;
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(save, SAVE_DELAY_MS);
    };

    const signIn = async (session: Session) => {
      const { set, userId } = useAuth.getState();
      if (userId === session.user.id) return;
      set({ status: "signedIn", userId: session.user.id, email: session.user.email ?? null, syncState: "syncing" });
      try {
        const merged = mergeData(snapshot(), await loadRemote<CloudSettings>(supabase, session.user.id));
        applying = true;
        apply(merged);
        applying = false;
        await saveRemote(supabase, session.user.id, merged);
        set({ syncState: "synced" });
      } catch {
        applying = false;
        set({ syncState: "error" });
      }
    };

    const onAuthChange = (event: AuthChangeEvent, session: Session | null) => {
      if (session?.user) {
        void signIn(session);
        return;
      }
      const wasSignedIn = useAuth.getState().status === "signedIn";
      useAuth.getState().set({ status: "guest", userId: null, email: null, syncState: "idle" });
      if (event === "SIGNED_OUT" && wasSignedIn) {
        if (saveTimer) clearTimeout(saveTimer);
        applying = true;
        clearLocal();
        applying = false;
      }
    };

    // コールバックの中で Supabase を呼ぶと詰まることがあるため、処理は次のタイミングに回す
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      setTimeout(() => onAuthChange(event, session), 0);
    });

    const unsubProgress = useProgress.subscribe((state, prev) => {
      if (state.lastResult !== prev.lastResult && !applying && useAuth.getState().status === "signedIn") {
        void save();
      } else {
        scheduleSave();
      }
    });
    const unsubSettings = useSettings.subscribe(scheduleSave);
    const unsubWallet = useWallet.subscribe(scheduleSave);
    const flush = () => {
      if (saveTimer) void save();
    };
    window.addEventListener("pagehide", flush);

    return () => {
      data.subscription.unsubscribe();
      unsubProgress();
      unsubSettings();
      unsubWallet();
      window.removeEventListener("pagehide", flush);
      if (saveTimer) clearTimeout(saveTimer);
    };
  }, [hydrated]);

  return null;
}
