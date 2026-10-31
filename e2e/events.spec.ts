import { expect, test, type Page } from "@playwright/test";

/** ウォレットを用意する。plays を渡すと、今週の調子のいいプレイをその回数だけ入れておく */
async function seed(page: Page, opts: { plays?: number; extra?: Record<string, unknown> } = {}) {
  await page.addInitScript(({ plays, extra }) => {
    if (localStorage.getItem("dopatan-wallet")) return;
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const ledger: Record<string, unknown> = { [`login:${key}`]: { id: `login:${key}`, at: 0, label: "", gems: 0 }, ...extra };
    for (let i = 0; i < plays; i++) {
      const id = `session:seed-${i}`;
      ledger[id] = {
        id,
        at: Date.now() - (plays - i) * 1000,
        label: "プレイ報酬",
        coins: 10,
        xp: 10,
        stats: { score: 16000, correct: 31, wrong: 1, maxCombo: 36, fevers: 3, newWords: 0 },
      };
    }
    localStorage.setItem(
      "dopatan-wallet",
      JSON.stringify({
        state: { ledger, daily: {}, loginDates: [key], equipped: {}, lastRewards: [] },
        version: 0,
      }),
    );
  }, { plays: opts.plays ?? 0, extra: opts.extra ?? {} });
}

test("the home banner opens this week's event", async ({ page }) => {
  await seed(page);
  await page.goto("/");
  await expect(page.getByTestId("event-banner")).toBeVisible();
  await page.getByTestId("event-banner").click();
  await expect(page).toHaveURL(/\/event$/);
  await expect(page.getByTestId("event-title")).toBeVisible();
  await expect(page.getByTestId("event-milestones").locator("li")).not.toHaveCount(0);
});

test("finishing the event sends its rewards to the present box", async ({ page }) => {
  await seed(page, { plays: 30 });
  await page.goto("/event");
  // 30回の調子のいいプレイなら、どのイベントでも完走している
  await expect(page.getByTestId("event-milestones")).not.toContainText("⬜");
  await page.goto("/");
  const badge = Number(await page.getByTestId("presents-badge").textContent());
  expect(badge).toBeGreaterThan(5);

  await page.goto("/presents");
  await page.getByTestId("presents-receive-all").click();
  await expect(page.getByTestId("present-received-dialog")).toBeVisible();
  await page.getByTestId("present-received-close").click();
  await page.goto("/collection");
  await expect(page.getByTestId("tickets")).toContainText("チケット");
});

test("a skill ticket adds a copy of an owned skin", async ({ page }) => {
  await seed(page, {
    extra: {
      own: { id: "own", at: 1, label: "", skin: "bg-space" },
      tk: { id: "tk", at: 2, label: "", tickets: { SR: 1 } },
    },
  });
  await page.goto("/collection");
  await expect(page.getByTestId("ticket-SR")).toHaveText("SRチケット ×1");
  const card = page.getByTestId("skin-bg-space");
  await expect(card.getByTestId("level-badge")).toHaveText("Lv.1");
  await card.getByTestId("ticket-open-bg-space").click();
  await page.getByTestId("ticket-use-SR").click();
  await expect(card.getByTestId("level-badge")).toHaveText("Lv.2");
  await expect(page.getByTestId("ticket-SR")).toHaveCount(0);
  await expect(card.getByTestId("ticket-open-bg-space")).toHaveCount(0);
});
