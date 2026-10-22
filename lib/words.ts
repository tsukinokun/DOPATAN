import { SCORE_BANDS, type ScoreBand, type Theme, type WordSense } from "./types";

/** スコア帯ごとの単語ファイルを、使うときに読み込む(最初に表示する JavaScript を軽くするため) */
const LOADERS: Record<ScoreBand, () => Promise<{ default: unknown }>> = {
  600: () => import("@/data/words/600.json"),
  730: () => import("@/data/words/730.json"),
  860: () => import("@/data/words/860.json"),
  990: () => import("@/data/words/990.json"),
};

let words: readonly WordSense[] = [];
let loading: Promise<readonly WordSense[]> | null = null;
const listeners = new Set<() => void>();

/** 単語の読み込みが終わったら呼ばれる(useSyncExternalStore 用) */
export function subscribeWords(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** 全スコア帯の単語を読み込む。何度呼んでも読み込みは1回だけ */
export function loadWords(): Promise<readonly WordSense[]> {
  loading ??= Promise.all(SCORE_BANDS.map((band) => LOADERS[band]())).then((modules) => {
    words = modules.flatMap((m) => m.default as WordSense[]);
    listeners.forEach((l) => l());
    return words;
  });
  return loading;
}

/** 読み込み済みの単語。loadWords が終わる前は空 */
export function getWords(): readonly WordSense[] {
  return words;
}

export function filterScope(
  all: readonly WordSense[],
  bands: readonly ScoreBand[],
  themes: readonly Theme[],
): WordSense[] {
  const scoped = all.filter(
    (w) =>
      (bands.length === 0 || bands.includes(w.band)) &&
      (themes.length === 0 || themes.includes(w.theme)),
  );
  return scoped.length > 0 ? scoped : [...all];
}
