import { shuffle, type Rng } from "./random";
import type { WordSense } from "./types";

/**
 * 同じ問題の選択肢に並べてはいけない組み合わせか。
 * 多義語の別の意味・類義語・同じ和訳・同じ絵は、どれが正解か曖昧になるので並べない。
 */
export function conflicts(a: WordSense, b: WordSense): boolean {
  return (
    a.word === b.word ||
    (a.synonymGroup !== undefined && a.synonymGroup === b.synonymGroup) ||
    a.ja === b.ja ||
    a.emoji === b.emoji
  );
}

/**
 * 正解 target に対するハズレ選択肢を count 個選ぶ。
 * 選ばれた選択肢同士も互いに conflicts しない。品詞が同じものを優先して紛らわしくする。
 */
export function pickDistractors(
  target: WordSense,
  pool: readonly WordSense[],
  count: number,
  rng: Rng,
): WordSense[] {
  const candidates = shuffle(pool, rng).sort(
    (a, b) => Number(b.pos === target.pos) - Number(a.pos === target.pos),
  );
  const chosen: WordSense[] = [];
  for (const candidate of candidates) {
    if (chosen.length >= count) break;
    if ([target, ...chosen].some((s) => conflicts(s, candidate))) continue;
    chosen.push(candidate);
  }
  return chosen;
}
