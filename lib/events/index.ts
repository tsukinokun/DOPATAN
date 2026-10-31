import type { Ledger } from "@/lib/economy/ledger";
import type { Present } from "@/lib/presents/presents";
import { bingo, type BingoState, type BingoStep } from "./bingo";
import { boss, type BossState, type BossStep } from "./boss";
import { stamp, type StampState, type StampStep } from "./stamp";
import { sugoroku, type SugorokuState, type SugorokuStep } from "./sugoroku";
import { runEvent, type EventId, type EventRules, type Play, type Run } from "./types";
import { eventForWeek, WEEK_MS, weekKey, weekStart } from "./week";

export const EVENTS = { sugoroku, bingo, boss, stamp } as const;

/** イベントごとの計算結果(画面で種類ごとに出し分ける) */
export type AnyRun =
  | { id: "sugoroku"; run: Run<SugorokuState, SugorokuStep> }
  | { id: "bingo"; run: Run<BingoState, BingoStep> }
  | { id: "boss"; run: Run<BossState, BossStep> }
  | { id: "stamp"; run: Run<StampState, StampStep> };

export function simulate(id: EventId, plays: readonly Play[], week: string): AnyRun {
  switch (id) {
    case "sugoroku":
      return { id, run: runEvent(sugoroku, plays, week) };
    case "bingo":
      return { id, run: runEvent(bingo, plays, week) };
    case "boss":
      return { id, run: runEvent(boss, plays, week) };
    case "stamp":
      return { id, run: runEvent(stamp, plays, week) };
  }
}

export const rulesOf = (id: EventId) => EVENTS[id] as EventRules<unknown, unknown>;

/** その週のプレイ(成績つきのプレイ報酬だけ)。時刻順、同じ時刻なら ID 順 */
export function playsOfWeek(ledger: Ledger, start: number): Play[] {
  const end = start + WEEK_MS;
  return Object.values(ledger)
    .filter((e) => e.id.startsWith("session:") && e.stats && e.at >= start && e.at < end)
    .map((e) => ({ id: e.id, at: e.at, stats: e.stats! }))
    .sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

export type WeekEvent = { id: EventId; week: string; start: number; end: number };

/** その時刻のイベント。override で差し替えられる(開発中の確認用) */
export function eventAt(now: number, override?: EventId): WeekEvent {
  const start = weekStart(now);
  return { id: override ?? eventForWeek(start), week: weekKey(start), start, end: start + WEEK_MS };
}

/** 報酬の受け取り期限:イベント終了から7日 */
export const REWARD_DAYS_AFTER_END = 7;

/** その週のイベントで届いた報酬を、プレゼントとして作る */
function presentsOfWeek(ledger: Ledger, ev: WeekEvent): Present[] {
  const rules = rulesOf(ev.id);
  const { reached } = simulate(ev.id, playsOfWeek(ledger, ev.start), ev.week).run;
  const milestones = new Map(rules.milestones(ev.week).map((m) => [m.id, m]));
  return reached.map((id: string) => {
    const m = milestones.get(id)!;
    return {
      id: `${ev.week}:${id}`,
      source: "event",
      title: `${rules.emoji} ${rules.name}:${m.label}`,
      message: m.final ? "完走おめでとう!限定スキンをお届けします。" : "イベントの報酬です。",
      ...m.reward,
      startsAt: ev.start,
      expiresAt: ev.end + REWARD_DAYS_AFTER_END * 24 * 60 * 60 * 1000,
    };
  });
}

/** 今週と先週のイベントの報酬(先週の分も、期限まではプレゼントボックスに残る) */
export function eventPresents(ledger: Ledger, now: number, override?: EventId): Present[] {
  const current = eventAt(now, override);
  const last = eventAt(current.start - 1);
  return [...presentsOfWeek(ledger, last), ...presentsOfWeek(ledger, current)];
}

export type { EventId, Play } from "./types";
