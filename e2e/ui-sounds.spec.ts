import { expect, test, type Page } from "@playwright/test";
import { openHome } from "./helpers";

/** 鳴らした音(オシレーター)の数を数えられるようにする */
async function countTones(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __tones: number };
    w.__tones = 0;
    const original = AudioContext.prototype.createOscillator;
    AudioContext.prototype.createOscillator = function (this: AudioContext) {
      w.__tones++;
      return original.call(this);
    };
  });
}

const tones = (page: Page) => page.evaluate(() => (window as unknown as { __tones: number }).__tones);

test("buttons and links play a tap sound", async ({ page }) => {
  await countTones(page);
  await openHome(page);
  const before = await tones(page);
  await page.getByTestId("open-profile").click();
  await expect(page).toHaveURL(/\/profile$/);
  expect(await tones(page)).toBeGreaterThan(before);
});

test("no tap sound when sound is turned off", async ({ page }) => {
  await countTones(page);
  await page.addInitScript(() => {
    localStorage.setItem("dopatan-settings", JSON.stringify({ state: { sound: false }, version: 1 }));
  });
  await openHome(page);
  const before = await tones(page);
  await page.getByTestId("open-profile").click();
  await expect(page).toHaveURL(/\/profile$/);
  expect(await tones(page)).toBe(before);
});
