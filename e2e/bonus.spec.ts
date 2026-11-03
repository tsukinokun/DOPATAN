import { expect, test, type Page } from "@playwright/test";
import { openHome, passEventProgress, useModes } from "./helpers";

/** 時計を進めてゲームを終わらせる(1回で終わらないことがあるので、少しずつ進める) */
async function finishGame(page: Page) {
  await page.clock.fastForward("01:31");
  for (let i = 0; i < 6 && !/event\/progress|result/.test(page.url()); i++) {
    await page.waitForTimeout(500);
    await page.clock.fastForward("00:05");
  }
}

test.beforeEach(async ({ page }) => {
  await useModes(page, ["wordToPicture"]);
});

test("a game adds the level bonus to the score with a banner", async ({ page }) => {
  await page.clock.install();
  await openHome(page);
  await page.getByTestId("play").click({ force: true });
  await expect(page.getByTestId("drag-source")).toBeVisible({ timeout: 10_000 });
  await page.waitForTimeout(450);
  // 紹介の問題(1枚)をタップで正解すると50点。Lv.1 なので +1% = +1点
  await page.getByTestId("drop-correct").click();
  await page.waitForTimeout(800);
  await finishGame(page);
  await passEventProgress(page);
  await expect(page.getByTestId("level-bonus")).toHaveText("Lv.1 ボーナス +1%!");
  await expect(page.getByTestId("result-score")).toHaveText("51");
  await expect(page.getByTestId("score-breakdown")).toHaveText("基本 50 + Lv.1 ボーナス 1");
});

test("the result shows a big level bonus from a saved game, with full effects", async ({ page }) => {
  await page.addInitScript(() => {
    // 演出を「最大」にして、数え上がり → 帯 → 合計 → NEW RECORD の流れを最後まで確かめる
    localStorage.setItem(
      "dopatan-settings",
      JSON.stringify({
        state: { showJapanese: true, effectIntensity: "max", sound: false, bgm: false, vibration: false, modes: ["wordToPicture"], bands: [], themes: [] },
        version: 1,
      }),
    );
    localStorage.setItem(
      "dopatan-progress",
      JSON.stringify({
        state: {
          progress: {},
          sessions: 3,
          bestScore: 9999,
          bestCombo: 12,
          lastResult: {
            score: 8960,
            baseScore: 8000,
            levelBonus: { level: 12, percent: 12, points: 960 },
            maxCombo: 12,
            correct: 20,
            wrong: 2,
            feverCount: 1,
            newWords: 0,
            answers: [],
            finishedAt: 1,
            newRecord: true,
          },
        },
        version: 0,
      }),
    );
  });
  await page.goto("/result");
  await expect(page.getByTestId("level-bonus")).toHaveText("Lv.12 ボーナス +12%!");
  await expect(page.getByTestId("result-score")).toHaveText("8,960");
  await expect(page.getByTestId("score-breakdown")).toHaveText("基本 8,000 + Lv.12 ボーナス 960");
  await expect(page.getByTestId("new-record")).toBeVisible();
});

test("no bonus banner when nothing was scored", async ({ page }) => {
  await page.clock.install();
  await openHome(page);
  await page.getByTestId("play").click({ force: true });
  await expect(page.getByTestId("drag-source")).toBeVisible({ timeout: 10_000 });
  await finishGame(page);
  await passEventProgress(page);
  await expect(page.getByTestId("result-score")).toHaveText("0");
  await page.waitForTimeout(3500);
  await expect(page.getByTestId("level-bonus")).toHaveCount(0);
});
