import { describe, expect, it } from "vitest";
import { seededRng } from "@/lib/random";
import { DEFAULT_SKINS } from "@/lib/skins";
import { GACHAS, rollGacha, skinRates } from "./gacha";
import { balance, mergeLedgers, ownedSkins, type Ledger } from "./ledger";
import {
  ACHIEVEMENTS,
  currentStreak,
  dateKey,
  EMPTY_DAILY,
  loginBonusGems,
  longestStreak,
  mergeDaily,
  missionsFor,
  pendingRewards,
  recentDays,
  sessionCoins,
} from "./rewards";

describe("ledger", () => {
  const ledger: Ledger = {
    "session:a": { id: "session:a", at: 1, label: "", coins: 120 },
    "gacha:b": { id: "gacha:b", at: 2, label: "", coins: -100 },
    "gacha:b:0": { id: "gacha:b:0", at: 2, label: "", skin: "bg-mint" },
    "login:2026-10-22": { id: "login:2026-10-22", at: 3, label: "", gems: 5 },
  };

  it("derives balances and owned skins", () => {
    expect(balance(ledger)).toEqual({ coins: 20, gems: 5 });
    const owned = ownedSkins(ledger);
    expect(owned.has("bg-mint")).toBe(true);
    for (const id of Object.values(DEFAULT_SKINS)) expect(owned.has(id)).toBe(true);
  });

  it("merges by id so the same reward is never counted twice", () => {
    const other: Ledger = {
      "login:2026-10-22": { id: "login:2026-10-22", at: 9, label: "", gems: 5 },
      "session:c": { id: "session:c", at: 9, label: "", coins: 80 },
    };
    const merged = mergeLedgers(ledger, other);
    expect(balance(merged)).toEqual({ coins: 100, gems: 5 });
    expect(mergeLedgers(merged, other)).toEqual(merged);
    expect(mergeLedgers(merged, ledger)).toEqual(merged);
  });
});

describe("gacha", () => {
  it("lists rates that add up to 100%", () => {
    for (const kind of ["normal", "rare"] as const) {
      const total = skinRates(kind).reduce((sum, r) => sum + r.rate, 0);
      expect(total).toBeCloseTo(1);
    }
  });

  it("roughly follows the published rates", () => {
    const rng = seededRng(7);
    const counts: Record<string, number> = {};
    for (let i = 0; i < 20000; i++) {
      const [r] = rollGacha("rare", 1, new Set(), rng);
      counts[r.skin.rarity] = (counts[r.skin.rarity] ?? 0) + 1;
    }
    expect(counts.SSR / 20000).toBeCloseTo(GACHAS.rare.rates.SSR!, 1);
    expect(counts.R / 20000).toBeCloseTo(GACHAS.rare.rates.R!, 1);
    expect(counts.N).toBeUndefined();
  });

  it("guarantees SR or better in a 10-pull", () => {
    for (let seed = 0; seed < 300; seed++) {
      const results = rollGacha("normal", 10, new Set(), seededRng(seed));
      expect(results).toHaveLength(10);
      expect(results.some((r) => r.skin.rarity === "SR" || r.skin.rarity === "SSR")).toBe(true);
    }
  });

  it("refunds duplicates, including ones drawn earlier in the same 10-pull", () => {
    const results = rollGacha("normal", 10, new Set(), seededRng(3));
    const seen = new Set<string>();
    for (const r of results) {
      expect(r.duplicate).toBe(seen.has(r.skin.id));
      expect(r.refund.coins ?? 0).toBe(r.duplicate ? 20 : 0);
      seen.add(r.skin.id);
    }
    expect(results.some((r) => r.duplicate)).toBe(true);
  });

  it("never gives default skins", () => {
    const defaults = new Set(Object.values(DEFAULT_SKINS));
    for (const { skin } of [...skinRates("normal"), ...skinRates("rare")]) expect(defaults.has(skin.id)).toBe(false);
  });
});

describe("rewards", () => {
  it("computes session coins", () => {
    expect(sessionCoins({ correct: 30, wrong: 2, maxCombo: 15, feverCount: 2, newWords: 4 })).toBe(10 + 60 + 15 + 20);
  });

  it("picks three stable missions per day", () => {
    const a = missionsFor("2026-10-22");
    expect(a).toHaveLength(3);
    expect(new Set(a.map((m) => m.id)).size).toBe(3);
    expect(missionsFor("2026-10-22").map((m) => m.id)).toEqual(a.map((m) => m.id));
  });

  it("counts streaks across month boundaries", () => {
    const dates = ["2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02", "2026-10-05"];
    expect(currentStreak(dates, "2026-10-02")).toBe(4);
    expect(currentStreak(dates, "2026-10-05")).toBe(1);
    expect(currentStreak(dates, "2026-10-06")).toBe(0);
    expect(longestStreak(dates)).toBe(4);
    expect(dateKey(new Date(2026, 0, 5, 23, 59).getTime())).toBe("2026-01-05");
  });

  it("gives bigger login bonuses on the 7th and 30th day", () => {
    expect(loginBonusGems(1)).toBe(5);
    expect(loginBonusGems(7)).toBe(25);
    expect(loginBonusGems(30)).toBe(105);
  });

  it("merges daily stats by taking the larger value", () => {
    const merged = mergeDaily(
      { d: { ...EMPTY_DAILY, sessions: 2, maxCombo: 5 } },
      { d: { ...EMPTY_DAILY, sessions: 1, maxCombo: 9 }, e: EMPTY_DAILY },
    );
    expect(merged.d.sessions).toBe(2);
    expect(merged.d.maxCombo).toBe(9);
    expect(merged.e).toEqual(EMPTY_DAILY);
  });

  it("grants missions, achievements and mastery only once", () => {
    const today = "2026-10-22";
    const daily = { sessions: 9, correct: 999, maxCombo: 99, newWords: 99, fevers: 9, bestAccuracy: 100 };
    const args = {
      ledger: {} as Ledger,
      today,
      daily,
      achievement: { sessions: 1, bestCombo: 25, bestScore: 0, mastered: 1, bestStreak: 1, fevers: 0 },
      masteredWords: [{ id: "issue-1", word: "issue" }],
      now: 0,
    };
    const first = pendingRewards(args);
    const ids = first.map((e) => e.id);
    expect(ids).toContain(`mission:${today}:all`);
    expect(ids).toContain("ach:first");
    expect(ids).toContain("ach:combo20");
    expect(ids).not.toContain("ach:combo50");
    expect(ids).toContain("master:issue-1");
    expect(first.filter((e) => e.id.startsWith(`mission:${today}:`))).toHaveLength(4);

    const ledger = Object.fromEntries(first.map((e) => [e.id, e]));
    expect(pendingRewards({ ...args, ledger })).toEqual([]);
  });

  it("has unique achievement ids", () => {
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
  });
});

describe("recentDays", () => {
  it("lists the last 30 days oldest first and fills days without play with zero", () => {
    const daily = {
      "2026-10-22": { ...EMPTY_DAILY, sessions: 2, correct: 40 },
      "2026-10-01": { ...EMPTY_DAILY, sessions: 1, correct: 7 },
      "2026-09-01": { ...EMPTY_DAILY, sessions: 9, correct: 99 },
    };
    const days = recentDays(daily, "2026-10-22");
    expect(days).toHaveLength(30);
    expect(days[0]).toEqual({ date: "2026-09-23", sessions: 0, correct: 0 });
    expect(days[29]).toEqual({ date: "2026-10-22", sessions: 2, correct: 40 });
    expect(days.find((d) => d.date === "2026-10-01")?.correct).toBe(7);
    expect(days.reduce((sum, d) => sum + d.correct, 0)).toBe(47);
  });
});
