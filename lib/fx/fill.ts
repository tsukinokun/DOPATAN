/** バーの位置:何レベルの、何割まで溜まっているか(0〜1) */
export type FillPoint = { level: number; ratio: number };

/** バーを1回伸ばす分。レベルをまたぐときは、満タン→0に戻る→続き、と分けて伸ばす */
export type FillStep = { level: number; from: number; to: number };

/**
 * start から end までバーを溜めるときの手順。
 * 例:Lv2 の 50% → Lv3 の 25% なら [Lv2: 0.5→1, Lv3: 0→0.25]
 */
export function fillSteps(start: FillPoint, end: FillPoint): FillStep[] {
  if (end.level < start.level || (end.level === start.level && end.ratio <= start.ratio)) {
    return [{ level: end.level, from: end.ratio, to: end.ratio }];
  }
  if (start.level === end.level) return [{ level: start.level, from: start.ratio, to: end.ratio }];
  const steps: FillStep[] = [{ level: start.level, from: start.ratio, to: 1 }];
  for (let level = start.level + 1; level < end.level; level++) steps.push({ level, from: 0, to: 1 });
  steps.push({ level: end.level, from: 0, to: end.ratio });
  return steps;
}
