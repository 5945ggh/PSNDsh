import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";

const unique = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const registerUser = async (page: Page, username: string) => {
  await page.goto("/register");
  await page.getByLabel("账号").fill(username);
  await page.getByLabel("密码", { exact: true }).fill("password123");
  await page.getByLabel("确认密码").fill("password123");
  await page.getByRole("button", { name: "完成注册并进入" }).click();
  await expect(page).toHaveURL(/\/$/);
};

const createApiKey = async (page: Page, name: string) => {
  const response = await page.request.post("/api/v1/api-keys", { headers: { "x-pd-same-origin": "1" }, data: { name } });
  expect(response.status()).toBe(201);
  const body = await response.json();
  return body.data.apiKey as string;
};

const createCategory = async (page: Page, name: string) => {
  const response = await page.request.post("/api/v1/expenses/categories", { headers: { "x-pd-same-origin": "1" }, data: { name } });
  expect(response.status()).toBe(201);
  const body = await response.json();
  return body.data as { id: string; name: string };
};

const createTag = async (page: Page, name: string) => {
  const response = await page.request.post("/api/v1/expenses/tags", { headers: { "x-pd-same-origin": "1" }, data: { name } });
  expect(response.status()).toBe(201);
  const body = await response.json();
  return body.data as { id: string; name: string };
};

const createPaymentMethod = async (page: Page, name: string) => {
  const response = await page.request.post("/api/v1/expenses/payment-methods", { headers: { "x-pd-same-origin": "1" }, data: { name } });
  expect(response.status()).toBe(201);
  const body = await response.json();
  return body.data as { id: string; name: string };
};

const captureExpense = async (
  page: Page,
  apiKey: string,
  amountCents: number,
  captureMessage?: string | null,
) => {
  const response = await page.request.post("/api/v1/expenses/capture", {
    headers: { authorization: `Bearer ${apiKey}` },
    data: {
      id: randomUUID(),
      amount_cents: amountCents,
      ...(captureMessage === undefined ? {} : { capture_message: captureMessage }),
    },
  });
  expect(response.status()).toBeGreaterThanOrEqual(200);
  expect(response.status()).toBeLessThan(300);
  const body = await response.json();
  return body.data as { id: string };
};

test("inbox workflow keeps capture facts, preserves unclassified records, and leaves history alone until saved", async ({ page }) => {
  const username = unique("expense-inbox");
  await registerUser(page, username);

  const apiKey = await createApiKey(page, "快捷指令");
  const category = await createCategory(page, "餐饮");
  const workdayTag = await createTag(page, "工作日");
  const campusTag = await createTag(page, "校内");
  const paymentMethod = await createPaymentMethod(page, "微信");

  const first = await captureExpense(page, apiKey, 1250, "午饭");
  const second = await captureExpense(page, apiKey, 2600, "车费");
  const third = await captureExpense(page, apiKey, 4300);

  await page.goto("/inbox");
  page.on("response", async (response) => {
    if (response.url().includes("/api/v1/expenses")) {
      console.log("E2E_RESPONSE", response.request().method(), response.url(), response.status(), await response.text().catch(() => ""));
    }
  });
  await expect(page.getByTestId("expense-detail-panel").getByText("待整理", { exact: true })).toBeVisible();
  await expect(page.getByTestId("expense-record-list").getByText("未分类", { exact: true }).first()).toBeVisible();
  await expect(page.getByTestId(`expense-row-${first.id}`)).toContainText("午饭");

  await page.getByTestId(`expense-row-${first.id}`).click();
  const firstPanel = page.getByTestId("expense-detail-panel");
  await firstPanel.getByLabel("备注").fill("午餐");
  await firstPanel.getByLabel("分类").selectOption(category.id);
  await firstPanel.getByLabel("支付方式").selectOption(paymentMethod.id);
  await firstPanel.getByLabel(workdayTag.name).check();
  await firstPanel.getByLabel(campusTag.name).check();
  await firstPanel.getByRole("button", { name: "保存并下一条" }).click();
  await expect(firstPanel).toContainText("车费");

  await firstPanel.getByRole("button", { name: "保留原样并下一条" }).click();
  await expect(firstPanel).toContainText("没有捕获留言。");
  await firstPanel.getByRole("button", { name: "跳过" }).click();
  await expect(firstPanel).toContainText("没有捕获留言。");

  await page.getByRole("link", { name: "查看全部记录" }).click();
  await expect(page).toHaveURL(/\/expenses$/);

  const firstRow = page.getByTestId(`expense-row-${first.id}`);
  const secondRow = page.getByTestId(`expense-row-${second.id}`);
  const thirdRow = page.getByTestId(`expense-row-${third.id}`);

  await expect(firstRow).toContainText("午餐");
  await expect(firstRow).toContainText("餐饮");
  await expect(firstRow).toContainText("微信");
  await expect(firstRow).toContainText("工作日");
  await expect(firstRow).toContainText("校内");
  await expect(secondRow).toContainText("车费");
  await expect(thirdRow).toContainText("未填写备注");
  await expect(thirdRow).toContainText("未知/未填写");

  await expect(page.getByTestId("expense-detail-panel")).toHaveCount(0);
  await thirdRow.click();
  const detail = page.getByTestId("expense-detail-panel");
  await expect(detail).toContainText("未填写备注");
  await expect(detail.getByRole("button", { name: "保存修改" })).toBeVisible();

  await page.route(`**/api/v1/expenses/${third.id}`, async (route) => {
    if (route.request().method() !== "PATCH") {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({
        error: {
          code: "INTERNAL_ERROR",
          message: "整理失败",
          details: {},
        },
      }),
    });
  });

  await detail.getByLabel("备注").fill("晚饭整理");
  await detail.getByRole("button", { name: "保存修改" }).click();
  await expect(detail.getByLabel("备注")).toHaveValue("晚饭整理");
  await expect(detail.getByRole("alert")).toContainText("整理失败");
  await page.unroute(`**/api/v1/expenses/${third.id}`);

  await page.goto("/inbox");
  await expect(page.getByTestId(`expense-row-${third.id}`)).toContainText("待整理");
});

test("expenses overview expands one inline detail row and keeps pagination stable", async ({ page }) => {
  const username = unique("expense-overview");
  await registerUser(page, username);

  const apiKey = await createApiKey(page, "总览快捷指令");
  await createCategory(page, "餐饮");
  await createPaymentMethod(page, "微信");
  await createTag(page, "工作日");
  await createTag(page, "校内");
  await createTag(page, "午休");
  await createTag(page, "外出");

  const records = Array.from({ length: 26 }, (_, index) => ({
    id: randomUUID(),
    amount: 1000 + index * 10,
    captureMessage: `记录 ${index + 1}`,
  }));

  for (const record of records) {
    const response = await page.request.post("/api/v1/expenses/capture", {
      headers: { authorization: `Bearer ${apiKey}` },
      data: {
        id: record.id,
        amount_cents: record.amount,
        capture_message: record.captureMessage,
      },
    });
    expect(response.status()).toBeGreaterThanOrEqual(200);
    expect(response.status()).toBeLessThan(300);
  }

  await page.goto("/expenses");
  await expect(page.getByRole("button", { name: "下一页" })).toBeVisible();
  await expect(page.getByRole("button", { name: "保存修改" })).toHaveCount(0);
  await expect(page.getByTestId(`expense-row-${records[25].id}`)).toBeVisible();
  await expect(page.getByTestId(`expense-row-${records[0].id}`)).toHaveCount(0);

  const latestRow = page.getByTestId(`expense-row-${records[25].id}`);
  const list = page.getByTestId("expense-record-list");
  const listWidth = await list.evaluate((element) => element.getBoundingClientRect().width);
  const latestRowButton = latestRow.locator(":scope > button");
  await latestRowButton.click();
  await expect(latestRow.getByTestId("expense-detail-panel")).toContainText("保存修改");
  await expect(page.getByTestId("expense-detail-panel")).toHaveCount(1);
  await expect(latestRow.getByTestId("expense-detail-panel")).toBeVisible();
  await expect.poll(async () => list.evaluate((element) => element.getBoundingClientRect().width)).toBe(listWidth);

  await latestRowButton.click();
  await expect(page.getByTestId("expense-detail-panel")).toHaveCount(0);

  const previousRow = page.getByTestId(`expense-row-${records[1].id}`);
  await previousRow.scrollIntoViewIfNeeded();
  const scrollYBeforeSwitch = await page.evaluate(() => window.scrollY);
  await previousRow.locator(":scope > button").click();
  await expect.poll(async () => page.evaluate(() => window.scrollY)).toBe(scrollYBeforeSwitch);
  await expect(previousRow.getByTestId("expense-detail-panel")).toBeVisible();
  await expect(latestRow.getByTestId("expense-detail-panel")).toHaveCount(0);
  await expect(page.getByTestId("expense-detail-panel")).toHaveCount(1);

  const scrollYBeforeCollapse = await page.evaluate(() => window.scrollY);
  await previousRow.locator(":scope > button").click();
  await expect.poll(async () => page.evaluate(() => window.scrollY)).toBe(scrollYBeforeCollapse);
  await expect(page.getByTestId("expense-detail-panel")).toHaveCount(0);

  await page.getByRole("button", { name: "下一页" }).click();
  await expect(page.getByTestId("expense-detail-panel")).toHaveCount(0);
  await expect(page.getByTestId(`expense-row-${records[25].id}`)).toHaveCount(0);
  await expect(page.getByTestId(`expense-row-${records[0].id}`)).toBeVisible();
  await expect(page.getByText("第 2 / 2 页")).toBeVisible();

  await page.goto("/expenses");
  await expect(page.getByTestId(`expense-row-${records[0].id}`)).toHaveCount(0);
  await expect(page.getByTestId(`expense-row-${records[25].id}`)).toBeVisible();
  await expect(page.getByText("第 1 / 2 页")).toBeVisible();
});

test("mobile inbox actions remain clickable and keep navigation stable", async ({ page }) => {
  const username = unique("expense-mobile");
  await page.setViewportSize({ width: 390, height: 844 });
  await registerUser(page, username);

  const apiKey = await createApiKey(page, "移动端快捷指令");
  await captureExpense(page, apiKey, 880, "早餐");

  await page.goto("/inbox");
  const panel = page.getByTestId("expense-detail-panel");
  await expect(panel.getByRole("button", { name: "保存并下一条" })).toBeVisible();
  await expect(panel.getByRole("button", { name: "保留原样并下一条" })).toBeVisible();
  await expect(panel.getByRole("button", { name: "跳过" })).toBeVisible();

  await panel.getByRole("button", { name: "保存并下一条" }).click();
  await expect(page.getByTestId("expense-record-list")).toContainText("Inbox 已清空");
});
