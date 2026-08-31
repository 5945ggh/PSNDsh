import { expect, test } from "@playwright/test";

test("Inbox keeps uncategorized captures visible until an explicit action", async ({ page }) => {
  const username = `inbox-${Date.now()}`;
  await page.goto("/register");
  await page.getByLabel("账号").fill(username);
  await page.getByLabel("密码", { exact: true }).fill("password123");
  await page.getByLabel("确认密码").fill("password123");
  await page.getByRole("button", { name: "完成注册并进入" }).click();
  await expect(page).toHaveURL(/\/$/);
  const keyResponse = await page.request.post("/api/v1/api-keys", { headers: { "x-pd-same-origin": "1" }, data: { name: "e2e" } });
  const key = (await keyResponse.json()).data.apiKey;
  const capture = await page.request.post("/api/v1/expenses/capture", { headers: { Authorization: `Bearer ${key}` }, data: { id: crypto.randomUUID(), amount_cents: 880, capture_message: "测试捕获" } });
  expect(capture.status()).toBe(201);
  await page.goto("/inbox");
  await expect(page.getByRole("heading", { name: "¥8.80" })).toBeVisible();
  await page.getByRole("button", { name: "跳过" }).click();
  await expect(page.getByRole("heading", { name: "¥8.80" })).toBeVisible();
  await page.getByRole("button", { name: "保存并标记已整理" }).click();
  await expect(page.getByRole("heading", { name: "¥8.80" })).not.toBeVisible();
});
