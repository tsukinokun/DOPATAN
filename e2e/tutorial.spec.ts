import { expect, test, type Page } from "@playwright/test";
import { onlyReview } from "./helpers";

/** 遊び方の説明をまだ見ていない設定にする */
async function freshSettings(page: Page, modes: string[], seenTutorials: string[] = []) {
  await page.addInitScript(
    ({ m, seen }) => {
      if (localStorage.getItem("dopatan-settings")) return;
      localStorage.setItem(
        "dopatan-settings",
        JSON.stringify({
          state: { effectIntensity: "low", bgm: false, vibration: false, modes: m, seenTutorials: seen },
          version: 1,
        }),
      );
    },
    { m: modes, seen: seenTutorials },
  );
}

/** 音声ファイルを読めなくして、ブラウザの読み上げに渡された単語を記録する */
async function recordSpeech(page: Page) {
  await page.route("**/audio/**", (route) => route.fulfill({ status: 404, body: "" }));
  await page.addInitScript(() => {
    const spoken: string[] = [];
    (window as unknown as { __spoken: string[] }).__spoken = spoken;
    Object.defineProperty(window, "speechSynthesis", {
      value: { speak: (u: SpeechSynthesisUtterance) => spoken.push(u.text), cancel: () => {} },
    });
  });
}

const spoken = (page: Page) => page.evaluate(() => (window as unknown as { __spoken: string[] }).__spoken);

async function start(page: Page) {
  await page.goto("/");
  await page.getByTestId("login-bonus-receive").click({ timeout: 5000 }).catch(() => {});
  await expect(page.getByTestId("login-bonus")).toHaveCount(0);
  await page.getByTestId("play").click({ force: true });
}

async function dragTo(page: Page, targetTestId: string) {
  const source = (await page.getByTestId("drag-source").boundingBox())!;
  const target = (await page.getByTestId(targetTestId).first().boundingBox())!;
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
  await page.mouse.down();
  await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 12 });
  await page.mouse.up();
}

test("the first question of a mode explains how to play and stops the clock until answered", async ({ page }) => {
  await freshSettings(page, ["wordToPicture"]);
  await onlyReview(page, "budget-1");
  await recordSpeech(page);
  await start(page);

  const dialog = page.getByTestId("tutorial-dialog");
  await expect(dialog).toBeVisible({ timeout: 10_000 });
  await expect(dialog).toContainText("英単語 → 絵");
  const timer = await page.getByTestId("timer").textContent();
  await page.waitForTimeout(1500);
  await expect(page.getByTestId("timer")).toHaveText(timer!);
  // 説明を読んでいる間は読み上げない
  expect(await spoken(page)).not.toContain("budget");

  await page.getByTestId("tutorial-ok").click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByTestId("hand-demo")).toBeVisible();
  await expect.poll(() => spoken(page)).toContain("budget");
  // 指の動きを見せている間も、最初の1問に答えるまでは時間が止まったまま
  await page.waitForTimeout(1200);
  await expect(page.getByTestId("timer")).toHaveText(timer!);

  await page.waitForTimeout(300);
  await dragTo(page, "drop-correct");
  await expect(page.getByTestId("hand-demo")).toHaveCount(0);
  await expect.poll(async () => (await page.getByTestId("timer").textContent()) !== timer, { timeout: 5000 }).toBe(true);

  // 2回目のプレイでは説明は出ない
  await page.goto("/");
  await page.getByTestId("play").click({ force: true });
  await expect(page.getByTestId("drag-source")).toBeVisible({ timeout: 10_000 });
  await page.waitForTimeout(500);
  await expect(dialog).toHaveCount(0);
});

test("word-to-picture reads the word aloud as soon as the question appears", async ({ page }) => {
  await freshSettings(page, ["wordToPicture"], ["wordToPicture"]);
  await onlyReview(page, "budget-1");
  await recordSpeech(page);
  await start(page);
  await expect(page.getByTestId("drag-source")).toBeVisible({ timeout: 10_000 });
  await expect.poll(() => spoken(page)).toContain("budget");
});

test("picture-to-word reads the word only after answering", async ({ page }) => {
  await freshSettings(page, ["pictureToWord"], ["pictureToWord"]);
  await onlyReview(page, "budget-1");
  await recordSpeech(page);
  await start(page);
  await expect(page.getByTestId("drag-source")).toBeVisible({ timeout: 10_000 });
  await page.waitForTimeout(800);
  expect(await spoken(page)).not.toContain("budget");
  await dragTo(page, "drop-wrong");
  await expect.poll(() => spoken(page)).toContain("budget");
});

test("tutorials can be shown again from settings", async ({ page }) => {
  await freshSettings(page, ["wordToPicture"], ["wordToPicture", "pictureToWord", "listening", "spelling"]);
  await page.goto("/settings");
  await page.getByTestId("reset-tutorials").click();
  await expect(page.getByTestId("reset-tutorials")).toBeDisabled();
  await onlyReview(page, "budget-1");
  await start(page);
  await expect(page.getByTestId("tutorial-dialog")).toBeVisible({ timeout: 10_000 });
});
