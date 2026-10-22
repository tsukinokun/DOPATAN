import { expect, test, type Page } from "@playwright/test";
import { onlyReview, useModes } from "./helpers";

async function start(page: Page) {
  await page.goto("/");
  await page.getByTestId("login-bonus-receive").click({ timeout: 5000 }).catch(() => {});
  await expect(page.getByTestId("login-bonus")).toHaveCount(0);
  await page.getByTestId("play").click({ force: true });
}

const score = async (page: Page) => Number((await page.getByTestId("score").textContent())!.replace(/,/g, ""));

test.describe("spelling", () => {
  test.beforeEach(async ({ page }) => {
    await useModes(page, ["spelling"]);
    await onlyReview(page, "budget-1");
  });

  test("tapping the letters in order answers correctly", async ({ page }) => {
    await start(page);
    await expect(page.getByTestId("spelling-board")).toBeVisible({ timeout: 10_000 });
    for (const letter of "budget") await page.getByTestId(`tile-${letter}`).click();
    await expect.poll(() => score(page)).toBeGreaterThan(0);
  });

  test("typing on a keyboard works too", async ({ page, isMobile }) => {
    test.skip(isMobile, "PC only");
    await start(page);
    await expect(page.getByTestId("spelling-board")).toBeVisible({ timeout: 10_000 });
    await page.keyboard.type("budget", { delay: 50 });
    await expect.poll(() => score(page)).toBeGreaterThan(0);
  });

  test("a wrong letter fails and shows the answer", async ({ page }) => {
    await start(page);
    await expect(page.getByTestId("spelling-board")).toBeVisible({ timeout: 10_000 });
    await page.getByTestId("tile-u").click();
    await expect(page.getByTestId("spelling-slots")).toHaveText("budget");
    expect(await score(page)).toBe(0);
  });
});

test("listening lets you drag the sound onto the right picture", async ({ page }) => {
  await useModes(page, ["listening"]);
  await onlyReview(page, "budget-1");
  const audioRequests: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/audio/")) audioRequests.push(new URL(r.url()).pathname);
  });
  await start(page);
  await expect(page.getByTestId("speaker")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId("drag-source")).toBeVisible();
  await page.waitForTimeout(450);
  const source = (await page.getByTestId("drag-source").boundingBox())!;
  const target = (await page.getByTestId("drop-correct").boundingBox())!;
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
  await page.mouse.down();
  await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 12 });
  await page.mouse.up();
  await expect.poll(() => score(page)).toBeGreaterThan(0);
  expect(audioRequests).toContain("/audio/budget.mp3");
});

test("falls back to the browser voice when an audio file is missing", async ({ page }) => {
  await useModes(page, ["listening"]);
  await onlyReview(page, "budget-1");
  await page.route("**/audio/**", (route) => route.fulfill({ status: 404, body: "" }));
  await page.addInitScript(() => {
    const spoken: string[] = [];
    (window as unknown as { __spoken: string[] }).__spoken = spoken;
    Object.defineProperty(window, "speechSynthesis", {
      value: { speak: (u: SpeechSynthesisUtterance) => spoken.push(u.text), cancel: () => {} },
    });
  });
  await start(page);
  await expect(page.getByTestId("speaker")).toBeVisible({ timeout: 10_000 });
  await expect.poll(() => page.evaluate(() => (window as unknown as { __spoken: string[] }).__spoken)).toContain("budget");
});

test("question modes can be switched in settings", async ({ page }) => {
  await page.goto("/settings");
  for (const mode of ["wordToPicture", "pictureToWord", "listening", "spelling"]) {
    await expect(page.getByTestId(`mode-${mode}`)).toBeChecked();
  }
  await page.getByTestId("mode-spelling").uncheck();
  await expect(page.getByTestId("mode-spelling")).not.toBeChecked();
  await page.reload();
  await expect(page.getByTestId("mode-spelling")).not.toBeChecked();
});
