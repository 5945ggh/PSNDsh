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
  await firstPanel.getByRole("button", { name: "保存并标记已整理" }).click();
  await expect(firstPanel).toContainText("车费");

  await firstPanel.getByRole("button", { name: "保存并标记已整理" }).click();
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
  await expect(detail.getByRole("button", { name: "备注" })).toContainText("添加备注...");
  await expect(detail.locator("textarea")).toHaveCount(0);
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

  await detail.getByRole("button", { name: "备注" }).click();
  await detail.getByLabel("备注").fill("晚饭整理");
  await detail.getByRole("button", { name: "保存修改" }).click();
  await expect(detail.getByLabel("备注")).toHaveValue("晚饭整理");
  await expect(detail.getByRole("alert")).toContainText("整理失败");
  await page.unroute(`**/api/v1/expenses/${third.id}`);

  await page.goto("/inbox");
  await expect(page.getByTestId(`expense-row-${third.id}`)).toContainText("待整理");
});

test("expenses overview browses older history continuously and keeps inline detail stable", async ({ page }) => {
  const username = unique("expense-overview");
  await page.setViewportSize({ width: 1440, height: 900 });
  await registerUser(page, username);

  const apiKey = await createApiKey(page, "总览快捷指令");
  await createCategory(page, "餐饮");
  await createPaymentMethod(page, "微信");
  await createTag(page, "工作日");
  await createTag(page, "校内");
  await createTag(page, "午休");
  await createTag(page, "外出");

  const records = Array.from({ length: 51 }, (_, index) => ({
    id: randomUUID(),
    amount: 1000 + index * 10,
    captureMessage: `记录 ${index + 1}`,
    occurredAt: `2026-01-01T00:00:${String(index).padStart(2, "0")}+08:00`,
  }));

  for (const record of records) {
    const response = await page.request.post("/api/v1/expenses/capture", {
      headers: { authorization: `Bearer ${apiKey}` },
      data: {
        id: record.id,
        amount_cents: record.amount,
        capture_message: record.captureMessage,
        occurred_at: record.occurredAt,
      },
    });
    expect(response.status()).toBeGreaterThanOrEqual(200);
    expect(response.status()).toBeLessThan(300);
  }

  const historyRequests: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "GET" && request.url().includes("/api/v1/expenses?")) {
      historyRequests.push(request.url());
    }
  });
  await page.goto("/expenses");
  const topBar = page.getByTestId("global-top-bar");
  const sidebar = page.getByTestId("global-sidebar");
  const mainContent = page.locator("#main-content");
  await expect(topBar).toBeVisible();
  await expect(sidebar).toBeVisible();
  await expect(mainContent).toBeVisible();
  const shellGeometry = await page.evaluate(() => {
    const topBar = document.querySelector<HTMLElement>('[data-testid="global-top-bar"]');
    const sidebar = document.querySelector<HTMLElement>('[data-testid="global-sidebar"]');
    const main = document.querySelector<HTMLElement>("#main-content");
    if (!topBar || !sidebar || !main) throw new Error("persistent app shell elements are missing");
    const topBarRect = topBar.getBoundingClientRect();
    const sidebarRect = sidebar.getBoundingClientRect();
    const mainStyle = getComputedStyle(main);
    return {
      topBarPosition: getComputedStyle(topBar).position,
      topBarTop: topBarRect.top,
      topBarBottom: topBarRect.bottom,
      sidebarPosition: getComputedStyle(sidebar).position,
      sidebarTop: sidebarRect.top,
      sidebarBottom: sidebarRect.bottom,
      sidebarWidth: sidebarRect.width,
      mainOverflowY: mainStyle.overflowY,
      mainClientHeight: main.clientHeight,
      mainScrollHeight: main.scrollHeight,
      windowScrollY: window.scrollY,
    };
  });
  expect(shellGeometry.topBarPosition).toBe("fixed");
  expect(shellGeometry.topBarTop).toBe(0);
  expect(shellGeometry.topBarBottom).toBe(56);
  expect(shellGeometry.sidebarPosition).toBe("fixed");
  expect(shellGeometry.sidebarTop).toBe(56);
  expect(shellGeometry.sidebarBottom).toBe(900);
  expect(shellGeometry.sidebarWidth).toBe(240);
  expect(shellGeometry.mainOverflowY).toBe("auto");
  expect(shellGeometry.mainScrollHeight).toBeGreaterThan(shellGeometry.mainClientHeight);
  expect(shellGeometry.windowScrollY).toBe(0);

  await expect(page.getByRole("button", { name: "下一页" })).toHaveCount(0);
  await expect(page.getByText(/第 \d+ \/ \d+ 页/)).toHaveCount(0);
  await expect(page.getByTestId(`expense-row-${records[50].id}`)).toBeVisible();
  await expect(page.getByTestId(`expense-row-${records[0].id}`)).toHaveCount(0);

  await page.getByRole("button", { name: "加载更多" }).click();
  await expect(page.getByText("已加载 50 条", { exact: true })).toBeVisible();
  const [loadMoreResponse] = await Promise.all([
    page.waitForResponse((response) => response.url().includes("/api/v1/expenses?") && response.url().includes("before=") && response.ok()),
    page.getByRole("button", { name: "加载更多" }).click(),
  ]);
  await expect(loadMoreResponse.json()).resolves.toMatchObject({ data: { items: [expect.objectContaining({ id: records[0].id })] } });
  await expect(sidebar.getByRole("link", { name: "首页" })).toBeVisible();
  await expect(page.getByRole("button", { name: "保存修改" })).toHaveCount(0);
  await expect(page.getByTestId(`expense-row-${records[0].id}`)).toBeVisible();

  const latestRow = page.getByTestId(`expense-row-${records[50].id}`);
  const list = page.getByTestId("expense-record-list");
  const listWidth = await list.evaluate((element) => element.getBoundingClientRect().width);
  const latestRowButton = latestRow.locator(":scope > button");
  await latestRowButton.click();
  await expect(latestRow.getByTestId("expense-detail-panel")).toContainText("保存修改");
  await expect(page.getByTestId("expense-detail-panel")).toHaveCount(1);
  await expect(latestRow.getByTestId("expense-detail-panel")).toBeVisible();
  await expect(latestRow.getByTestId("expense-detail-panel").getByText("更多信息", { exact: true })).toBeVisible();
  await expect(latestRow.getByTestId("expense-detail-panel").locator("details")).not.toHaveAttribute("open", "");
  await expect(latestRow.getByTestId("expense-detail-panel").getByRole("button", { name: "关闭详情" })).toHaveCount(0);
  const compactDetailGeometry = await latestRow.getByTestId("expense-detail-panel").evaluate((element) => ({
    height: element.getBoundingClientRect().height,
    viewportHeight: window.innerHeight,
  }));
  expect(compactDetailGeometry.viewportHeight).toBe(900);
  expect(compactDetailGeometry.height).toBeLessThan(500);
  await expect(latestRow.getByTestId("expense-detail-panel").getByLabel("金额")).toBeVisible();
  await expect(latestRow.getByTestId("expense-detail-panel").getByLabel("发生时间")).toBeVisible();
  await expect(latestRow.getByTestId("expense-detail-panel").getByLabel("分类")).toBeVisible();
  await expect(latestRow.getByTestId("expense-detail-panel").getByLabel("支付方式")).toBeVisible();
  await expect(latestRow.getByTestId("expense-detail-panel").getByRole("button", { name: "保存修改" })).toBeVisible();
  await expect.poll(async () => list.evaluate((element) => element.getBoundingClientRect().width)).toBe(listWidth);
  await expect.poll(() => topBar.evaluate((element) => element.getBoundingClientRect().top)).toBe(0);
  await expect.poll(() => sidebar.evaluate((element) => element.getBoundingClientRect().top)).toBe(56);

  await latestRowButton.click();
  await expect(page.getByTestId("expense-detail-panel")).toHaveCount(0);

  const previousRow = page.getByTestId(`expense-row-${records[1].id}`);
  await previousRow.scrollIntoViewIfNeeded();
  const scrollTopBeforeSwitch = await mainContent.evaluate((element) => element.scrollTop);
  await previousRow.locator(":scope > button").click();
  await expect.poll(() => mainContent.evaluate((element) => element.scrollTop)).toBe(scrollTopBeforeSwitch);
  await expect(previousRow.getByTestId("expense-detail-panel")).toBeVisible();
  await expect(latestRow.getByTestId("expense-detail-panel")).toHaveCount(0);
  await expect(page.getByTestId("expense-detail-panel")).toHaveCount(1);

  const scrollTopBeforeCollapse = await mainContent.evaluate((element) => element.scrollTop);
  await previousRow.locator(":scope > button").click();
  await expect.poll(() => mainContent.evaluate((element) => element.scrollTop)).toBe(scrollTopBeforeCollapse);
  await expect(page.getByTestId("expense-detail-panel")).toHaveCount(0);

  await page.goto("/expenses");
  await expect(page.getByTestId(`expense-row-${records[0].id}`)).toHaveCount(0);
  await expect(page.getByTestId(`expense-row-${records[50].id}`)).toBeVisible();
  await expect(page.getByText(/第 \d+ \/ \d+ 页/)).toHaveCount(0);
});

test("expenses overview pins the active natural-day section header to the main scroll container", async ({ page }) => {
  const username = unique("expense-sticky-history");
  await page.setViewportSize({ width: 1440, height: 900 });
  await registerUser(page, username);

  const apiKey = await createApiKey(page, "历史浏览");
  const records = [
    ...Array.from({ length: 12 }, (_, index) => ({
      date: "2026-08-31",
      time: `${String(11 - Math.floor(index / 2)).padStart(2, "0")}:${index % 2 === 0 ? "30" : "00"}`,
      label: `较新记录 ${index + 1}`,
    })),
    ...Array.from({ length: 12 }, (_, index) => ({
      date: "2026-08-30",
      time: `${String(11 - Math.floor(index / 2)).padStart(2, "0")}:${index % 2 === 0 ? "30" : "00"}`,
      label: `较早记录 ${index + 1}`,
    })),
  ];

  for (const record of records) {
    const response = await page.request.post("/api/v1/expenses/capture", {
      headers: { authorization: `Bearer ${apiKey}` },
      data: {
        id: randomUUID(),
        amount_cents: 1000,
        occurred_at: `${record.date}T${record.time}:00+08:00`,
        capture_message: record.label,
      },
    });
    expect(response.status()).toBe(201);
  }

  await page.goto("/expenses");
  const mainContent = page.locator("#main-content");
  const newerGroup = page.getByTestId("expense-date-group-2026-08-31");
  const olderGroup = page.getByTestId("expense-date-group-2026-08-30");
  const newerHeader = newerGroup.locator(":scope > div");
  const olderHeader = olderGroup.locator(":scope > div");

  await expect(newerHeader).toContainText("8 月 31 日");
  await expect(newerHeader).toContainText("12 笔");
  await expect(olderHeader).toContainText("8 月 30 日");
  await expect(olderHeader).toContainText("12 笔");
  await expect(newerHeader.evaluate((element) => getComputedStyle(element).position)).resolves.toBe("sticky");
  await expect(newerHeader.evaluate((element) => getComputedStyle(element).top)).resolves.toBe("0px");

  await mainContent.evaluate((element) => {
    element.scrollTop = 500;
  });
  await expect.poll(() => newerHeader.evaluate((element) => Math.round(element.getBoundingClientRect().top))).toBe(56);

  await mainContent.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await expect.poll(() => olderHeader.evaluate((element) => Math.round(element.getBoundingClientRect().top))).toBe(56);
  await expect.poll(() => newerHeader.evaluate((element) => Math.round(element.getBoundingClientRect().bottom))).toBeLessThan(56);
});

test("mobile inbox actions remain clickable and keep navigation stable", async ({ page }) => {
  const username = unique("expense-mobile");
  await page.setViewportSize({ width: 390, height: 844 });
  await registerUser(page, username);

  const apiKey = await createApiKey(page, "移动端快捷指令");
  await captureExpense(page, apiKey, 880, "早餐");

  await page.goto("/inbox");
  const panel = page.getByTestId("expense-detail-panel");
  await expect(panel.getByRole("button", { name: "保存修改" })).toBeVisible();
  await expect(panel.getByRole("button", { name: "保存并标记已整理" })).toBeVisible();
  await expect(panel.getByRole("button", { name: "跳过" })).toBeVisible();

  await panel.getByRole("button", { name: "保存并标记已整理" }).click();
  await expect(page.getByTestId("expense-record-list")).toContainText("Inbox 已清空");
});
