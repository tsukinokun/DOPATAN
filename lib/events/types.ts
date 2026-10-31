import type { PlayStats, Tickets } from "@/lib/economy/ledger";

export type EventId = "sugoroku" | "bingo" | "boss" | "stamp";

/** イベントの計算に使う1回分のプレイ(台帳のプレイ報酬から作る) */
export type Play = { id: string; at: number; stats: PlayStats };

/** 報酬の中身。プレゼントボックスに届く */
export type Reward = { coins?: number; gems?: number; xp?: number; skin?: string; tickets?: Tickets };

/** 途中報酬・完走報酬 */
export type Milestone = { id: string; label: string; reward: Reward; final?: boolean };

/**
 * イベントのルール。状態はプレイを1回ずつ apply して作る(同じプレイ列なら必ず同じ結果)。
 * detail はそのプレイで何が起きたか(演出に使う)。
 */
export interface EventRules<S, D> {
  id: EventId;
  name: string;
  emoji: string;
  /** バナーの背景(Tailwind のクラス) */
  color: string;
  tagline: string;
  rules: string[];
  /** 完走報酬の限定スキン */
  limitedSkin: string;
  milestones: (week: string) => Milestone[];
  initial: (week: string) => S;
  apply: (state: S, play: Play, week: string) => { state: S; detail: D };
  /** 届いた報酬の ID */
  reached: (state: S, week: string) => string[];
  /** バナーなどに出す進み具合 */
  progress: (state: S, week: string) => { value: number; max: number; text: string };
}

export type Run<S, D> = { state: S; details: D[]; reached: string[] };

export function runEvent<S, D>(rules: EventRules<S, D>, plays: readonly Play[], week: string): Run<S, D> {
  let state = rules.initial(week);
  const details: D[] = [];
  for (const play of plays) {
    const next = rules.apply(state, play, week);
    state = next.state;
    details.push(next.detail);
  }
  return { state, details, reached: rules.reached(state, week) };
}

/** 正解率(%)。答えが少なすぎるプレイは 0 にする */
export function accuracy(s: PlayStats, minAnswers = 10): number {
  const total = s.correct + s.wrong;
  return total < minAnswers ? 0 : Math.round((s.correct / total) * 100);
}
