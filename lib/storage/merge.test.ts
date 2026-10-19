import { describe, expect, it } from "vitest";
import { mergeData, type SyncedData } from "./merge";

const p = (exposures: number, due: number) => ({ exposures, box: exposures, due, correct: exposures, wrong: 0 });

const local: SyncedData<{ showJapanese: boolean }> = {
  progress: { a: p(3, 100), b: p(1, 50), c: p(2, 10) },
  stats: { sessions: 4, bestScore: 900, bestCombo: 12 },
  settings: { showJapanese: true },
};

const remote: SyncedData<{ showJapanese: boolean }> = {
  progress: { a: p(5, 10), b: p(1, 80), d: p(1, 1) },
  stats: { sessions: 7, bestScore: 500, bestCombo: 20 },
  settings: { showJapanese: false },
};

describe("mergeData", () => {
  it("keeps the more practised record for each word", () => {
    const merged = mergeData(local, remote);
    expect(merged.progress.a.exposures).toBe(5);
    expect(merged.progress.b.due).toBe(80);
    expect(Object.keys(merged.progress).sort()).toEqual(["a", "b", "c", "d"]);
  });

  it("takes the best of each stat and prefers remote settings", () => {
    const merged = mergeData(local, remote);
    expect(merged.stats).toEqual({ sessions: 7, bestScore: 900, bestCombo: 20 });
    expect(merged.settings).toEqual({ showJapanese: false });
  });

  it("is idempotent", () => {
    const once = mergeData(local, remote);
    expect(mergeData(once, remote)).toEqual(once);
    expect(mergeData(once, once)).toEqual(once);
  });

  it("returns local data when the cloud has nothing yet", () => {
    expect(mergeData(local, null)).toBe(local);
    expect(mergeData(local, { ...remote, settings: null }).settings).toEqual(local.settings);
  });
});
