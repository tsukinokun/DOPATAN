import sample from "@/data/words/sample.json";
import type { ScoreBand, Theme, WordSense } from "./types";

export const WORDS: readonly WordSense[] = sample as WordSense[];

export function filterScope(
  words: readonly WordSense[],
  bands: readonly ScoreBand[],
  themes: readonly Theme[],
): WordSense[] {
  const scoped = words.filter(
    (w) =>
      (bands.length === 0 || bands.includes(w.band)) &&
      (themes.length === 0 || themes.includes(w.theme)),
  );
  return scoped.length > 0 ? scoped : [...words];
}
