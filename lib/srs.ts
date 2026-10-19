/** 単語(意味)ごとの学習記録。Leitner 方式の箱で復習間隔を決める。 */
export type SenseProgress = {
  /** 出題された回数。選択肢の枚数(1枚→2枚→4枚)を決める */
  exposures: number;
  box: number;
  /** 次に復習すべき時刻(ms) */
  due: number;
  correct: number;
  wrong: number;
};

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

/** box ごとの次回復習までの間隔 */
export const BOX_INTERVALS = [0, 10 * MINUTE, DAY, 3 * DAY, 7 * DAY, 14 * DAY, 30 * DAY];
export const MASTERED_BOX = 5;
const MAX_BOX = BOX_INTERVALS.length - 1;

export function newProgress(): SenseProgress {
  return { exposures: 0, box: 0, due: 0, correct: 0, wrong: 0 };
}

export function applyAnswer(
  progress: SenseProgress | undefined,
  correct: boolean,
  now: number,
): SenseProgress {
  const p = progress ?? newProgress();
  const box = correct ? Math.min(p.box + 1, MAX_BOX) : 1;
  return {
    exposures: p.exposures + 1,
    box,
    due: now + BOX_INTERVALS[box],
    correct: p.correct + (correct ? 1 : 0),
    wrong: p.wrong + (correct ? 0 : 1),
  };
}

export function isMastered(progress: SenseProgress | undefined): boolean {
  return (progress?.box ?? 0) >= MASTERED_BOX;
}

export function isDue(progress: SenseProgress | undefined, now: number): boolean {
  return progress !== undefined && progress.exposures > 0 && progress.due <= now;
}

/** 新しい単語は 1枚(紹介)→2枚→4枚 */
export function choiceCountFor(exposures: number): 1 | 2 | 4 {
  if (exposures === 0) return 1;
  if (exposures === 1) return 2;
  return 4;
}
