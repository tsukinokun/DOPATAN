import { expect, test, type Page } from "@playwright/test";
import { useModes } from "./helpers";

// つづり並べ替えはドラッグしないので、ここでは除く(e2e/modes.spec.ts で確かめる)
test.beforeEach(async ({ page }) => {
  await useModes(page, ["wordToPicture", "pictureToWord", "listening"]);
});

async function dragTo(page: Page, targetTestId: string) {
  const source = await page.getByTestId("drag-source").boundingBox();
  const target = await page.getByTestId(targetTestId).first().boundingBox();
  if (!source || !target) throw new Error("board not ready");
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
  await page.mouse.down();
  await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 12 });
  await page.mouse.up();
}

async function waitForQuestion(page: Page) {
  await expect(page.getByTestId("drag-source")).toBeVisible({ timeout: 10_000 });
  // 出題アニメーションが落ち着くのを待つ
  await page.waitForTimeout(450);
}

/** ホームを開き、その日最初に出るログインボーナスを閉じる */
export async function openHome(page: Page) {
  await page.goto("/");
  const receive = page.getByTestId("login-bonus-receive");
  await receive.click({ timeout: 5000 }).catch(() => {});
  await expect(page.getByTestId("login-bonus")).toHaveCount(0);
}

async function startGame(page: Page) {
  await openHome(page);
  await page.getByTestId("play").click({ force: true });
  await waitForQuestion(page);
}

test("swipe judging ramps new words from 1 to 2 to 4 cards", async ({ page }) => {
  await startGame(page);
  const counts: number[] = [];
  for (let i = 0; i < 8; i++) {
    await waitForQuestion(page);
    counts.push(await page.locator("[data-testid^=drop-]").count());
    await dragTo(page, "drop-correct");
    await expect(page.getByTestId("drag-source")).toHaveCount(0, { timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(700);
  }
  expect(counts[0]).toBe(1);
  expect(counts).toContain(2);
  expect(counts).toContain(4);
  expect(Number((await page.getByTestId("score").textContent())!.replace(/,/g, ""))).toBeGreaterThan(0);
});

test("a wrong swipe resets the combo and shows the answer", async ({ page }) => {
  await startGame(page);
  // コンボを作るまで正解し、選択肢が複数の問題で間違える
  for (let i = 0; i < 12; i++) {
    await waitForQuestion(page);
    const wrong = page.getByTestId("drop-wrong");
    if ((await wrong.count()) > 0 && (await page.getByTestId("combo").count()) > 0) {
      await dragTo(page, "drop-wrong");
      await expect(page.getByTestId("combo")).toHaveCount(0);
      await expect(page.getByTestId("drop-correct")).toBeVisible();
      return;
    }
    await dragTo(page, "drop-correct");
    await page.waitForTimeout(700);
  }
  throw new Error("never reached a multi-choice question with a combo");
});

test("dropping outside the cards does not answer", async ({ page }) => {
  await startGame(page);
  const source = (await page.getByTestId("drag-source").boundingBox())!;
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
  await page.mouse.down();
  await page.mouse.move(5, 5, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(500);
  await expect(page.getByTestId("score")).toHaveText("0");
});

test("Japanese can be hidden from the settings", async ({ page }) => {
  await page.goto("/settings");
  const toggle = page.getByTestId("toggle-japanese");
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked", "false");
  await openHome(page);
  await page.getByTestId("play").click({ force: true });
  await waitForQuestion(page);
  await expect(page.getByTestId("card-ja")).toHaveCount(0);
});

test("the session ends after 90 seconds and shows the result", async ({ page }) => {
  await page.clock.install();
  await startGame(page);
  await dragTo(page, "drop-correct");
  await page.waitForTimeout(800);
  await page.clock.fastForward("01:31");
  await expect(page).toHaveURL(/\/result$/, { timeout: 10_000 });
  await expect(page.getByTestId("result-words").locator("li")).not.toHaveCount(0);
});

test("keyboard digits answer on desktop", async ({ page, isMobile }) => {
  test.skip(isMobile, "PC only");
  await startGame(page);
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("score")).not.toHaveText("0");
});

test("works as guest-only without Supabase settings", async ({ page }) => {
  await openHome(page);
  await expect(page.getByTestId("play")).toBeVisible();
  await expect(page.getByTestId("open-account")).toHaveCount(0);
  await page.goto("/account");
  await expect(page.getByText("ログイン機能は準備中です。")).toBeVisible();
});

test("quitting and playing again starts a fresh 90-second game", async ({ page }) => {
  await startGame(page);
  await page.waitForTimeout(4000);
  const before = Number(await page.getByTestId("timer").textContent());
  expect(before).toBeLessThanOrEqual(87);
  await page.getByRole("button", { name: "やめる" }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.getByTestId("play").click({ force: true });
  await waitForQuestion(page);
  expect(Number(await page.getByTestId("timer").textContent())).toBeGreaterThanOrEqual(88);
  await expect(page.getByTestId("score")).toHaveText("0");
});

test("the play screen blocks pull-to-refresh and page scrolling", async ({ page }) => {
  await startGame(page);
  const styles = await page.evaluate(() => ({
    html: getComputedStyle(document.documentElement).overscrollBehaviorY,
    body: getComputedStyle(document.body).overscrollBehaviorY,
    main: getComputedStyle(document.querySelector("main")!).touchAction,
  }));
  expect(styles).toEqual({ html: "none", body: "none", main: "none" });
});
