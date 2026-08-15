import { expect, test } from "@playwright/test";

const unique = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const shanghaiDateKey = () => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: string) => Number(parts.find((item) => item.type === type)?.value ?? 0);
  return new Date(Date.UTC(part("year"), part("month") - 1, part("day"))).toISOString().slice(0, 10);
};

const shiftDateKey = (dateKey: string, days: number) => {
  const date = new Date(`${dateKey}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

const shanghaiWeekStart = () => {
  const today = new Date(`${shanghaiDateKey()}T00:00:00Z`);
  const weekday = today.getUTCDay() || 7;
  today.setUTCDate(today.getUTCDate() - weekday + 1);
  return today.toISOString().slice(0, 10);
};

test("weekly review compares last week with this week and reads older weeks without creating plans", async ({ page }) => {
  const username = unique("weekly-review");
  const currentWeekStart = shanghaiWeekStart();
  const previousWeekStart = shiftDateKey(currentWeekStart, -7);
  const olderWeekStart = shiftDateKey(currentWeekStart, -14);

  await page.goto("/register");
  await page.getByLabel("账号").fill(username);
  await page.getByLabel("密码", { exact: true }).fill("password123");
  await page.getByLabel("确认密码").fill("password123");
  await page.getByRole("button", { name: "完成注册并进入" }).click();

  await page.getByRole("link", { name: "周复盘", exact: true }).click();
  await expect(page.getByRole("heading", { name: "上周复盘" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "本周进展" })).toBeVisible();
  await expect(page.getByLabel("复盘周起始日")).toHaveValue(previousWeekStart);
  await expect(page.getByText("该周未建立计划；统计按实际专注记录计算，已关联投入仅统计计划内条目。")).toBeVisible();
  // 无计划的历史周仍应展示统计指标，仅计划完成度退化为占位。
  await expect(page.getByText("总专注", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("未关联投入", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("没有条目实际结转到下一周。")).toBeVisible();

  const olderWeekRequest = page.waitForResponse((response) =>
    response.request().method() === "GET" &&
    response.url().includes(`/api/v1/week-plans/${olderWeekStart}?create=false`) &&
    response.status() === 200
  );
  await page.getByRole("button", { name: "上一周" }).click();
  await olderWeekRequest;
  await expect(page.getByRole("heading", { name: `${olderWeekStart} 周度回顾` })).toBeVisible();
  await expect(page.getByRole("heading", { name: "下一周进展" })).toBeVisible();
  await expect(page.getByLabel("复盘周起始日")).toHaveValue(olderWeekStart);

  await page.getByRole("button", { name: "下一周" }).click();
  await expect(page.getByRole("heading", { name: "上周复盘" })).toBeVisible();
});
