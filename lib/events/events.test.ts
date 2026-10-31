import { describe, expect, it } from "vitest";
import { skinRates } from "@/lib/economy/gacha";
import { ticketBalance, type Ledger, type LedgerEvent, type PlayStats } from "@/lib/economy/ledger";
import { MISSIONS } from "@/lib/economy/rewards";
import { ticketFits, usableTickets } from "@/lib/economy/tickets";
import { getSkin, SKINS } from "@/lib/skins";
import { ANCHOR_MISSION, bingo, cardFor, CELLS, completedLines, SINGLE_MISSIONS, TOTAL_MISSIONS } from "./bingo";
import { boss, bossAt, TOTAL_HP } from "./boss";
import { eventAt, eventPresents, EVENTS, playsOfWeek, simulate } from "./index";
import { stamp, stampsOf } from "./stamp";
import { BOARD, diceCount, sugoroku } from "./sugoroku";
import { runEvent, type EventId, type Play } from "./types";
import { eventForWeek, timeLeftLabel, weekKey, weekStart } from "./week";

const WEEK = "2026-11-02";
const START = Date.parse("2026-11-02T00:00:00+09:00");

const TYPICAL: PlayStats = { score: 9000, correct: 22, wrong: 3, maxCombo: 14, fevers: 1, newWords: 0 };
const GREAT: PlayStats = { score: 16000, correct: 31, wrong: 1, maxCombo: 36, fevers: 3, newWords: 0 };

/** ふつうのプレイ4回に1回、調子のいいプレイが混ざる(新しい単語は0のまま) */
function plays(n: number, base = START): Play[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `session:test-${i}`,
    at: base + i * 60_000,
    stats: i % 5 === 4 ? GREAT : TYPICAL,
  }));
}

const finished = (id: EventId, n: number) => {
  const rules = EVENTS[id];
  const final = rules.milestones(WEEK).find((m) => m.final)!.id;
  return simulate(id, plays(n), WEEK).run.reached.includes(final);
};

describe("week", () => {
  it("switches on Monday 0:00 in Japan", () => {
    expect(weekKey(weekStart(Date.parse("2026-11-01T23:59:59+09:00")))).toBe("2026-10-26");
    expect(weekKey(weekStart(Date.parse("2026-11-02T00:00:00+09:00")))).toBe("2026-11-02");
    expect(weekKey(weekStart(Date.parse("2026-11-04T15:00:00Z")))).toBe("2026-11-02");
  });

  it("rotates the four events in order", () => {
    const at = (d: string) => eventForWeek(weekStart(Date.parse(`${d}T12:00:00+09:00`)));
    expect(["2026-10-26", "2026-11-02", "2026-11-09", "2026-11-16", "2026-11-23"].map(at)).toEqual([
      "sugoroku",
      "bingo",
      "boss",
      "stamp",
      "sugoroku",
    ]);
    expect(at("2026-10-19")).toBe("stamp");
  });

  it("labels the time left", () => {
    expect(timeLeftLabel(START + 5 * 3600_000, START)).toBe("あと5時間");
    expect(timeLeftLabel(START + 3 * 86400_000, START)).toBe("あと3日");
  });
});

describe("difficulty", () => {
  for (const id of Object.keys(EVENTS) as EventId[]) {
    it(`${id}: about 35 plays finish it, 15 do not`, () => {
      expect(finished(id, 35)).toBe(true);
      expect(finished(id, 15)).toBe(false);
    });

    it(`${id}: the same plays always give the same result`, () => {
      expect(simulate(id, plays(20), WEEK)).toEqual(simulate(id, plays(20), WEEK));
    });

    it(`${id}: milestones have unique ids, one final reward with the limited skin`, () => {
      const ms = EVENTS[id].milestones(WEEK);
      expect(new Set(ms.map((m) => m.id)).size).toBe(ms.length);
      const finals = ms.filter((m) => m.final);
      expect(finals).toHaveLength(1);
      expect(finals[0].reward.skin).toBe(EVENTS[id].limitedSkin);
      expect(getSkin(EVENTS[id].limitedSkin)?.limited).toBe(true);
    });
  }
});

describe("sugoroku", () => {
  it("rolls more dice for great plays", () => {
    expect(diceCount(22, 1)).toBe(1);
    expect(diceCount(30, 1)).toBe(2);
    expect(diceCount(31, 2)).toBe(3);
  });

  it("moves by the dice and stops at the goal", () => {
    const run = runEvent(sugoroku, plays(60), WEEK);
    expect(run.state.position).toBe(BOARD);
    for (const d of run.details) {
      expect(d.landed).toBe(Math.min(BOARD, d.from + d.dice.reduce((a, b) => a + b, 0)));
      expect(d.dice.every((x) => x >= 1 && x <= 6)).toBe(true);
    }
  });
});

describe("bingo", () => {
  it("builds the same 16-cell card for everyone each week, always with the 30-plays cell", () => {
    const card = cardFor(WEEK);
    expect(card).toHaveLength(CELLS);
    expect(new Set(card.map((m) => m.id)).size).toBe(CELLS);
    expect(card.map((m) => m.id)).toContain(ANCHOR_MISSION.id);
    expect(cardFor(WEEK)).toEqual(card);
    expect(cardFor("2026-11-30").map((m) => m.id)).not.toEqual(card.map((m) => m.id));
  });

  it("never uses missions that can get stuck (new words etc.)", () => {
    // 新しい単語の数を変えても、どのお題の結果も変わらない
    const withNew = { ...GREAT, newWords: 999 };
    for (const m of SINGLE_MISSIONS) expect(m.single!(withNew)).toBe(m.single!(GREAT));
    for (const m of [...TOTAL_MISSIONS, ANCHOR_MISSION]) {
      expect(m.single).toBeUndefined();
      expect(m.label).not.toMatch(/新しい|マスター|リスニング|つづり/);
    }
    for (const m of SINGLE_MISSIONS) expect(m.label).not.toMatch(/新しい|マスター|リスニング|つづり/);
  });

  it("counts lines and opens cells", () => {
    const opened = Array(CELLS).fill(false);
    [0, 1, 2, 3].forEach((i) => (opened[i] = true));
    expect(completedLines(opened)).toEqual([0]);
    const run = runEvent(bingo, plays(35), WEEK);
    expect(run.state.opened.every(Boolean)).toBe(true);
    expect(completedLines(run.state.opened)).toHaveLength(10);
  });
});

describe("boss", () => {
  it("finds the current boss from the total damage", () => {
    expect(bossAt(0)).toEqual({ index: 0, hpLeft: 1000, hp: 1000 });
    expect(bossAt(1500)).toEqual({ index: 1, hpLeft: 1300, hp: 1800 });
    expect(bossAt(TOTAL_HP).index).toBe(5);
    const run = runEvent(boss, plays(3), WEEK);
    expect(run.state.damage).toBe(3 * (22 * 10 + 14 * 5 + 100));
    expect(run.reached).toEqual(["b1half", "b1down"]);
  });
});

describe("stamp", () => {
  it("gives extra stamps for a good score and accuracy", () => {
    expect(stampsOf(TYPICAL)).toBe(2);
    expect(stampsOf(GREAT)).toBe(3);
    expect(stampsOf({ ...TYPICAL, score: 100, correct: 3, wrong: 0 })).toBe(1);
    expect(runEvent(stamp, plays(5), WEEK).reached).toEqual(["s5", "s10"]);
  });
});

describe("plays and presents", () => {
  const session = (id: string, at: number, stats?: PlayStats): LedgerEvent => ({ id, at, label: "", coins: 10, stats });

  it("only counts this week's plays that have stats", () => {
    const ledger: Ledger = Object.fromEntries(
      [
        session("session:last", START - 1, TYPICAL),
        session("session:old", START + 10),
        session("session:b", START + 5, TYPICAL),
        session("session:a", START + 5, TYPICAL),
        session("session:next", START + 7 * 86400_000, TYPICAL),
      ].map((e) => [e.id, e]),
    );
    expect(playsOfWeek(ledger, START).map((p) => p.id)).toEqual(["session:a", "session:b"]);
  });

  it("turns reached rewards into presents that expire a week after the event", () => {
    const ledger: Ledger = Object.fromEntries(plays(5).map((p) => [p.id, session(p.id, p.at, p.stats)]));
    const now = START + 3600_000;
    expect(eventAt(now).id).toBe("bingo");
    const presents = eventPresents(ledger, now, "stamp");
    expect(presents.map((p) => p.id)).toEqual([`${WEEK}:s5`, `${WEEK}:s10`]);
    expect(presents[0]).toMatchObject({ source: "event", coins: 200, startsAt: START, expiresAt: START + 14 * 86400_000 });

    // 先週の報酬も、翌週のプレゼントボックスに期限まで残る
    const thisWeek = eventPresents(ledger, now).map((p) => p.id);
    expect(thisWeek.length).toBeGreaterThan(0);
    const nextWeek = START + 7 * 86400_000 + 3600_000;
    expect(eventPresents(ledger, nextWeek).map((p) => p.id)).toEqual(expect.arrayContaining(thisWeek));
    // 2週間前の分はもう作らない
    expect(eventPresents(ledger, START + 14 * 86400_000 + 3600_000)).toEqual([]);
  });
});

describe("tickets", () => {
  it("sums tickets from the ledger and checks which skins they fit", () => {
    const ledger: Ledger = {
      a: { id: "a", at: 1, label: "", tickets: { SR: 2, ANY: 1 } },
      b: { id: "b", at: 2, label: "", tickets: { SR: -1 }, skin: "bg-space" },
    };
    expect(ticketBalance(ledger)).toEqual({ N: 0, R: 0, SR: 1, SSR: 0, ANY: 1 });
    const sr = getSkin("bg-space")!;
    const n = getSkin("bg-mint")!;
    expect(ticketFits("SR", sr)).toBe(true);
    expect(ticketFits("SR", n)).toBe(false);
    expect(ticketFits("ANY", n)).toBe(true);
    expect(usableTickets(ticketBalance(ledger), sr)).toEqual(["SR", "ANY"]);
    expect(usableTickets(ticketBalance(ledger), n)).toEqual(["ANY"]);
  });
});

describe("limited skins and missions", () => {
  it("keeps limited skins out of the gacha", () => {
    const limited = SKINS.filter((s) => s.limited).map((s) => s.id);
    expect(limited).toHaveLength(4);
    for (const kind of ["normal", "rare"] as const) {
      for (const { skin } of skinRates(kind)) expect(limited).not.toContain(skin.id);
    }
  });

  it("has no daily mission that can get stuck", () => {
    expect(MISSIONS.map((m) => m.id)).not.toContain("new5");
  });
});
