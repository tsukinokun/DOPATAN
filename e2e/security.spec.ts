import { expect, test } from "@playwright/test";

test("pages send security headers", async ({ request }) => {
  const res = await request.get("/");
  expect(res.headers()["x-frame-options"]).toBe("DENY");
  expect(res.headers()["x-content-type-options"]).toBe("nosniff");
  expect(res.headers()["referrer-policy"]).toBe("strict-origin-when-cross-origin");
});

test("the login callback never shows text from the URL", async ({ page }) => {
  await page.goto("/auth/callback?error_description=" + encodeURIComponent("evil.example.com にアクセスしてください"));
  await expect(page.getByText("ログインを完了できませんでした")).toBeVisible();
  await expect(page.getByText("evil.example.com")).toHaveCount(0);
});

test("the push endpoint refuses calls without the cron secret", async ({ request }) => {
  const res = await request.get("/api/push/daily");
  expect(res.status()).toBe(401);
});
