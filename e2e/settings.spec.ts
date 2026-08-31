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

const createDimension = async (page: Page, path: string, name: string) => {
  const response = await page.request.post(path, {
    headers: { "x-pd-same-origin": "1", "content-type": "application/json" },
    data: { name },
  });
  expect(response.ok()).toBe(true);
};

test("expense fields use sibling tabs and one full-width management panel", async ({ page }) => {
  await registerUser(page, unique("settings"));
  await createDimension(page, "/api/v1/expenses/categories", "餐饮");
  await createDimension(page, "/api/v1/expenses/payment-methods", "微信支付");
  await createDimension(page, "/api/v1/expenses/tags", "工作日");

  await page.goto("/settings#expense-fields");

  const tablist = page.getByRole("tablist", { name: "账目字段类型" });
  const categoryTab = tablist.getByRole("tab", { name: "分类", exact: true });
  const paymentMethodTab = tablist.getByRole("tab", { name: "支付方式", exact: true });
  const tagTab = tablist.getByRole("tab", { name: "标签", exact: true });
  const panel = page.getByRole("tabpanel");

  await expect(categoryTab).toHaveAttribute("aria-selected", "true");
  await expect(paymentMethodTab).toHaveAttribute("aria-selected", "false");
  await expect(tagTab).toHaveAttribute("aria-selected", "false");
  await expect(panel).toContainText("餐饮");
  await expect(panel.getByRole("button", { name: "新建分类" })).toBeVisible();
  await expect(page.locator('[class*="xl:grid-cols-3"]')).toHaveCount(0);

  await paymentMethodTab.click();
  await expect(paymentMethodTab).toHaveAttribute("aria-selected", "true");
  await expect(panel).toContainText("微信支付");
  await expect(panel.getByRole("button", { name: "新建支付方式" })).toBeVisible();
  await expect(panel.getByRole("button", { name: "新建分类" })).toHaveCount(0);

  await tagTab.click();
  await expect(tagTab).toHaveAttribute("aria-selected", "true");
  await expect(panel).toContainText("工作日");
  await expect(panel.getByRole("button", { name: "新建标签" })).toBeVisible();
});
