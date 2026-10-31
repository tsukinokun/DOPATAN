import type { EventId } from "./types";

export const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const JST_OFFSET = 9 * 60 * 60 * 1000;

/** イベントが切り替わる週の始まり(日本時間の月曜0時)のミリ秒。リーグと同じ区切り */
export function weekStart(now: number): number {
  const jst = new Date(now + JST_OFFSET);
  const daysSinceMonday = (jst.getUTCDay() + 6) % 7;
  return Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth(), jst.getUTCDate() - daysSinceMonday) - JST_OFFSET;
}

/** 週のキー(その週の月曜日の日付。日本時間) */
export function weekKey(start: number): string {
  return new Date(start + JST_OFFSET).toISOString().slice(0, 10);
}

/** ローテーションの順番 */
export const EVENT_ORDER: readonly EventId[] = ["sugoroku", "bingo", "boss", "stamp"];

/** この週が順番の最初(すごろく) */
const ANCHOR = Date.parse("2026-10-26T00:00:00+09:00");

export function eventForWeek(start: number): EventId {
  const index = Math.round((start - ANCHOR) / WEEK_MS);
  const n = EVENT_ORDER.length;
  return EVENT_ORDER[((index % n) + n) % n];
}

/** 残り時間の表示(「あと2日」「あと5時間」) */
export function timeLeftLabel(end: number, now: number): string {
  const left = Math.max(0, end - now);
  const hours = Math.ceil(left / (60 * 60 * 1000));
  if (hours <= 24) return `あと${Math.max(1, hours)}時間`;
  return `あと${Math.ceil(hours / 24)}日`;
}
