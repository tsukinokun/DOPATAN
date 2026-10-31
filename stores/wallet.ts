import { create } from "zustand";
import { persist } from "zustand/middleware";
import { canAfford, GACHAS, rollGacha, type GachaKind, type GachaResult } from "@/lib/economy/gacha";
import { balance, ownedSkins, skinCopies, totalFevers, type Ledger, type LedgerEvent } from "@/lib/economy/ledger";
import {
  addSessionToDaily,
  currentStreak,
  dateKey,
  EMPTY_DAILY,
  loginBonusGems,
  loginEventId,
  longestStreak,
  pendingRewards,
  sessionCoins,
  sessionXp,
  type AchievementContext,
  type DailyStats,
  type SessionSummary,
  XP_CAP,
} from "@/lib/economy/rewards";
import { applyPercent, equippedPerks } from "@/lib/economy/perks";
import { EMPTY_WALLET, type WalletData } from "@/lib/economy/walletData";
import { presentEvent, type Present } from "@/lib/presents/presents";
import { getSkin, type SkinCategory } from "@/lib/skins";
import { isMastered } from "@/lib/srs";
import { appStorage } from "@/lib/storage";
import { getWords } from "@/lib/words";
import { useProgress } from "./progress";

type WalletStore = WalletData & {
  /** 直前のプレイで受け取った報酬(結果画面用。同期しない) */
  lastRewards: LedgerEvent[];
  /** 受け取ったばかりで、まだ画面に見せていないログインボーナス(同期しない) */
  pendingBonus: { streak: number; events: LedgerEvent[] } | null;
  /** その日初めて開いたときにログインボーナスを受け取り、pendingBonus に入れる */
  checkIn: (now: number) => void;
  dismissBonus: () => void;
  recordSession: (summary: SessionSummary, now: number) => LedgerEvent[];
  /** 通貨が足りなければ null */
  pull: (kind: GachaKind, count: 1 | 10, rng: () => number, now?: number) => GachaResult[] | null;
  equip: (category: SkinCategory, id: string) => void;
  /** サーバーで決まった報酬(リーグ・招待・応援)を台帳に入れる。入れたばかりのものを返す */
  grantServerRewards: (events: LedgerEvent[]) => LedgerEvent[];
  /** プレゼントを受け取って台帳に入れる。受け取ったばかりのイベントを返す(受け取り済みは飛ばす) */
  receivePresents: (presents: Present[], now?: number) => LedgerEvent[];
};

const DAILY_KEEP_DAYS = 30;

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

/** 古い日の集計は使わないので、新しい方から決まった日数分だけ残す */
function pruneDaily(daily: Record<string, DailyStats>): Record<string, DailyStats> {
  const keys = Object.keys(daily).sort().reverse().slice(0, DAILY_KEEP_DAYS);
  return Object.fromEntries(keys.map((k) => [k, daily[k]]));
}

function masteredWordList() {
  const { progress } = useProgress.getState();
  return getWords().filter((w) => isMastered(progress[w.id])).map((w) => ({ id: w.id, word: w.word }));
}

/** 実績の判定に使う数値(コレクション画面の進み具合の表示にも使う) */
export function achievementContext(state: WalletData): AchievementContext {
  const { sessions, bestCombo, bestScore } = useProgress.getState();
  return {
    sessions,
    bestCombo,
    bestScore,
    mastered: masteredWordList().length,
    bestStreak: longestStreak(state.loginDates),
    fevers: totalFevers(state.ledger),
  };
}

/** 学習記録とウォレットから、まだ受け取っていない報酬を計算する */
function collectPending(state: WalletData, now: number): LedgerEvent[] {
  const today = dateKey(now);
  return pendingRewards({
    ledger: state.ledger,
    today,
    daily: state.daily[today] ?? EMPTY_DAILY,
    achievement: achievementContext(state),
    masteredWords: masteredWordList(),
    now,
  });
}

const withEvents = (ledger: Ledger, events: LedgerEvent[]): Ledger => ({
  ...ledger,
  ...Object.fromEntries(events.map((e) => [e.id, e])),
});

export const useWallet = create<WalletStore>()(
  persist(
    (set, get) => ({
      ...EMPTY_WALLET,
      lastRewards: [],
      pendingBonus: null,

      checkIn: (now) => {
        const state = get();
        const today = dateKey(now);
        if (state.ledger[loginEventId(today)]) return;
        const loginDates = state.loginDates.includes(today) ? state.loginDates : [...state.loginDates, today].sort();
        const streak = currentStreak(loginDates, today);
        const bonus: LedgerEvent = {
          id: loginEventId(today),
          at: now,
          label: `ログインボーナス(${streak}日連続)`,
          gems: loginBonusGems(streak),
        };
        const next = { ...state, loginDates, ledger: withEvents(state.ledger, [bonus]) };
        const events = [bonus, ...collectPending(next, now)];
        set({ loginDates, ledger: withEvents(state.ledger, events), pendingBonus: { streak, events } });
      },

      dismissBonus: () => set({ pendingBonus: null }),

      recordSession: (summary, now) => {
        const state = get();
        const today = dateKey(now);
        const perks = equippedPerks(state.equipped, skinCopies(state.ledger));
        const baseCoins = sessionCoins(summary);
        const baseXp = sessionXp(summary);
        const coins = applyPercent(baseCoins, perks.coins);
        const xp = Math.min(XP_CAP, applyPercent(baseXp, perks.xp));
        const sessionEvent: LedgerEvent = {
          id: `session:${newId()}`,
          at: now,
          label: "プレイ報酬",
          coins,
          fevers: summary.feverCount,
          xp,
          ...(coins > baseCoins && { bonusCoins: coins - baseCoins }),
          ...(xp > baseXp && { bonusXp: xp - baseXp }),
        };
        const daily = pruneDaily({
          ...state.daily,
          [today]: addSessionToDaily(state.daily[today] ?? EMPTY_DAILY, summary),
        });
        const next = { ...state, daily, ledger: withEvents(state.ledger, [sessionEvent]) };
        const events = [sessionEvent, ...collectPending(next, now)];
        set({ daily, ledger: withEvents(state.ledger, events), lastRewards: events });
        return events;
      },

      pull: (kind, count, rng, now = Date.now()) => {
        const state = get();
        const price = count === 10 ? GACHAS[kind].ten : GACHAS[kind].single;
        if (!canAfford(price, balance(state.ledger))) return null;
        const results = rollGacha(kind, count, skinCopies(state.ledger), rng);
        const pullId = `gacha:${newId()}`;
        const events: LedgerEvent[] = [
          {
            id: pullId,
            at: now,
            label: `${GACHAS[kind].name}${count === 10 ? " 10連" : ""}`,
            coins: price.coins && -price.coins,
            gems: price.gems && -price.gems,
          },
          ...results.map((r, i) => ({
            id: `${pullId}:${i}`,
            at: now,
            label: `ガチャ:${r.skin.name}`,
            skin: r.skin.id,
            coins: r.refund.coins,
            gems: r.refund.gems,
          })),
        ];
        set({ ledger: withEvents(state.ledger, events) });
        return results;
      },

      grantServerRewards: (events) => {
        const state = get();
        const fresh = events.filter((e) => !state.ledger[e.id]);
        if (fresh.length > 0) set({ ledger: withEvents(state.ledger, fresh) });
        return fresh;
      },

      receivePresents: (presents, now = Date.now()) =>
        get().grantServerRewards(presents.map((p) => presentEvent(p, now))),

      equip: (category, id) => {
        const state = get();
        if (getSkin(id)?.category !== category || !ownedSkins(state.ledger).has(id)) return;
        set({ equipped: { ...state.equipped, [category]: id } });
      },
    }),
    {
      name: "dopatan-wallet",
      storage: appStorage,
      skipHydration: true,
      partialize: ({ ledger, daily, loginDates, equipped, lastRewards }) => ({
        ledger,
        daily,
        loginDates,
        equipped,
        lastRewards,
      }),
    },
  ),
);

export function walletSnapshot(): WalletData {
  const { ledger, daily, loginDates, equipped } = useWallet.getState();
  return { ledger, daily, loginDates, equipped };
}
