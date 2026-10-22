import { expect, test } from "@playwright/test";
import { openHome } from "./helpers";

test("a guest can rename themselves from the profile and the name is kept", async ({ page }) => {
  await openHome(page);
  await page.getByTestId("open-profile").click();
  await expect(page).toHaveURL(/\/profile$/);
  await expect(page.getByTestId("profile-name")).toHaveText("ゲスト");

  await page.getByTestId("edit-name").click();
  await page.getByTestId("nickname-input").fill("x");
  await page.getByRole("button", { name: "保存する" }).click();
  await expect(page.getByText("2文字以上にしてください")).toBeVisible();

  await page.getByTestId("nickname-input").fill("ドパ太郎");
  await page.getByRole("button", { name: "保存する" }).click();
  await expect(page.getByTestId("profile-name")).toHaveText("ドパ太郎");

  await page.reload();
  await expect(page.getByTestId("profile-name")).toHaveText("ドパ太郎");
});

test("the profile shows records, word progress, the 30-day chart and achievements", async ({ page }) => {
  await openHome(page);
  await page.goto("/profile");
  await expect(page.getByTestId("basic-stats")).toContainText("プレイ回数");
  await expect(page.getByTestId("word-stats")).toContainText("990点");
  await expect(page.getByTestId("recent-chart").locator("[title]")).toHaveCount(30);
  await expect(page.getByTestId("achievements")).toBeVisible();
});
