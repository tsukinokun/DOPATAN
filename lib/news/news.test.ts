import { describe, expect, it } from "vitest";
import { APP_NEWS } from "./catalog";
import { eventNews, mergeNews, unreadCount, type News } from "./news";

const NOW = Date.parse("2026-11-04T12:00:00+09:00");
const n = (id: string, at: number, extra: Partial<News> = {}): News => ({ id, kind: "app", title: id, body: "", at, ...extra });

describe("news", () => {
  it("announces this week's event from the week start", () => {
    const e = eventNews(NOW);
    expect(e).toMatchObject({ id: "event-start:2026-11-02", kind: "event", link: "/event", at: Date.parse("2026-11-02T00:00:00+09:00") });
    expect(e.title).toContain("ビンゴ");
    expect(eventNews(Date.parse("2026-11-09T00:00:00+09:00")).title).toContain("ボスバトル");
  });

  it("merges, sorts newest first, drops duplicates, future and expired items", () => {
    const list = mergeNews(
      [
        [n("a", NOW - 3000), n("b", NOW - 1000)],
        [n("a", NOW - 9999), n("future", NOW + 1), n("old", NOW - 500, { expiresAt: NOW - 1 }), n("c", NOW - 2000)],
      ],
      NOW,
    );
    expect(list.map((x) => x.id)).toEqual(["b", "c", "a"]);
    expect(list.find((x) => x.id === "a")!.at).toBe(NOW - 3000);
  });

  it("counts unread items", () => {
    const list = [n("a", 1), n("b", 2), n("c", 3)];
    expect(unreadCount(list, ["b", "zzz"])).toBe(2);
  });

  it("has unique app news ids", () => {
    expect(new Set(APP_NEWS.map((x) => x.id)).size).toBe(APP_NEWS.length);
  });
});
