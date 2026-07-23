import { expect, test } from "@playwright/test";

const unique = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${process.env.PLAYWRIGHT_PORT ?? "3100"}`;

const shanghaiDateKey = (offsetDays = 0) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: string) => Number(parts.find((item) => item.type === type)?.value ?? 0);
  const value = new Date(Date.UTC(part("year"), part("month") - 1, part("day") + offsetDays));
  return value.toISOString().slice(0, 10);
};

test("real session persists profile changes and protects dashboard after logout", async ({ page }) => {
  const username = unique("profile");
  const quickEntryTitle = unique("首页快速条目");

  await page.goto("/register");
  await page.getByLabel("账号").fill(username);
  await page.getByLabel("密码", { exact: true }).fill("password123");
  await page.getByLabel("确认密码").fill("password123");
  await page.getByRole("button", { name: "完成注册并进入" }).click();
  await expect(page).toHaveURL(/\/$/);

  await page.getByRole("button", { name: "新建本周条目" }).click();
  const dashboardCreateDialog = page.getByRole("dialog", { name: "新建本周条目" });
  await dashboardCreateDialog.getByLabel("条目标题").fill(quickEntryTitle);
  await dashboardCreateDialog.getByRole("button", { name: "创建并加入本周" }).click();
  await expect(page.getByText(quickEntryTitle, { exact: true })).toBeVisible();

  await page.getByRole("link", { name: "设置" }).click();
  await page.getByLabel(/显示昵称/).fill("持久化昵称");
  await page.getByLabel(/绑定邮箱/).fill("persistent@example.com");
  await page.getByRole("button", { name: "保存资料修改" }).click();
  await expect(page.getByLabel(/显示昵称/)).toHaveValue("持久化昵称");

  await page.reload();
  await expect(page.getByLabel(/绑定邮箱/)).toHaveValue("persistent@example.com");
  const exportResponse = await page.request.get("/api/v1/export");
  expect(exportResponse.status()).toBe(200);
  expect(exportResponse.headers()["content-disposition"]).toContain("attachment; filename=\"personal-dashboard-export-");
  const exported = (await exportResponse.json()).data;
  expect(exported).toMatchObject({ schemaVersion: "1.0", profile: { username } });
  expect(JSON.stringify(exported)).not.toContain("passwordHash");
  await page.getByRole("button", { name: "退出登录" }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect((await page.request.get("/api/v1/me")).status()).toBe(401);
  expect((await page.request.get("/api/v1/export")).status()).toBe(401);
});

test("entry, week plan, active focus refresh recovery, and session ownership use persistent API", async ({ page, browser }) => {
  const usernameA = unique("owner");
  const password = "password123";
  const entryTitle = unique("真实条目");

  await page.goto("/register");
  await page.getByLabel("账号").fill(usernameA);
  await page.getByLabel("密码", { exact: true }).fill(password);
  await page.getByLabel("确认密码").fill(password);
  await page.getByRole("button", { name: "完成注册并进入" }).click();
  await page.getByRole("link", { name: "计划", exact: true }).click();
  await page.getByRole("button", { name: "新建顶层条目" }).click();
  const createDialog = page.getByRole("dialog", { name: "新建顶层条目" });
  await createDialog.getByLabel("条目标题").fill(entryTitle);
  await createDialog.getByLabel("描述 / 备注").fill("用于搜索和日常计划验证");
  let releaseBackgroundDashboardRequest!: () => void;
  let finishBackgroundDashboardRequest: (() => void) | null = null;
  const backgroundDashboardRequestFinished = new Promise<void>((resolve) => {
    finishBackgroundDashboardRequest = resolve;
  });
  await page.route("**/api/v1/dashboard", async (route) => {
    await new Promise<void>((resolve) => {
      releaseBackgroundDashboardRequest = resolve;
    });
    await route.continue();
    finishBackgroundDashboardRequest?.();
  });
  await createDialog.getByRole("button", { name: "创建条目" }).click();
  await expect(page.getByText(entryTitle, { exact: true })).toBeVisible();
  await page.getByPlaceholder("搜索条目标题或描述…").fill("日常计划");
  await expect(page.getByText(entryTitle, { exact: true })).toBeVisible();
  await page.getByLabel("筛选条目").selectOption("unfinished");
  await expect(page.getByText(entryTitle, { exact: true })).toBeVisible();
  await page.getByPlaceholder("搜索条目标题或描述…").fill("");
  await page.getByLabel("筛选条目").selectOption("all");
  await expect(page.getByText("正在恢复工作台...")).toHaveCount(0);
  releaseBackgroundDashboardRequest();
  await backgroundDashboardRequestFinished;
  await page.unroute("**/api/v1/dashboard");

  const row = page.getByText(entryTitle, { exact: true }).locator("..").locator("..");
  await row.getByLabel("加入本周计划").click();
  await expect(page.getByText("该周计划项 (1)")).toBeVisible();

  await page.getByRole("button", { name: "开始无归属专注" }).click();
  await expect(page.getByRole("button", { name: "结束当前专注" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "结束当前专注" })).toBeVisible();

  await page.getByRole("button", { name: "结束当前专注" }).click();
  const stopDialog = page.getByRole("dialog", { name: "结束本次专注" });
  await stopDialog.getByRole("checkbox").check();
  await stopDialog.getByLabel("片段 1 归属条目").selectOption({ label: entryTitle });
  await stopDialog.getByRole("button", { name: "保存记录" }).click();
  await expect(page.getByRole("button", { name: "开始无归属专注" })).toBeVisible();

  const ownerEntries = await page.request.get("/api/v1/entries");
  const ownerEntry = (await ownerEntries.json()).data.find((entry: { title: string }) => entry.title === entryTitle);
  expect(ownerEntry).toBeTruthy();

  page.once("dialog", (dialog) => dialog.accept());
  const entryRow = page.getByText(entryTitle, { exact: true }).locator("..").locator("..");
  await entryRow.getByLabel("删除条目").click();
  await expect(page.getByText(entryTitle, { exact: true })).toHaveCount(0);

  const contextB = await browser.newContext({ baseURL });
  const pageB = await contextB.newPage();
  const usernameB = unique("other");
  await pageB.goto("/register");
  await pageB.getByLabel("账号").fill(usernameB);
  await pageB.getByLabel("密码", { exact: true }).fill(password);
  await pageB.getByLabel("确认密码").fill(password);
  await pageB.getByRole("button", { name: "完成注册并进入" }).click();

  await expect(pageB.getByText(entryTitle, { exact: true })).toHaveCount(0);
  await contextB.close();
});

test("calendar creates, edits, persists, and deletes overlapping schedule and cross-day focus records", async ({ page }) => {
  const username = unique("calendar");
  const scheduleTitle = unique("重叠课程");
  const updatedScheduleTitle = `${scheduleTitle}-已编辑`;
  const today = shanghaiDateKey();
  const tomorrow = shanghaiDateKey(1);

  await page.goto("/register");
  await page.getByLabel("账号").fill(username);
  await page.getByLabel("密码", { exact: true }).fill("password123");
  await page.getByLabel("确认密码").fill("password123");
  await page.getByRole("button", { name: "完成注册并进入" }).click();
  await page.getByRole("link", { name: "日历", exact: true }).click();
  await expect(page.getByText(/至 .*日程与专注分别独立呈现/)).toBeVisible();
  const weekNavigation = page.getByLabel("周导航");
  await expect(weekNavigation.getByText("本周", { exact: true })).toHaveAttribute("aria-current", "date");
  await expect(weekNavigation.getByRole("button", { name: "返回本周" })).toHaveCount(0);
  await weekNavigation.getByRole("button", { name: "下一周" }).click();
  await expect(weekNavigation.getByRole("button", { name: "返回本周" })).toBeVisible();
  await weekNavigation.getByRole("button", { name: "返回本周" }).click();
  await expect(weekNavigation.getByText("本周", { exact: true })).toHaveAttribute("aria-current", "date");

  await page.getByRole("button", { name: "新增日程" }).click();
  const editor = page.getByRole("dialog", { name: "新增日程" });
  await editor.getByLabel("日程标题").fill(scheduleTitle);
  await editor.getByLabel("日程类型").selectOption("course");
  await editor.getByLabel("开始时间").fill(`${today}T23:45`);
  await editor.getByLabel("结束时间").fill(`${tomorrow}T00:15`);
  await editor.getByLabel("地点").fill("线上");
  await editor.getByLabel("颜色").selectOption("green");
  await editor.getByRole("button", { name: "保存日程" }).click();
  await expect(page.getByText(scheduleTitle, { exact: true }).first()).toBeVisible();

  await page.getByRole("button", { name: "补录专注", exact: true }).click();
  const focusEditor = page.getByRole("dialog", { name: "补录专注记录" });
  await focusEditor.getByLabel("开始日期").fill(today);
  await focusEditor.getByLabel("结束日期").fill(tomorrow);
  await focusEditor.getByLabel("开始时间").fill("23:30");
  await focusEditor.getByLabel("结束时间").fill("00:30");
  await focusEditor.getByRole("button", { name: "保存补录" }).click();
  await expect(page.getByTestId(`calendar-day-${today}`).getByText(scheduleTitle, { exact: true }).first()).toBeVisible();
  await expect(page.getByTestId(`calendar-day-${tomorrow}`).getByText(scheduleTitle, { exact: true }).first()).toBeVisible();
  await expect(page.getByTestId(`calendar-day-${today}`).getByText("未关联专注", { exact: true }).first()).toBeVisible();
  await expect(page.getByTestId(`calendar-day-${tomorrow}`).getByText("未关联专注", { exact: true }).first()).toBeVisible();

  const nextWeekResponse = page.waitForResponse((response) =>
    response.url().includes("/api/v1/calendar?from=") && response.status() === 200
  );
  await page.getByRole("button", { name: "下一周" }).click();
  await nextWeekResponse;
  await page.getByRole("button", { name: "返回本周" }).click();
  await expect(page.getByText(scheduleTitle, { exact: true }).first()).toBeVisible();

  await page.getByText(scheduleTitle, { exact: true }).first().click();
  await page.getByRole("button", { name: "编辑日程" }).click();
  const editEditor = page.getByRole("dialog", { name: "编辑日程" });
  await editEditor.getByLabel("日程标题").fill(updatedScheduleTitle);
  const updateResponse = page.waitForResponse((response) =>
    response.request().method() === "PATCH" && response.url().includes("/api/v1/schedule-blocks/")
  );
  await editEditor.getByRole("button", { name: "保存修改" }).click();
  expect((await updateResponse).status()).toBe(200);
  await page.reload();
  await expect(page.getByText(updatedScheduleTitle, { exact: true }).first()).toBeVisible();

  await page.getByText(updatedScheduleTitle, { exact: true }).first().click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "删除日程" }).click();
  await page.reload();
  await expect(page.getByText(updatedScheduleTitle, { exact: true })).toHaveCount(0);

  await page.getByRole("link", { name: "统计", exact: true }).click();
  const dayStatisticsResponse = page.waitForResponse((response) =>
    response.url().includes("/api/v1/statistics?scale=day") && response.status() === 200
  );
  await page.getByRole("button", { name: "日视图" }).click();
  await dayStatisticsResponse;
  await expect(page.getByText("总专注时长（今日）")).toBeVisible();
});

test("calendar imports an ICS preview into persistent schedules", async ({ page }) => {
  const username = unique("ics-import");
  const title = unique("ICS 导入课程");
  const today = shanghaiDateKey();

  await page.goto("/register");
  await page.getByLabel("账号").fill(username);
  await page.getByLabel("密码", { exact: true }).fill("password123");
  await page.getByLabel("确认密码").fill("password123");
  await page.getByRole("button", { name: "完成注册并进入" }).click();
  await page.getByRole("link", { name: "日历", exact: true }).click();

  await page.getByRole("button", { name: "导入日程表" }).click();
  const importDialog = page.getByRole("dialog", { name: "导入日程表" });
  await expect(importDialog).toBeVisible();
  const fileInput = importDialog.getByLabel("选择 .ics 日程表文件");
  await expect(fileInput).toHaveAttribute("accept", ".ics,text/calendar");
  await fileInput.setInputFiles({
    name: "schedule.ics",
    mimeType: "text/calendar",
    buffer: Buffer.from(`BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:playwright-ics-event
DTSTAMP:20260722T000000Z
DTSTART:${today.replaceAll("-", "")}T090000
DTEND:${today.replaceAll("-", "")}T100000
SUMMARY:${title}
END:VEVENT
END:VCALENDAR`),
  });
  const previewResponse = page.waitForResponse((response) =>
    response.request().method() === "POST" && response.url().includes("/schedule-blocks/imports/ics/preview")
  );
  await importDialog.getByRole("button", { name: "解析日程表预览" }).click();
  expect((await previewResponse).status()).toBe(200);
  await expect(importDialog.getByText(title, { exact: true })).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  const confirmResponse = page.waitForResponse((response) =>
    response.request().method() === "POST" && response.url().includes("/schedule-blocks/imports/ics/") && response.url().endsWith("/confirm")
  );
  await importDialog.getByRole("button", { name: /确认写入选中的 1 项日程/ }).click();
  expect((await confirmResponse).status()).toBe(201);
  await expect(page.getByText(title, { exact: true }).first()).toBeVisible();

  const importedSchedules = await page.request.get("/api/v1/schedule-blocks");
  expect(importedSchedules.status()).toBe(200);
  const importedScheduleData = (await importedSchedules.json()).data;
  expect(importedScheduleData.filter((item: { title: string }) => item.title === title)).toHaveLength(1);

  await page.getByRole("button", { name: "导入日程表" }).click();
  const duplicateImportDialog = page.getByRole("dialog", { name: "导入日程表" });
  await duplicateImportDialog.getByLabel("选择 .ics 日程表文件").setInputFiles({
    name: "schedule.ics",
    mimeType: "text/calendar",
    buffer: Buffer.from(`BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:playwright-ics-event
DTSTAMP:20260722T000000Z
DTSTART:${today.replaceAll("-", "")}T090000
DTEND:${today.replaceAll("-", "")}T100000
SUMMARY:${title}
LOCATION:教室 A
DESCRIPTION:重复导入检查
END:VEVENT
END:VCALENDAR`),
  });
  await duplicateImportDialog.getByRole("button", { name: "解析日程表预览" }).click();
  await expect(duplicateImportDialog.getByText(/已存在 1 个同源实例/)).toBeVisible();
  await expect(duplicateImportDialog.getByRole("button", { name: "确认写入选中的 0 项日程" })).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await duplicateImportDialog.getByRole("button", { name: "确认写入选中的 0 项日程" }).click();

  const importsResponse = await page.request.get("/api/v1/schedule-blocks/imports");
  expect(importsResponse.status()).toBe(200);
  const imports = (await importsResponse.json()).data;
  expect(imports).toHaveLength(1);
  expect(imports[0].blockCount).toBe(1);

  const contextB = await page.context().browser()?.newContext({ baseURL });
  expect(contextB).toBeTruthy();
  const pageB = await contextB!.newPage();
  await pageB.goto("/register");
  await pageB.getByLabel("账号").fill(unique("ics-other"));
  await pageB.getByLabel("密码", { exact: true }).fill("password123");
  await pageB.getByLabel("确认密码").fill("password123");
  await pageB.getByRole("button", { name: "完成注册并进入" }).click();
  await expect(pageB).toHaveURL(/\/$/);
  const otherImportsResponse = await pageB.request.get("/api/v1/schedule-blocks/imports");
  expect(otherImportsResponse.status()).toBe(200);
  expect((await otherImportsResponse.json()).data).toHaveLength(0);
  expect((await pageB.request.delete(`/api/v1/schedule-blocks/imports/${imports[0].id}`, {
    headers: { origin: baseURL, "x-pd-same-origin": "1" },
  })).status()).toBe(404);
  await contextB!.close();

  await page.getByRole("button", { name: "管理导入批次" }).click();
  const manager = page.getByRole("dialog", { name: "已导入的日程批次" });
  await expect(manager.getByText("schedule.ics", { exact: true })).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await manager.getByRole("button", { name: "删除 schedule.ics 导入批次" }).click();
  await expect(manager.getByText("当前账号还没有可管理的 ICS 导入批次。", { exact: true })).toBeVisible();
  const schedulesAfterDelete = await page.request.get("/api/v1/schedule-blocks");
  expect((await schedulesAfterDelete.json()).data).toHaveLength(0);
});

test("calendar saves, previews, reapplies, and removes a reusable schedule template", async ({ page }) => {
  const username = unique("template");
  const templateName = unique("假期作息");
  const weekdayTitle = unique("工作日学习");
  const weekendTitle = unique("周末娱乐");
  const fromDate = shanghaiDateKey();
  const toDate = shanghaiDateKey(6);

  await page.goto("/register");
  await page.getByLabel("账号").fill(username);
  await page.getByLabel("密码", { exact: true }).fill("password123");
  await page.getByLabel("确认密码").fill("password123");
  await page.getByRole("button", { name: "完成注册并进入" }).click();
  await page.getByRole("link", { name: "日历", exact: true }).click();
  await page.getByRole("button", { name: "作息模板" }).click();
  const manager = page.getByRole("dialog", { name: "可复用作息模板" });
  await manager.getByLabel("模板名称").fill(templateName);
  await manager.getByPlaceholder("日程标题").first().fill(weekdayTitle);
  await manager.getByRole("button", { name: "添加规则" }).click();
  const rules = manager.locator(".border-zinc-200.p-3");
  await rules.nth(1).getByPlaceholder("日程标题").fill(weekendTitle);
  await rules.nth(1).getByRole("button", { name: "周末" }).click();
  await rules.nth(1).getByLabel("开始").fill("23:30");
  await rules.nth(1).getByLabel("结束").fill("00:30");
  await manager.getByRole("button", { name: "保存模板" }).click();
  await expect(manager.getByRole("button", { name: templateName })).toBeVisible();

  await manager.getByLabel("开始日期").fill(fromDate);
  await manager.getByLabel("结束日期").fill(toDate);
  const previewResponse = page.waitForResponse((response) =>
    response.request().method() === "POST" && response.url().includes("/schedule-templates/") && response.url().endsWith("/preview")
  );
  await manager.getByRole("button", { name: "预览" }).click();
  expect((await previewResponse).status()).toBe(200);
  await expect(manager.getByText(/将生成 7 项日程/)).toBeVisible();

  const applyResponse = page.waitForResponse((response) =>
    response.request().method() === "POST" && response.url().includes("/schedule-templates/") && response.url().endsWith("/apply")
  );
  await manager.getByRole("button", { name: "确认应用" }).click();
  expect((await applyResponse).status()).toBe(201);
  await expect(manager.getByText(new RegExp(`${templateName}.*7 项`))).toBeVisible();
  await manager.getByRole("button", { name: "关闭", exact: true }).click();
  await expect(page.getByText(weekdayTitle, { exact: true }).first()).toBeVisible();

  await page.getByRole("button", { name: "作息模板" }).click();
  const reopened = page.getByRole("dialog", { name: "可复用作息模板" });
  await expect(reopened.getByRole("button", { name: templateName })).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await reopened.getByRole("button", { name: `删除 ${templateName} 应用批次` }).click();
  await expect(reopened.getByText("还没有模板应用批次。", { exact: true })).toBeVisible();
  const remainingSchedules = await page.request.get("/api/v1/schedule-blocks");
  expect((await remainingSchedules.json()).data.filter((item: { title: string }) => [weekdayTitle, weekendTitle].includes(item.title))).toHaveLength(0);
  expect((await page.request.get("/api/v1/schedule-templates")).status()).toBe(200);
  expect((await (await page.request.get("/api/v1/schedule-templates")).json()).data).toEqual(expect.arrayContaining([expect.objectContaining({ name: templateName })]));
});

test("week notes render Markdown and remain stable after save", async ({ page }) => {
  const username = unique("week-note");
  const note = "## 本周重点\n- **完成** 日程回顾\n- 记录 `复盘`";

  await page.goto("/register");
  await page.getByLabel("账号").fill(username);
  await page.getByLabel("密码", { exact: true }).fill("password123");
  await page.getByLabel("确认密码").fill("password123");
  await page.getByRole("button", { name: "完成注册并进入" }).click();
  await page.getByRole("link", { name: "计划", exact: true }).click();

  await page.getByRole("button", { name: "编辑批注" }).click();
  await page.getByLabel("周备忘 Markdown 内容").fill(note);
  const noteSave = page.waitForResponse((response) =>
    response.request().method() === "POST" && response.url().includes("/api/v1/week-plans/")
  );
  await page.getByRole("button", { name: "保存批注" }).click();
  expect((await noteSave).status()).toBe(200);
  await expect(page.getByRole("button", { name: "编辑批注" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "本周重点" })).toBeVisible();
  await expect(page.locator("strong").getByText("完成", { exact: true })).toBeVisible();
  await expect(page.getByText("复盘", { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: "本周重点" })).toBeVisible();
  await expect(page.locator("strong").getByText("完成", { exact: true })).toBeVisible();
});
