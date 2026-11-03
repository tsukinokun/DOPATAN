/** プレイヤーレベルのスコアボーナス:Lv.N なら +N%(上限なし) */
export const levelBonusPercent = (level: number) => Math.max(0, level);

export type LevelBonus = { level: number; percent: number; points: number };

/** ボーナス前のスコアとレベルから、ボーナスの点数と合計を出す */
export function applyLevelBonus(base: number, level: number): LevelBonus & { total: number } {
  const percent = levelBonusPercent(level);
  const points = Math.round((base * percent) / 100);
  return { level, percent, points, total: base + points };
}
