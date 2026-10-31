import { NO_PERKS, type Perks } from "@/lib/economy/perks";

/** 1問の点数。perks は装備中のスキン効果(スコア%とコンボスコア%) */
export function pointsFor(
  combo: number,
  fever: boolean,
  intro: boolean,
  perks: Pick<Perks, "score" | "combo"> = NO_PERKS,
): number {
  const comboPoints = Math.min(combo, 50) * 10 * (1 + perks.combo / 100);
  const base = intro ? 50 : 100 + comboPoints;
  return Math.round(base * (1 + perks.score / 100)) * (fever ? 3 : 1);
}
