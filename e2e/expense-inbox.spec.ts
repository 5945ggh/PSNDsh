import { expect, test, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";

const unique = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const sameOriginHeaders = {
  "x-pd-same-origin": "1",
  "content-type": "application/json",
};

const createExpenseSetup = async (page: Page) => {
  await page.goto("/register");
  const username = unique("expense-user");
  const password = "password123";

  await page.getByLabel("账号").fill(username);
  await page.getByLabel("密码", { exact: true }).fill(password);
  await page.getByLabel("确认密码").fill(password);
  await page.getByRole("button", { name: "完成注册并进入" }).click();
  await expect(page).toHaveURL(/\/$/);

  const createJson = async (url: string, body: Record<string, unknown>) => {
    const response = await page.request.post(url, {
      headers: sameOriginHeaders,
      data: body,
    });
    expect(response.ok()).toBe(true);
    return response.json();
  };

  const category = (await createJson("/api/v1/expenses/categories", { name: "餐饮" }) as { data: { id: string } }).data;
  const tag = (await createJson("/api/v1/expenses/tags", { name: "校园" }) as { data: { id: string } }).data;
  const paymentMethod = (await createJson("/api/v1/expenses/payment-methods", { name: "微信" }) as { data: { id: string } }).data;
  const apiKeyResponse = await page.request.post("/api/v1/api-keys", {
    headers: sameOriginHeaders,
    data: { name: "快捷指令" },
  });
  expect(apiKeyResponse.ok()).toBe(true);
  const apiKey = ((await apiKeyResponse.json()) as { data: { apiKey: string } }).data.apiKey;

  const capture = async (id: string, amountCents: number, captureMessage: string) => {
    const response = await page.request.post("/api/v1/expenses/capture", {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      data: { id, amount_cents: amountCents, capture_message: captureMessage },
    });
    expect(response.ok()).toBe(true);
  };

  await capture(randomUUID(), 1_580, "午饭");
  await capture(randomUUID(), 520, "奶茶");
  await capture(randomUUID(), 300, "公交");

  return { category, tag, paymentMethod };
};

test("inbox supports save, keep as is, skip, and error recovery", async ({ page }) => {
  const { category, paymentMethod } = await createExpenseSetup(page);
  await page.goto("/inbox");

  await expect(page.getByTestId("expense-detail-panel").getByText("待整理", { exact: true })).toBeVisible();
  await expect(page.getByTestId("expense-record-list").getByText("未分类", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: /午饭/ }).first()).toBeVisible();

  await page.getByRole("button", { name: /午饭/ }).first().click();
  const detailPanel = page.getByTestId("expense-detail-panel");
  await expect(detailPanel.getByText("午饭", { exact: true }).first()).toBeVisible();

  await page.getByRole("button", { name: "复制为备注" }).click();
  await expect(page.getByLabel("备注")).toHaveValue("午饭");
  await expect(detailPanel.getByText("午饭", { exact: true }).first()).toBeVisible();

  let failedOnce = false;
  await page.route("**/api/v1/expenses/*", async (route) => {
    if (route.request().method() === "PATCH" && !failedOnce) {
      failedOnce = true;
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({
          error: {
            code: "INTERNAL_ERROR",
            message: "保存失败",
            details: {},
          },
        }),
      });
      return;
    }
    await route.continue();
  });

  await page.getByLabel("金额").fill("15.80");
  await page.getByLabel("分类").selectOption(category.id);
  await page.getByLabel("支付方式").selectOption(paymentMethod.id);
  await page.getByLabel("备注").fill("午餐");
  await page.getByLabel("校园").check();
  await page.getByRole("button", { name: "保存修改" }).click();
  await expect(page.getByText("保存失败")).toBeVisible();
  await expect(page.getByLabel("金额")).toHaveValue("15.80");

  await page.getByRole("button", { name: "保存并标记已整理" }).click();
  await expect(detailPanel).toContainText("奶茶");
  await expect(page.getByTestId("expense-record-list")).toContainText("公交");
  await expect(page.getByRole("button", { name: /午饭/ })).toHaveCount(0);

  await page.getByRole("button", { name: /奶茶/ }).first().click();
  await page.getByRole("button", { name: "保存并标记已整理" }).click();
  await expect(detailPanel).toContainText("公交");
  await expect(page.getByRole("button", { name: /奶茶/ })).toHaveCount(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("button", { name: "跳过" })).toBeVisible();
  await page.getByRole("button", { name: "跳过" }).click();
  await expect(page.getByTestId("expense-record-list")).toContainText("公交");
});
