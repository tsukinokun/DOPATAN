import { describe, expect, it } from "vitest";
import { mergeLedgers, skinCopies, type Ledger } from "@/lib/economy/ledger";
import { presentFromRow } from "@/lib/social/api";
import { APP_PRESENTS } from "./catalog";
import { expiryLabel, isUrgent, pendingPresents, presentEvent, presentEventId, receivedPresents, type Present } from "./presents";

const HOUR = 3600_000;
const DAY = 24 * HOUR;
const NOW = Date.parse("2026-11-10T12:00:00+09:00");

const p = (id: string, extra: Partial<Present> = {}): Present => ({ id, source: "server", title: id, gems: 10, ...extra });

describe("pendingPresents", () => {
  it("drops received, not-yet-started and expired presents", () => {
    const ledger: Ledger = { [presentEventId(p("got"))]: { id: presentEventId(p("got")), at: 1, label: "" } };
    const list = [
      p("got"),
      p("future", { startsAt: NOW + HOUR }),
      p("expired", { expiresAt: NOW - 1 }),
      p("ok", { startsAt: NOW - HOUR, expiresAt: NOW + DAY }),
      p("forever", { expiresAt: null }),
    ];
    expect(pendingPresents(list, ledger, NOW).map((x) => x.id)).toEqual(["ok", "forever"]);
  });

  it("puts the soonest deadline first, then the newest", () => {
    const list = [
      p("old", { startsAt: NOW - 3 * DAY }),
      p("late", { expiresAt: NOW + 5 * DAY }),
      p("new", { startsAt: NOW - DAY }),
      p("soon", { expiresAt: NOW + DAY }),
    ];
    expect(pendingPresents(list, {}, NOW).map((x) => x.id)).toEqual(["soon", "late", "new", "old"]);
  });

  it("keeps app and server presents with the same id apart", () => {
    const app = { ...p("same"), source: "app" as const };
    const server = p("same");
    const ledger: Ledger = { [presentEventId(app)]: presentEvent(app, 1) };
    expect(pendingPresents([app, server], ledger, NOW)).toEqual([server]);
  });

  it("offers the thank-you present to everyone right now", () => {
    expect(pendingPresents(APP_PRESENTS, {}, NOW).map((x) => x.id)).toContain("thanks-2026-11");
    expect(new Set(APP_PRESENTS.map((x) => x.id)).size).toBe(APP_PRESENTS.length);
  });
});

describe("presentEvent", () => {
  it("puts the contents in the ledger, once", () => {
    const e = presentEvent(p("x", { title: "補填", coins: 100, gems: 50, xp: 30, skin: "bg-gold" }), NOW);
    expect(e).toEqual({ id: "present:server:x", at: NOW, label: "プレゼント:補填", coins: 100, gems: 50, xp: 30, skin: "bg-gold" });
    // 同じプレゼントを別の端末で受け取っても、台帳を重ねると1回分になる
    const a: Ledger = { [e.id]: e };
    const b: Ledger = { [e.id]: { ...e, at: NOW + 5 } };
    const merged = mergeLedgers(a, b);
    expect(Object.keys(merged)).toEqual([e.id]);
    expect(skinCopies(merged).get("bg-gold")).toBe(1);
  });

  it("skips unknown skins and empty amounts", () => {
    expect(presentEvent(p("x", { gems: 0, skin: "no-such-skin" }), NOW)).toEqual({
      id: "present:server:x",
      at: NOW,
      label: "プレゼント:x",
    });
  });
});

describe("receivedPresents", () => {
  it("lists received presents, newest first", () => {
    const ledger: Ledger = {
      "present:app:a": { id: "present:app:a", at: 1, label: "プレゼント:a" },
      "session:z": { id: "session:z", at: 5, label: "プレイ報酬" },
      "present:server:b": { id: "present:server:b", at: 3, label: "プレゼント:b" },
    };
    expect(receivedPresents(ledger).map((e) => e.id)).toEqual(["present:server:b", "present:app:a"]);
  });
});

describe("expiryLabel", () => {
  it("shows hours, days or a date", () => {
    expect(expiryLabel(null, NOW)).toBeNull();
    expect(expiryLabel(undefined, NOW)).toBeNull();
    expect(expiryLabel(NOW + 5 * HOUR, NOW)).toBe("あと5時間");
    expect(expiryLabel(NOW + 10 * 60_000, NOW)).toBe("あと1時間");
    expect(expiryLabel(NOW + 3 * DAY, NOW)).toBe("あと3日");
    expect(expiryLabel(Date.parse("2026-11-30T23:59:00+09:00"), NOW)).toMatch(/^11\/(30|29)まで$/);
    expect(isUrgent(NOW + 2 * DAY, NOW)).toBe(true);
    expect(isUrgent(NOW + 4 * DAY, NOW)).toBe(false);
  });
});

describe("presentFromRow", () => {
  it("turns a server row into a present", () => {
    expect(
      presentFromRow({
        id: "u1",
        title: "補填",
        message: null,
        coins: 0,
        gems: 50,
        xp: 0,
        skin: null,
        startsAt: "2026-11-01T00:00:00Z",
        expiresAt: null,
      }),
    ).toEqual({
      id: "u1",
      source: "server",
      title: "補填",
      message: undefined,
      coins: undefined,
      gems: 50,
      xp: undefined,
      skin: undefined,
      startsAt: Date.parse("2026-11-01T00:00:00Z"),
      expiresAt: null,
    });
  });
});
