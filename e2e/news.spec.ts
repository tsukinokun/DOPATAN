import { expect, test } from "@playwright/test";
import { openHome } from "./helpers";

test("the news button shows unread news and clears it after reading", async ({ page }) => {
  await openHome(page);
  await expect(page.getByTestId("news-badge")).toBeVisible();
  await page.getByTestId("open-news").click();
  await expect(page).toHaveURL(/\/news$/);
  // 今週のイベントの開始と、手書きのお知らせが出る
  await expect(page.getByTestId("news-list")).toContainText("今週のイベント");
  await expect(page.getByTestId("news-list")).toContainText("お知らせ欄と通知ができました");
  await expect(page.getByTestId("news-list").getByText("NEW").first()).toBeVisible();
  // テスト環境には VAPID の鍵が無いので、通知は準備中と出る
  await expect(page.getByTestId("push-card")).toHaveAttribute("data-status", "not-configured");

  await page.goto("/");
  await expect(page.getByTestId("open-news")).toBeVisible();
  await expect(page.getByTestId("news-badge")).toHaveCount(0);
  await page.goto("/news");
  await expect(page.getByTestId("news-list").getByText("NEW")).toHaveCount(0);
});

test("the settings page has the notification card", async ({ page }) => {
  await openHome(page);
  await page.goto("/settings");
  await expect(page.getByTestId("push-card")).toBeVisible();
});
