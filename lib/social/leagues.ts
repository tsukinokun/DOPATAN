export const TIERS: readonly { name: string; emoji: string; color: string }[] = [
  { name: "ブロンズ", emoji: "🥉", color: "#c07a3a" },
  { name: "シルバー", emoji: "🥈", color: "#9aa5b1" },
  { name: "ゴールド", emoji: "🥇", color: "#f2b705" },
  { name: "サファイア", emoji: "🔷", color: "#2f6fed" },
  { name: "ルビー", emoji: "♦️", color: "#e0245e" },
  { name: "エメラルド", emoji: "💚", color: "#12a150" },
  { name: "アメジスト", emoji: "🔮", color: "#8e44ad" },
  { name: "パール", emoji: "🦪", color: "#d8c8e8" },
  { name: "オブシディアン", emoji: "🖤", color: "#2d2d3a" },
  { name: "ダイヤモンド", emoji: "💎", color: "#38d3f5" },
];

export const PROMOTE_COUNT = 7;
export const DEMOTE_COUNT = 5;

export function tierOf(tier: number | null | undefined) {
  return TIERS[Math.min(Math.max(tier ?? 0, 0), TIERS.length - 1)];
}

/** 順位表の行が昇格圏・降格圏のどちらか(サーバーの ensure_league と同じ規則) */
export function zoneOf(rank: number, size: number, tier: number, xp: number): "promote" | "demote" | null {
  if (xp > 0 && rank <= PROMOTE_COUNT && tier < TIERS.length - 1) return "promote";
  if (tier > 0 && (xp === 0 || rank > size - DEMOTE_COUNT)) return "demote";
  return null;
}

/** 次の週の始まり(日本時間の月曜0時)までのミリ秒 */
export function msUntilWeekEnd(now: number): number {
  const JST = 9 * 60 * 60 * 1000;
  const local = new Date(now + JST);
  const day = (local.getUTCDay() + 6) % 7; // 月曜=0
  const startOfToday = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
  const nextMonday = startOfToday + (7 - day) * 24 * 60 * 60 * 1000;
  return nextMonday - (now + JST);
}
