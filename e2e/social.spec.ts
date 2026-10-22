import { expect, test } from "@playwright/test";

/** 今日のログインボーナスは受け取り済み・XP を少し持った状態にしておく */
async function seed(page: import("@playwright/test").Page, xp: number) {
  await page.addInitScript((xpValue) => {
    if (localStorage.getItem("dopatan-wallet")) return;
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    localStorage.setItem(
      "dopatan-wallet",
      JSON.stringify({
        state: {
          ledger: {
            [`login:${key}`]: { id: `login:${key}`, at: 0, label: "", gems: 0 },
            "session:seed": { id: "session:seed", at: 0, label: "", coins: 0, xp: xpValue },
          },
          daily: {},
          loginDates: [key],
          equipped: {},
          lastRewards: [],
        },
        version: 0,
      }),
    );
  }, xp);
}

test("shows rank and level on the home screen", async ({ page }) => {
  await seed(page, 460);
  await page.goto("/");
  await expect(page.getByTestId("level")).toHaveText("Lv.4");
  await expect(page.getByText("ルーキー")).toBeVisible();
});

test("levels up at the end of a session", async ({ page }) => {
  await seed(page, 45);
  await page.clock.install();
  await page.goto("/");
  await expect(page.getByTestId("level")).toHaveText("Lv.1");
  await page.getByTestId("play").click({ force: true });
  await expect(page.getByTestId("drag-source")).toBeVisible({ timeout: 10_000 });
  await page.clock.fastForward("03:01");
  await expect(page).toHaveURL(/\/result$/, { timeout: 10_000 });
  await expect(page.getByTestId("level-up")).toContainText("Lv.1 → Lv.2");
  await expect(page.getByTestId("reward-total")).toContainText("⭐+10XP");
});

test("league and friends ask guests to sign in", async ({ page }) => {
  await seed(page, 0);
  await page.goto("/league");
  await expect(page.getByTestId("login-required")).toBeVisible();
  await page.goto("/friends");
  await expect(page.getByTestId("login-required")).toBeVisible();
});

test("an invite link remembers the code until sign-in", async ({ page }) => {
  await seed(page, 0);
  await page.goto("/invite/ABCD2345");
  await expect(page.getByText("招待が届きました!")).toBeVisible();
  await expect(page.getByTestId("invite-from")).toContainText("友だちから");
  expect(await page.evaluate(() => localStorage.getItem("dopatan-invite-code"))).toBe("ABCD2345");
});
