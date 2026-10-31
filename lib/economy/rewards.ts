import { seededRng, shuffle } from "@/lib/random";
import type { Ledger, LedgerEvent } from "./ledger";

/** 1日分の集計。端末をまたいでマージするときは項目ごとに大きい方をとる */
export type DailyStats = {
  sessions: number;
  correct: number;
  maxCombo: number;
  newWords: number;
  fevers: number;
  /** その日の1回のプレイでの最高正解率(%) */
  bestAccuracy: number;
};

export const EMPTY_DAILY: DailyStats = { sessions: 0, correct: 0, maxCombo: 0, newWords: 0, fevers: 0, bestAccuracy: 0 };

export type SessionSummary = {
  correct: number;
  wrong: number;
  maxCombo: number;
  feverCount: number;
  newWords: number;
};

/** 端末の時刻での日付(YYYY-MM-DD) */
export function dateKey(time: number): string {
  const d = new Date(time);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function shiftDate(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  return dateKey(new Date(y, m - 1, d + days).getTime());
}

export function sessionCoins(s: SessionSummary): number {
  return 10 + s.correct * 2 + s.maxCombo + s.feverCount * 10;
}

/** サーバーが1回のプレイで受け付ける XP の上限 */
export const XP_CAP = 600;

/** 1回のプレイで得る XP。サーバーは1回あたり XP_CAP までしか受け付けない */
export function sessionXp(s: SessionSummary): number {
  return Math.min(XP_CAP, 10 + s.correct * 3 + s.maxCombo + s.feverCount * 15);
}

// ---- レベルとランク ----

export function levelFromXp(xp: number): number {
  return Math.floor(Math.sqrt(Math.max(0, xp) / 50)) + 1;
}

/** そのレベルになるのに必要な合計 XP */
export function xpForLevel(level: number): number {
  return 50 * (level - 1) ** 2;
}

export const RANKS: readonly { minLevel: number; title: string; emoji: string }[] = [
  { minLevel: 1, title: "見習い", emoji: "🐣" },
  { minLevel: 3, title: "ルーキー", emoji: "🌱" },
  { minLevel: 6, title: "単語ハンター", emoji: "🏹" },
  { minLevel: 10, title: "ボキャ戦士", emoji: "⚔️" },
  { minLevel: 15, title: "スコア職人", emoji: "🛠️" },
  { minLevel: 20, title: "TOEIC番長", emoji: "😎" },
  { minLevel: 30, title: "ボキャ賢者", emoji: "🧙" },
  { minLevel: 40, title: "単語王", emoji: "👑" },
  { minLevel: 50, title: "単語神", emoji: "🌟" },
];

export function rankFor(level: number): (typeof RANKS)[number] {
  return [...RANKS].reverse().find((r) => level >= r.minLevel)!;
}

export function addSessionToDaily(d: DailyStats, s: SessionSummary): DailyStats {
  const total = s.correct + s.wrong;
  return {
    sessions: d.sessions + 1,
    correct: d.correct + s.correct,
    maxCombo: Math.max(d.maxCombo, s.maxCombo),
    newWords: d.newWords + s.newWords,
    fevers: d.fevers + s.feverCount,
    bestAccuracy: Math.max(d.bestAccuracy, total === 0 ? 0 : Math.round((s.correct / total) * 100)),
  };
}

/** 今日までの days 日分の記録を古い順に並べる(遊ばなかった日は 0) */
export function recentDays(
  daily: Record<string, DailyStats>,
  today: string,
  days = 30,
): { date: string; sessions: number; correct: number }[] {
  return Array.from({ length: days }, (_, i) => {
    const date = shiftDate(today, i - (days - 1));
    const d = daily[date] ?? EMPTY_DAILY;
    return { date, sessions: d.sessions, correct: d.correct };
  });
}

export function mergeDaily(a: Record<string, DailyStats>, b: Record<string, DailyStats>): Record<string, DailyStats> {
  const merged = { ...b };
  for (const [date, d] of Object.entries(a)) {
    const o = merged[date];
    merged[date] = o
      ? (Object.fromEntries(
          (Object.keys(EMPTY_DAILY) as (keyof DailyStats)[]).map((k) => [k, Math.max(d[k], o[k])]),
        ) as DailyStats)
      : d;
  }
  return merged;
}

// ---- デイリーミッション ----

export type MissionDef = { id: string; label: string; target: number; value: (d: DailyStats) => number };

export const MISSIONS: readonly MissionDef[] = [
  { id: "play2", label: "今日2回遊ぶ", target: 2, value: (d) => d.sessions },
  { id: "correct40", label: "正解を40回する", target: 40, value: (d) => d.correct },
  { id: "combo20", label: "20コンボを出す", target: 20, value: (d) => d.maxCombo },
  { id: "new5", label: "新しい単語を5語覚える", target: 5, value: (d) => d.newWords },
  { id: "fever2", label: "フィーバーを2回出す", target: 2, value: (d) => d.fevers },
  { id: "acc90", label: "正解率90%以上で1回遊ぶ", target: 90, value: (d) => d.bestAccuracy },
];

export const MISSION_GEMS = 10;
export const ALL_CLEAR_GEMS = 15;

function hash(text: string): number {
  let h = 2166136261;
  for (const c of text) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}

/** その日のミッション3つ。日付から決まるので、どの端末でも同じになる */
export function missionsFor(date: string): MissionDef[] {
  return shuffle(MISSIONS, seededRng(hash(date))).slice(0, 3);
}

export const missionEventId = (date: string, id: string) => `mission:${date}:${id}`;

// ---- ログインボーナスと連続記録 ----

/** today で終わる連続ログイン日数 */
export function currentStreak(dates: readonly string[], today: string): number {
  const set = new Set(dates);
  let streak = 0;
  for (let d = today; set.has(d); d = shiftDate(d, -1)) streak++;
  return streak;
}

export function longestStreak(dates: readonly string[]): number {
  const set = new Set(dates);
  let best = 0;
  for (const d of set) {
    if (set.has(shiftDate(d, -1))) continue;
    let run = 0;
    for (let x = d; set.has(x); x = shiftDate(x, 1)) run++;
    best = Math.max(best, run);
  }
  return best;
}

export function loginBonusGems(streak: number): number {
  return 5 + (streak > 0 && streak % 7 === 0 ? 20 : 0) + (streak > 0 && streak % 30 === 0 ? 100 : 0);
}

export const loginEventId = (date: string) => `login:${date}`;

// ---- 実績 ----

export type AchievementContext = {
  sessions: number;
  bestCombo: number;
  bestScore: number;
  mastered: number;
  bestStreak: number;
  fevers: number;
};

export type AchievementDef = {
  id: string;
  label: string;
  description: string;
  gems: number;
  target: number;
  value: (c: AchievementContext) => number;
};

export const ACHIEVEMENTS: readonly AchievementDef[] = [
  { id: "first", label: "はじめの一歩", description: "初めて遊ぶ", gems: 20, target: 1, value: (c) => c.sessions },
  { id: "play10", label: "常連", description: "10回遊ぶ", gems: 30, target: 10, value: (c) => c.sessions },
  { id: "play50", label: "中毒者", description: "50回遊ぶ", gems: 50, target: 50, value: (c) => c.sessions },
  { id: "play100", label: "ドパミン廃人", description: "100回遊ぶ", gems: 100, target: 100, value: (c) => c.sessions },
  { id: "combo20", label: "コンボ見習い", description: "20コンボを出す", gems: 20, target: 20, value: (c) => c.bestCombo },
  { id: "combo50", label: "コンボ職人", description: "50コンボを出す", gems: 50, target: 50, value: (c) => c.bestCombo },
  { id: "combo100", label: "コンボの神", description: "100コンボを出す", gems: 100, target: 100, value: (c) => c.bestCombo },
  { id: "master10", label: "単語ハンター", description: "10語マスターする", gems: 30, target: 10, value: (c) => c.mastered },
  { id: "master100", label: "単語コレクター", description: "100語マスターする", gems: 60, target: 100, value: (c) => c.mastered },
  { id: "master500", label: "歩く辞書", description: "500語マスターする", gems: 100, target: 500, value: (c) => c.mastered },
  { id: "streak7", label: "1週間連続", description: "7日連続でログインする", gems: 30, target: 7, value: (c) => c.bestStreak },
  { id: "streak30", label: "1か月連続", description: "30日連続でログインする", gems: 100, target: 30, value: (c) => c.bestStreak },
  { id: "score30k", label: "ハイスコアラー", description: "1回で30,000点を取る", gems: 50, target: 30000, value: (c) => c.bestScore },
  { id: "fever30", label: "フィーバー常習犯", description: "フィーバーを合計30回出す", gems: 50, target: 30, value: (c) => c.fevers },
];

export const achievementEventId = (id: string) => `ach:${id}`;

export const MASTERY_GEMS = 2;
export const masteryEventId = (senseId: string) => `master:${senseId}`;

/**
 * まだ受け取っていない報酬(ミッション・全達成ボーナス・実績・単語マスター)を台帳のイベントとして返す。
 * 受け取り済みかは台帳の ID で判定するので、何度呼んでも二重にはならない。
 */
export function pendingRewards(args: {
  ledger: Ledger;
  today: string;
  daily: DailyStats;
  achievement: AchievementContext;
  masteredWords: readonly { id: string; word: string }[];
  now: number;
}): LedgerEvent[] {
  const { ledger, today, daily, achievement, masteredWords, now } = args;
  const events: LedgerEvent[] = [];
  const add = (e: Omit<LedgerEvent, "at">) => {
    if (!ledger[e.id]) events.push({ ...e, at: now });
  };

  const missions = missionsFor(today);
  for (const m of missions) {
    if (m.value(daily) >= m.target) {
      add({ id: missionEventId(today, m.id), label: `ミッション達成:${m.label}`, gems: MISSION_GEMS });
    }
  }
  if (missions.every((m) => m.value(daily) >= m.target)) {
    add({ id: missionEventId(today, "all"), label: "ミッション全達成ボーナス", gems: ALL_CLEAR_GEMS });
  }
  for (const a of ACHIEVEMENTS) {
    if (a.value(achievement) >= a.target) {
      add({ id: achievementEventId(a.id), label: `実績解除:${a.label}`, gems: a.gems });
    }
  }
  for (const w of masteredWords) {
    add({ id: masteryEventId(w.id), label: `マスター:${w.word}`, gems: MASTERY_GEMS });
  }
  return events;
}
