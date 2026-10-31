import type { PlayStats } from "@/lib/economy/ledger";
import { accuracy, type EventRules, type Milestone } from "./types";

export const PAGE_SIZE = 20;
export const PAGES = 3;
export const TOTAL_STAMPS = PAGE_SIZE * PAGES;

/** 1回で押せるスタンプ:1個 + スコア6,000以上で1個 + 正解率90%以上で1個 */
export function stampsOf(s: PlayStats): number {
  return 1 + (s.score >= 6000 ? 1 : 0) + (accuracy(s) >= 90 ? 1 : 0);
}

const REWARDS: Record<number, Milestone["reward"]> = {
  5: { coins: 200 },
  10: { gems: 10 },
  15: { xp: 100 },
  20: { tickets: { R: 1 } },
  25: { coins: 300 },
  30: { tickets: { N: 1 } },
  35: { gems: 20 },
  40: { tickets: { SR: 1 } },
  45: { xp: 150 },
  50: { coins: 500 },
  55: { gems: 30 },
  60: { skin: "ev-stamp", gems: 100, tickets: { ANY: 1 } },
};

const MILESTONES: Milestone[] = Object.entries(REWARDS).map(([n, reward]) => ({
  id: `s${n}`,
  label: Number(n) % PAGE_SIZE === 0 ? `${Number(n) / PAGE_SIZE}ページ目を埋める` : `スタンプ${n}個`,
  reward,
  final: Number(n) === TOTAL_STAMPS,
}));

export type StampState = { stamps: number };
export type StampStep = { gained: number; from: number; to: number };

export const stamp: EventRules<StampState, StampStep> = {
  id: "stamp",
  name: "スタンプラリー",
  emoji: "💮",
  color: "from-orange-400 to-pink-400",
  tagline: "遊んでスタンプを集めよう!",
  rules: [
    "1回遊ぶとスタンプ1個。スコア6,000以上で+1個、正解率90%以上で+1個",
    "5個ごとに報酬。ページを埋めるとチケット",
    "3ページ全部埋めると限定スキン!",
  ],
  limitedSkin: "ev-stamp",
  milestones: () => MILESTONES,
  initial: () => ({ stamps: 0 }),
  apply: (state, play) => {
    const gained = stampsOf(play.stats);
    const to = Math.min(TOTAL_STAMPS, state.stamps + gained);
    return { state: { stamps: to }, detail: { gained, from: state.stamps, to } };
  },
  reached: (state) => MILESTONES.filter((m) => state.stamps >= Number(m.id.slice(1))).map((m) => m.id),
  progress: (state) => ({ value: state.stamps, max: TOTAL_STAMPS, text: `${state.stamps} / ${TOTAL_STAMPS} 個` }),
};
