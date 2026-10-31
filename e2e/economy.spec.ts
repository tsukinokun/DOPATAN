import { expect, test, type Page } from "@playwright/test";

/** コインとジェムを持った状態のウォレットを先に保存しておく */
async function seedWallet(page: Page, extra: Record<string, unknown> = {}) {
  await page.addInitScript((extraEvents) => {
    const today = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const key = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
    const ledger = {
      seed: { id: "seed", at: 0, label: "テスト", coins: 5000, gems: 1000 },
      // 今日のログインボーナスは受け取り済みにして、モーダルを出さない
      [`login:${key}`]: { id: `login:${key}`, at: 0, label: "", gems: 0 },
      ...extraEvents,
    };
    if (!localStorage.getItem("dopatan-wallet")) {
      localStorage.setItem(
        "dopatan-wallet",
        JSON.stringify({
          state: {
            ledger,
            daily: {},
            loginDates: [key],
            equipped: { background: undefined, effect: undefined, sound: undefined },
            lastRewards: [],
          },
          version: 0,
        }),
      );
    }
  }, extra);
}

test("the first visit of the day gives a login bonus", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("login-bonus")).toBeVisible();
  await page.getByTestId("login-bonus-receive").click();
  await expect(page.getByTestId("login-bonus")).toHaveCount(0);
  await expect(page.getByTestId("gems")).toHaveText("5");
  await page.reload();
  await expect(page.getByTestId("play")).toBeVisible();
  await expect(page.getByTestId("login-bonus")).toHaveCount(0);
});

test("finishing a session pays coins and shows rewards", async ({ page }) => {
  await page.clock.install();
  await page.goto("/");
  await page.getByTestId("login-bonus-receive").click();
  await expect(page.getByTestId("login-bonus")).toHaveCount(0);
  await page.getByTestId("play").click({ force: true });
  await expect(page.getByTestId("drag-source")).toBeVisible({ timeout: 10_000 });
  await page.clock.fastForward("03:01");
  await expect(page).toHaveURL(/\/result$/, { timeout: 10_000 });
  await expect(page.getByTestId("reward-total")).toContainText("🪙+10");
  await expect(page.getByText("実績解除:はじめの一歩")).toBeVisible();
  await page.goto("/");
  await expect(page.getByTestId("coins")).toHaveText("10");
});

test("a gacha pull spends coins and adds a skin", async ({ page }) => {
  await seedWallet(page);
  await page.goto("/gacha");
  await page.getByTestId("gacha-pull-10").click();
  await expect(page.getByTestId("gacha-overlay")).toBeVisible();
  // タップで演出を飛ばす
  await page.getByTestId("gacha-overlay").click({ position: { x: 5, y: 5 } });
  await expect(page.getByTestId("gacha-results").locator("[data-testid^=skin-]")).toHaveCount(10);
  await page.getByTestId("gacha-close").click();
  const coins = Number((await page.getByTestId("coins").textContent())!.replace(/,/g, ""));
  expect(coins).toBeLessThanOrEqual(5000 - 900 + 9 * 20);
  expect(coins).toBeGreaterThanOrEqual(5000 - 900);
  await page.goto("/collection");
  await expect(page.getByText(/^\d+ \/ 39 種類を集めた$/)).not.toHaveText("3 / 39 種類を集めた");
});

test("equipping a background changes the page background", async ({ page }) => {
  await seedWallet(page, { owned: { id: "owned", at: 0, label: "", skin: "bg-space" } });
  await page.goto("/collection");
  await expect(page.locator("html")).toHaveAttribute("data-background", "bg-default");
  await page.getByTestId("equip-bg-space").click();
  await expect(page.locator("html")).toHaveAttribute("data-background", "bg-space");
  const from = await page.evaluate(() => document.documentElement.style.getPropertyValue("--bg-from"));
  expect(from).toBe("#000428");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-background", "bg-space");
});

test("duplicates level up a skin and equipped perks are summed", async ({ page }) => {
  // bg-gold を3枚(Lv.2)持っている状態
  await seedWallet(page, {
    g1: { id: "g1", at: 0, label: "", skin: "bg-gold" },
    g2: { id: "g2", at: 0, label: "", skin: "bg-gold" },
    g3: { id: "g3", at: 0, label: "", skin: "bg-gold" },
  });
  await page.goto("/collection");
  const card = page.getByTestId("skin-bg-gold");
  await expect(card.getByTestId("level-badge")).toHaveText("Lv.2");
  await expect(card.getByTestId("perk-text")).toHaveText("🪙 コイン +18%");
  await expect(card).toContainText("あと1枚で Lv.3");
  await expect(page.getByTestId("equipped-perks")).toContainText("🪙 コイン +0%");
  await page.getByTestId("equip-bg-gold").click();
  await expect(page.getByTestId("equipped-perks")).toContainText("🪙 コイン +18%");
});
