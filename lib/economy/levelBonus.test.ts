import { describe, expect, it } from "vitest";
import { applyLevelBonus } from "./levelBonus";

describe("level score bonus", () => {
  it("adds level × 1% to the score", () => {
    expect(applyLevelBonus(50, 1)).toEqual({ level: 1, percent: 1, points: 1, total: 51 });
    expect(applyLevelBonus(8000, 10)).toMatchObject({ percent: 10, points: 800, total: 8800 });
    expect(applyLevelBonus(8000, 12).total).toBe(8960);
  });

  it("gives nothing for a zero score and has no upper limit", () => {
    expect(applyLevelBonus(0, 30)).toMatchObject({ points: 0, total: 0 });
    expect(applyLevelBonus(1000, 200)).toMatchObject({ percent: 200, points: 2000, total: 3000 });
  });
});
