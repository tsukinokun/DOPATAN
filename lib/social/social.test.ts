import { describe, expect, it } from "vitest";
import { levelFromXp, rankFor, sessionXp, xpForLevel } from "@/lib/economy/rewards";
import { totalXp } from "@/lib/economy/ledger";
import type { Inbox } from "./api";
import { msUntilWeekEnd, zoneOf } from "./leagues";
import { displayName, randomName, validateNickname } from "./names";
import { rewardsFromInbox } from "./rewards";

describe("xp and levels", () => {
  it("computes session xp with the server cap", () => {
    expect(sessionXp({ correct: 40, wrong: 3, maxCombo: 20, feverCount: 2, newWords: 5 })).toBe(10 + 120 + 20 + 30);
    expect(sessionXp({ correct: 999, wrong: 0, maxCombo: 999, feverCount: 99, newWords: 0 })).toBe(600);
  });

  it("maps xp to levels and ranks consistently", () => {
    expect(levelFromXp(0)).toBe(1);
    for (const level of [1, 2, 5, 10, 33]) {
      expect(levelFromXp(xpForLevel(level))).toBe(level);
      expect(levelFromXp(xpForLevel(level + 1) - 1)).toBe(level);
    }
    expect(rankFor(1).title).toBe("見習い");
    expect(rankFor(10).title).toBe("ボキャ戦士");
    expect(rankFor(99).title).toBe("単語神");
  });

  it("estimates xp for sessions recorded before xp existed", () => {
    expect(
      totalXp({
        "session:old": { id: "session:old", at: 0, label: "", coins: 100 },
        "session:new": { id: "session:new", at: 0, label: "", coins: 100, xp: 200 },
        "login:x": { id: "login:x", at: 0, label: "", gems: 5 },
      }),
    ).toBe(340);
  });
});

describe("names", () => {
  it("gives everyone the same random name for a friend code", () => {
    expect(randomName("ABCD2345")).toBe(randomName("ABCD2345"));
    expect(randomName("ABCD2345")).toMatch(/#\d{4}$/);
    expect(displayName({ nickname: "たんご", friendCode: "X" })).toBe("たんご");
  });

  it("validates nicknames", () => {
    expect(validateNickname(" たんご王 ")).toEqual({ ok: true, value: "たんご王" });
    expect(validateNickname("a").ok).toBe(false);
    expect(validateNickname("あ".repeat(13)).ok).toBe(false);
    expect(validateNickname("運営です").ok).toBe(false);
    expect(validateNickname("<script>").ok).toBe(false);
  });
});

describe("leagues", () => {
  it("marks promotion and demotion zones like the server", () => {
    expect(zoneOf(1, 30, 0, 100)).toBe("promote");
    expect(zoneOf(8, 30, 0, 100)).toBeNull();
    expect(zoneOf(30, 30, 0, 100)).toBeNull();
    expect(zoneOf(30, 30, 3, 100)).toBe("demote");
    expect(zoneOf(1, 30, 9, 100)).toBeNull();
    expect(zoneOf(2, 30, 3, 0)).toBe("demote");
  });

  it("counts down to Monday midnight in Japan", () => {
    const sundayNight = Date.parse("2026-10-25T23:00:00+09:00");
    expect(msUntilWeekEnd(sundayNight)).toBe(60 * 60 * 1000);
    const mondayMorning = Date.parse("2026-10-26T00:00:00+09:00");
    expect(msUntilWeekEnd(mondayMorning)).toBe(7 * 24 * 60 * 60 * 1000);
  });
});

describe("rewardsFromInbox", () => {
  const inbox: Inbox = {
    today: "2026-10-20",
    cheersReceived: Array.from({ length: 7 }, (_, i) => ({
      from: `f${i}`,
      nickname: null,
      friendCode: `CODE000${i}`,
      day: "2026-10-20",
    })),
    cheersSent: [{ to: "f1", day: "2026-10-19" }],
    incomingRequests: [],
    outgoingRequests: [],
    leagueRewards: [
      { week: "2026-10-12", rank: 1, tier: 0, newTier: 1, gems: 50 },
      { week: "2026-10-05", rank: 20, tier: 0, newTier: 0, gems: 0 },
    ],
    invitedBy: { id: "inv", nickname: "招待マン", friendCode: "INVITE22" },
    referrals: [
      { invitee: "a", nickname: null, friendCode: "AAAA2222", unlocked: true },
      { invitee: "b", nickname: null, friendCode: "BBBB2222", unlocked: false },
    ],
  };

  it("turns server data into deterministic ledger events", () => {
    const events = rewardsFromInbox(inbox, 0);
    const ids = events.map((e) => e.id);
    expect(ids).toContain("league:2026-10-12");
    expect(ids).not.toContain("league:2026-10-05");
    expect(ids).toContain("invited:inv");
    expect(ids).toContain("invite:a");
    expect(ids).not.toContain("invite:b");
    expect(ids.filter((id) => id.startsWith("cheer-from:"))).toHaveLength(5);
    expect(ids).toContain("cheer-to:f1:2026-10-19");
    expect(rewardsFromInbox(inbox, 99).map((e) => e.id)).toEqual(ids);
  });
});
