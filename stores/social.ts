import { create } from "zustand";
import { totalXp, type LedgerEvent } from "@/lib/economy/ledger";
import { currentStreak, dateKey, levelFromXp } from "@/lib/economy/rewards";
import { isMastered } from "@/lib/srs";
import { socialApi, type Inbox, type MyProfile } from "@/lib/social/api";
import { rewardsFromInbox } from "@/lib/social/rewards";
import { getSupabase } from "@/lib/supabase/client";
import { useAuth } from "./auth";
import { useProgress } from "./progress";
import { useWallet } from "./wallet";

/** 招待リンクから来たときに、ログインするまでコードを覚えておく場所 */
export const PENDING_INVITE_KEY = "dopatan-invite-code";

type SocialStore = {
  profile: MyProfile | null;
  inbox: Inbox | null;
  /** 受け取ったばかりのサーバー由来の報酬(ホームで通知する) */
  newRewards: LedgerEvent[];
  /** 招待を受け取った結果のメッセージ(ホームで通知する) */
  inviteMessage: string | null;
  refresh: () => Promise<void>;
  submitXp: (xp: number) => Promise<void>;
  acceptPendingInvite: () => Promise<void>;
  setNickname: (nickname: string) => Promise<void>;
  dismissNotices: () => void;
  reset: () => void;
};

function publicStats() {
  const { ledger, loginDates, equipped } = useWallet.getState();
  const { progress, bestCombo } = useProgress.getState();
  return {
    level: levelFromXp(totalXp(ledger)),
    mastered: Object.values(progress).filter((p) => isMastered(p)).length,
    streak: currentStreak(loginDates, dateKey(Date.now())),
    bestCombo,
    background: equipped.background,
  };
}

function signedInClient() {
  const supabase = getSupabase();
  return supabase && useAuth.getState().status === "signedIn" ? supabase : null;
}

/** 保存しておいた招待コードがあれば、招待を受け取る */
async function acceptInvite(set: (patch: Partial<SocialStore>) => void): Promise<void> {
  const supabase = signedInClient();
  let code: string | null = null;
  try {
    code = localStorage.getItem(PENDING_INVITE_KEY);
  } catch {}
  if (!supabase || !code) return;
  try {
    const inviter = await socialApi.acceptInvite(supabase, code);
    set({ inviteMessage: `${inviter.nickname ?? "招待した人"}さんとフレンドになりました!` });
  } catch (e) {
    set({ inviteMessage: e instanceof Error ? e.message : "招待を受け取れませんでした" });
  } finally {
    try {
      localStorage.removeItem(PENDING_INVITE_KEY);
    } catch {}
  }
}

/** 同時に2回受け取ろうとすると2回目が「使用済み」になるので、実行中は使い回す */
let accepting: Promise<void> | null = null;

export const useSocial = create<SocialStore>()((set, get) => ({
  profile: null,
  inbox: null,
  newRewards: [],
  inviteMessage: null,

  refresh: async () => {
    const supabase = signedInClient();
    if (!supabase) return;
    const [profile, inbox] = await Promise.all([socialApi.myProfile(supabase), socialApi.inbox(supabase)]);
    const fresh = useWallet.getState().grantServerRewards(rewardsFromInbox(inbox, Date.now()));
    set((s) => ({ profile, inbox, newRewards: [...s.newRewards, ...fresh] }));
    await socialApi.publishStats(supabase, publicStats());
  },

  submitXp: async (xp) => {
    const supabase = signedInClient();
    if (!supabase) return;
    try {
      await socialApi.submitXp(supabase, xp);
    } finally {
      await get().refresh();
    }
  },

  acceptPendingInvite: () => {
    accepting ??= acceptInvite(set).finally(() => {
      accepting = null;
    });
    return accepting;
  },
  setNickname: async (nickname) => {
    const supabase = signedInClient();
    if (!supabase) return;
    await socialApi.setNickname(supabase, nickname);
    set((s) => ({ profile: s.profile && { ...s.profile, nickname } }));
  },

  dismissNotices: () => set({ newRewards: [], inviteMessage: null }),
  reset: () => set({ profile: null, inbox: null, newRewards: [], inviteMessage: null }),
}));
