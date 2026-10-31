import { describe, expect, it } from "vitest";
import { dailyPushes, eventMessage, jstWeekday, type PushBatch } from "./daily";

const MON_7AM = Date.parse("2026-11-02T07:00:00+09:00"); // ビンゴの週の月曜
const SUN_7AM = Date.parse("2026-11-08T07:00:00+09:00");
const WED_7AM = Date.parse("2026-11-04T07:00:00+09:00");

const sub = (endpoint: string, userId: string | null = null) => ({ endpoint, p256dh: "k", auth: "a", userId });
const empty: PushBatch = { subscriptions: [], announcements: [], presents: [] };

describe("daily pushes", () => {
  it("uses the weekday in Japan", () => {
    expect(jstWeekday(Date.parse("2026-11-01T22:00:00Z"))).toBe(1); // 日本時間の月曜7時
    expect(jstWeekday(Date.parse("2026-11-01T14:59:00Z"))).toBe(0);
  });

  it("announces the event start on Monday and the last day on Sunday", () => {
    expect(eventMessage(MON_7AM)).toMatchObject({ title: expect.stringContaining("ビンゴ"), url: "/event", tag: "event-start:2026-11-02" });
    expect(eventMessage(SUN_7AM)).toMatchObject({ title: expect.stringContaining("今日まで"), tag: "event-end:2026-11-02" });
    expect(eventMessage(WED_7AM)).toBeNull();
  });

  it("sends nothing on a quiet day", () => {
    expect(dailyPushes(WED_7AM, { ...empty, subscriptions: [sub("https://x/1")] })).toEqual([]);
  });

  it("sends personal presents only to that person's devices, and one message per device", () => {
    const batch: PushBatch = {
      subscriptions: [sub("https://x/guest"), sub("https://x/alice", "alice"), sub("https://x/bob", "bob")],
      announcements: [{ id: "n1", title: "メンテのお知らせ", body: "明日 3:00〜", link: null }],
      presents: [
        { id: "p1", title: "補填", userId: "alice" },
        { id: "p2", title: "みんなへ", userId: null },
      ],
    };
    const out = dailyPushes(MON_7AM, batch);
    expect(out).toHaveLength(3);
    const by = Object.fromEntries(out.map((o) => [o.subscription.endpoint, o.message]));
    expect(by["https://x/alice"].title).toBe("DOPATAN からのお知らせが4件あります");
    expect(by["https://x/guest"].title).toBe("DOPATAN からのお知らせが3件あります");
    expect(by["https://x/bob"].body).not.toContain("補填");
    expect(by["https://x/alice"].url).toBe("/event");
  });

  it("sends a single item as it is", () => {
    const out = dailyPushes(WED_7AM, {
      ...empty,
      subscriptions: [sub("https://x/1")],
      announcements: [{ id: "n1", title: "アップデート", body: "新しいスキン", link: "/gacha" }],
    });
    expect(out[0].message).toEqual({ title: "📢 アップデート", body: "新しいスキン", url: "/gacha", tag: "news:n1" });
  });
});
