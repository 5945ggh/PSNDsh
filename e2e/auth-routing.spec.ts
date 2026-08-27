import { expect, test } from "@playwright/test";

test("anonymous root navigation completes and redirects to login", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByText("正在恢复工作台...")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "进入工作台" })).toBeVisible();
});
