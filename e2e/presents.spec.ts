import { expect, test, type Page } from "@playwright/test";

/** 前の画面は非表示のまま残る(cacheComponents)ので、見えている残高だけを見る */
const gems = (page: Page) => page.locator('[data-testid="gems"]:visible');

/** 今日のログインボーナスは受け取り済みにして、モーダルを出さない */
async function seedWallet(page: Page) {
  await page.addInitScript(() => {
    if (localStorage.getItem("dopatan-wallet")) return;
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    localStorage.setItem(
      "dopatan-wallet",
      JSON.stringify({
        state: {
          ledger: { [`login:${key}`]: { id: `login:${key}`, at: 0, label: "", gems: 0 } },
          daily: {},
          loginDates: [key],
          equipped: { background: undefined, effect: undefined, sound: undefined },
          lastRewards: [],
        },
        version: 0,
      }),
    );
  });
}

test("the thank-you present can be received once from the present box", async ({ page }) => {
  await seedWallet(page);
  await page.goto("/");
  await expect(page.getByTestId("presents-badge")).toHaveText("1");
  await page.getByTestId("open-presents").click();
  await expect(page).toHaveURL(/\/presents$/);

  await expect(page.getByTestId("present-app-thanks-2026-11")).toContainText("ありがとう");
  await page.getByTestId("present-receive-thanks-2026-11").click();
  await expect(page.getByTestId("present-received-dialog")).toContainText("💎+100");
  await page.getByTestId("present-received-close").click();
  await expect(page.getByTestId("present-received-dialog")).toHaveCount(0);
  await expect(gems(page)).toHaveText("100");
  await expect(page.getByText("プレゼントはありません")).toBeVisible();

  await page.getByTestId("presents-tab-received").click();
  await expect(page.getByTestId("presents-history")).toContainText("いつも遊んでくれてありがとう");

  // 再読み込みしても、もう一度は受け取れない
  await page.reload();
  await expect(page.getByTestId("present-app-thanks-2026-11")).toHaveCount(0);
  await page.goto("/");
  await expect(page.getByTestId("presents-badge")).toHaveCount(0);
  await expect(gems(page)).toHaveText("100");
});

test("receive all takes every present at once", async ({ page }) => {
  await seedWallet(page);
  await page.goto("/presents");
  await page.getByTestId("presents-receive-all").click();
  await expect(page.getByTestId("present-received-dialog")).toBeVisible();
  await page.getByTestId("present-received-close").click();
  await expect(page.getByTestId("presents-receive-all")).toBeDisabled();
  await expect(gems(page)).toHaveText("100");
});
