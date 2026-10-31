import { describe, expect, it } from "vitest";
import { fillSteps } from "./fill";

describe("fillSteps", () => {
  it("fills within one level", () => {
    expect(fillSteps({ level: 2, ratio: 0.25 }, { level: 2, ratio: 0.75 })).toEqual([{ level: 2, from: 0.25, to: 0.75 }]);
  });

  it("fills to the top, then continues on the next level", () => {
    expect(fillSteps({ level: 2, ratio: 0.5 }, { level: 3, ratio: 0.25 })).toEqual([
      { level: 2, from: 0.5, to: 1 },
      { level: 3, from: 0, to: 0.25 },
    ]);
  });

  it("passes through every level in between", () => {
    expect(fillSteps({ level: 1, ratio: 0.9 }, { level: 4, ratio: 0.1 })).toEqual([
      { level: 1, from: 0.9, to: 1 },
      { level: 2, from: 0, to: 1 },
      { level: 3, from: 0, to: 1 },
      { level: 4, from: 0, to: 0.1 },
    ]);
  });

  it("stops full when reaching the max level", () => {
    expect(fillSteps({ level: 4, ratio: 0.75 }, { level: 5, ratio: 1 })).toEqual([
      { level: 4, from: 0.75, to: 1 },
      { level: 5, from: 0, to: 1 },
    ]);
    expect(fillSteps({ level: 5, ratio: 1 }, { level: 5, ratio: 1 })).toEqual([{ level: 5, from: 1, to: 1 }]);
  });
});
