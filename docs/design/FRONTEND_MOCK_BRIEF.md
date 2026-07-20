# 前端样例设计任务书

> 用途：交给独立前端 Agent，产出使用 mock 数据和 mock 接口的可操作样例。  
> 状态：Ready for mock design  
> 产品语义以 [PRD](../product/PRD.md) 为准，设计约束以 [DESIGN.md](../../DESIGN.md) 为准。

## 1. 任务目标

设计并实现一个可操作的前端样例，验证个人面板的信息架构、页面关系、视觉语言和核心交互。样例不连接真实数据库、不实现真实认证、不抓取真实天气或名句；所有接口使用本地 mock，但交互状态需要像真实应用一样完整。

该样例最终会作为正式实现的风格与思想参考，不要求后续逐像素复刻。设计者应主动提出连贯的产品体验，而不是把 PRD 字段机械排成表单。

## 2. 必读上下文

1. [产品需求 PRD](../product/PRD.md)
2. [设计契约 DESIGN.md](../../DESIGN.md)
3. [技术设计](../architecture/TECHNICAL_DESIGN.md)，重点阅读领域不变量与 API 边界

发生冲突时优先遵循 PRD。前端样例可以提出改进建议，但不得静默改变领域语义。

## 3. 设计对象与核心心智模型

产品由四类信息组成：

```text
意图：条目树、本周计划、截止日期
背景：课程、计划和其他日程块
事实：真实发生的专注会话与片段
解释：直接投入、递归聚合、未关联和时间趋势
```

关键约束：

- “待办”和“持续方向”不是两套数据库对象；它们是统一条目的不同行为。
- 所有条目都可承接专注；专注也可暂不关联。
- 日程与专注允许重叠，不自动表示冲突。
- 专注之间不能重叠。
- 父节点的聚合投入包含自身直接投入和全部后代直接投入。
- 专注片段完整覆盖会话，未分配区间属于未关联。
- 用户可以先记录事实，稍后再分类。

## 4. 目标体验

样例应让用户自然完成以下一天：

1. 早晨打开首页，看见今天课程、重要待办、临期提醒、天气与本周投入。
2. 从全局入口开始一次无归属专注。
3. 结束时直接保存，或填写成果并把 90 分钟拆给两个条目。
4. 在周历中看见课程与刚才的专注并行出现，即使二者重叠。
5. 完成一个作业，创建一个新条目，将长期方向继续保留在本周。
6. 晚上从统计页看到当天和本周的时间去向。
7. 新周到来时理解哪些条目由上周自动结转。

## 5. 必做页面

### 5.1 注册与登录

- 登录页：账号、密码、登录、注册入口是否可用。
- 注册页：账号、密码、确认密码；不出现昵称和邮箱。
- 注册关闭态：没有注册入口；直接到达注册页时显示简洁不可用状态和返回登录。
- 不要制作营销落地页，应用入口直接是登录或已登录首页。

### 5.2 首页

- 昵称欢迎、日期、时间、天气和季节名句。
- 当前或下一项日程。
- 当前活动专注；无活动时提供明确开始入口。
- 今日未完成条目、临期与逾期提醒。
- 今日专注总时长与本周简要趋势。
- 展示天气加载、旧缓存和不可用状态，但不要让外部信息占据首屏主导。

### 5.3 计划

- 本周计划与全局条目树之间关系清楚。
- 条目支持层级、展开、状态、完成模式、截止日期、直接和聚合投入。
- 支持快速创建顶层条目、子条目和加入本周。
- 支持完成、暂停、归档、移动和从本周移除。
- 历史周可切换，并能看见“自动结转”来源。
- 提供一处周备注，保留原 Markdown 工作流的自由批注感。

### 5.4 条目详情

- 标题、描述、完成模式、状态、截止日期、父节点。
- 子条目列表。
- 直接投入与聚合投入。
- 相关专注时间线。
- 从该条目开始专注。
- 归档与永久删除需要明确区分。

### 5.5 专注流程

- 全局开始：可先不选择条目。
- 活动状态：稳定显示计时、开始时间、当前归属、结束操作。
- 结束：可以直接保存；备注、成果和拆分是渐进展开的能力。
- 拆分：可把一个连续会话切成若干完整覆盖的片段，每片选择条目或未关联。
- 补录：从日历空白处或专门入口填写开始、结束、内容与归属。
- 重叠错误：明确指出冲突区间并保留用户输入。

### 5.6 日历

- 桌面完整周视图；手机提供实际可用的日视图或周切换方案。
- 日程与专注使用不同视觉语义或轨道。
- 显示课程与专注重叠、两个日程重叠、未关联专注、跨日专注。
- 点击或触摸事件可查看和编辑。
- 支持新增单次或重复日程，以及 ICS 导入入口和预览状态。

### 5.7 统计

- 日、周、月尺度切换。
- 总专注、未关联、按顶层条目分布、每日趋势。
- 条目树下钻时同时显示直接投入与聚合投入。
- 图表必须有可读数值或列表补充，不能只靠颜色。

### 5.8 设置

- 查看不可编辑账号。
- 修改昵称。
- 设置或清空邮箱，表达“不验证、不用于找回密码”。
- 数据管理入口可展示 JSON 导出和备份说明，但样例不需要真正生成文件。
- 不显示注册开关；它只由部署环境变量控制。
- 未实现的 Agent、界面偏好等分区不要放禁用假控件。

## 6. 全局导航与状态

- 登录后一级导航固定为：首页、计划、日历、统计、设置。
- 活动计时器在所有主要页面持续可见，并能快速结束。
- 全局计时器不能因路由切换重置，也不能用会导致布局跳动的宽度变化展示秒数。
- 桌面与手机可以采用不同导航形态，但信息架构保持一致。

## 7. Mock 接口约定

前端样例可以使用 MSW、框架内 mock service 或本地内存适配器。不要把数据直接散落在组件内部；页面应通过下列接口形状读取，使后续替换真实服务更容易。

### 7.1 通用错误

```ts
type ApiError = {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
};
```

### 7.2 实例能力

```ts
GET /api/v1/capabilities

type Capabilities = {
  registration: {
    available: boolean;
  };
  effectiveTimezone: "Asia/Shanghai" | string;
  features: {
    weather: boolean;
    quotation: boolean;
    icsImport: boolean;
  };
};
```

匿名响应只给出当前是否允许注册，不给出部署策略或已有账号数量。不同 `REGISTRATION_MODE` 由 mock 场景配置映射成 `available`。

### 7.3 认证动作

前端样例通过集中 auth mock adapter 调用下列动作。正式实现可由认证库映射到不同内部路径，但页面不应直接伪造登录状态。

```ts
POST /api/auth/register
type RegisterInput = {
  username: string;
  password: string;
  passwordConfirmation: string;
};

POST /api/auth/login
type LoginInput = {
  username: string;
  password: string;
};

POST /api/auth/logout
GET /api/auth/session

type AuthSession = {
  user: UserProfile | null;
};
```

必须提供以下 mock 错误：

- `REGISTRATION_CLOSED`：注册策略当前不允许注册。
- `USERNAME_TAKEN`：账号已存在。
- `PASSWORD_TOO_WEAK`：密码未达到服务端规则。
- `PASSWORD_MISMATCH`：两次输入不一致。
- `INVALID_CREDENTIALS`：账号或密码不正确，不进一步泄露是哪一项错误。

### 7.4 当前用户

```ts
GET /api/v1/me
PATCH /api/v1/me

type UserProfile = {
  id: string;
  username: string;
  nickname: string | null;
  email: string | null;
};
```

### 7.5 条目

```ts
type Entry = {
  id: string;
  parentId: string | null;
  title: string;
  description: string | null;
  completionMode: "ongoing" | "completable";
  status: "active" | "paused" | "completed" | "archived";
  dueAt: string | null;
  directFocusSeconds: number;
  aggregateFocusSeconds: number;
  sortKey: string;
};

GET /api/v1/entries?include=active,completed
POST /api/v1/entries
PATCH /api/v1/entries/:id
POST /api/v1/entries/:id/move
POST /api/v1/entries/:id/status
```

条目 API 可以返回扁平列表，由前端构树；mock 需要包含至少三层和长标题。

### 7.6 周计划

```ts
type WeekPlan = {
  weekStart: string; // YYYY-MM-DD in effectiveTimezone
  note: string;
  items: Array<{
    entryId: string;
    source: "manual" | "rollover";
    sortKey: string;
  }>;
};

GET /api/v1/week-plans/2026-06-22
PATCH /api/v1/week-plans/2026-06-22
POST /api/v1/week-plans/2026-06-22/items
DELETE /api/v1/week-plans/2026-06-22/items/:entryId
```

### 7.7 专注

```ts
type FocusSession = {
  id: string;
  startedAt: string;
  endedAt: string | null;
  captureMode: "timer" | "manual";
  note: string | null;
  outcome: string | null;
  segments: FocusSegment[];
};

type FocusSegment = {
  id: string;
  startedAt: string;
  endedAt: string;
  entryId: string | null;
  note: string | null;
};

GET /api/v1/focus/current
POST /api/v1/focus/current/start
POST /api/v1/focus/current/stop
POST /api/v1/focus/sessions
PUT /api/v1/focus/sessions/:id
PUT /api/v1/focus/sessions/:id/segments
```

样例需要 mock `FOCUS_ALREADY_ACTIVE`、`FOCUS_OVERLAP` 和 `SEGMENTS_INVALID_PARTITION` 三类错误。

### 7.8 日程与日历

```ts
type ScheduleRecurrence = null | {
  frequency: "weekly";
  interval: number;
  weekdays: Array<"MO" | "TU" | "WE" | "TH" | "FR" | "SA" | "SU">;
  until: string | null;
};

type ScheduleBlock = {
  id: string;
  kind: "course" | "plan" | "other";
  title: string;
  startedAt: string;
  endedAt: string;
  location: string | null;
  colorKey: string | null;
  recurrence: ScheduleRecurrence;
  recurrenceLabel: string | null;
};

type ScheduleBlockInput = {
  kind: "course" | "plan" | "other";
  title: string;
  startedAt: string;
  endedAt: string;
  location: string | null;
  colorKey: string | null;
  recurrence: ScheduleRecurrence;
};

POST /api/v1/schedule-blocks
PATCH /api/v1/schedule-blocks/:id
DELETE /api/v1/schedule-blocks/:id

GET /api/v1/calendar?from=...&to=...

type CalendarPayload = {
  scheduleBlocks: ScheduleBlock[];
  focusSessions: FocusSession[];
};
```

ICS 导入使用预览再确认的两阶段 mock，避免选择文件后直接写入：

```ts
POST /api/v1/schedule-blocks/imports/ics/preview

type IcsImportPreview = {
  importId: string;
  fileName: string;
  rows: Array<{
    sourceUid: string;
    title: string;
    startedAt: string;
    endedAt: string;
    recurrenceLabel: string | null;
    selected: boolean;
    warnings: string[];
  }>;
  errors: Array<{
    sourceUid: string | null;
    message: string;
  }>;
};

POST /api/v1/schedule-blocks/imports/ics/:importId/confirm
type IcsImportConfirmInput = {
  selectedSourceUids: string[];
};
```

mock 至少提供：正常课程表、部分条目带警告、无法解析文件和确认时预览已过期四种状态；对应错误码为 `ICS_PARSE_FAILED` 与 `ICS_PREVIEW_EXPIRED`。样例不必实现真实 ICS 解析，可以由选择的 fixture 返回预览数据。

### 7.9 首页

```ts
GET /api/v1/dashboard?date=2026-06-26

type DashboardPayload = {
  profile: UserProfile;
  now: string;
  nextSchedule: ScheduleBlock | null;
  activeFocus: FocusSession | null;
  todayEntries: Entry[];
  deadlineEntries: Entry[];
  focusSummary: {
    todaySeconds: number;
    weekSeconds: number;
    dailySeconds: Array<{ date: string; seconds: number }>;
  };
  weather: {
    status: "fresh" | "stale" | "unavailable";
    temperatureC?: number;
    summary?: string;
    observedAt?: string;
  };
  quotation: {
    text: string;
    author: string;
    work: string;
    source: "cache" | "builtin";
  };
};
```

### 7.10 统计

```ts
GET /api/v1/statistics?from=...&to=...&groupBy=day

type StatisticsPayload = {
  totalSeconds: number;
  unassignedSeconds: number;
  daily: Array<{ date: string; seconds: number }>;
  roots: Array<{
    entryId: string;
    directSeconds: number;
    aggregateSeconds: number;
  }>;
};
```

## 8. 建议 Mock 数据

使用贴近实际的中文内容，不用 `Task 1`、`Lorem ipsum` 等占位符。

### 条目树

```text
ICS2（持续型，活跃）
  OSTEP 阅读与梳理（可完成型）
    IO & Files 36, 37, 38, 44（活跃）
    FS 39, 40, 41, 42（活跃）
  hw 8（已完成）
  hw 9（已完成）
  Lab 4 - LockLab（临期）
    完成锁实现与测试（活跃）

人工智能伦理与安全（持续型）
  期末论文（逾期或临期，含长备注）

学日语（持续型，无具体待办也合法）

其他
  GitHub 探索
    OpenViking / EverOS - 智能体记忆
  公安备案（无截止日期）
```

### 同一周日程与专注

- 周一、周三 `08:00–09:35`：ICS2 课程。
- 周五 `10:00–11:35`：人工智能伦理与安全。
- 周三 `08:20–09:05`：专注“阅读 OSTEP”，与课程重叠。
- 周三 `14:00–15:30`：一个会话，40 分钟归属学日语、50 分钟归属 Lab 4。
- 周四 `23:30–00:30`：跨日未关联专注。
- 当前活动计时：从 25 分钟前开始，无归属。

### 状态覆盖

- 一个逾期条目、两个临期条目、一个已完成条目、一个暂停持续方向、一个归档父节点。
- 一个天气新鲜态、一个旧缓存态和一个不可用态切换入口。
- 注册能力的 `first-user available`、`first-user unavailable`、`open` 和 `closed` 四种 mock 场景。
- 空白新用户场景：没有条目、日程或专注。

## 9. 视觉与交互要求

- 这是一款高频个人工具，视觉应安静、实用、适合扫描，不做营销式 hero 或说明性落地页。
- 不把每个页面区块都包成悬浮卡片；禁止卡片套卡片。
- 日程与专注必须一眼可区分，逾期与完成不能只靠颜色。
- 图标按钮优先使用 Lucide，并提供可访问名称或 tooltip。
- 数字计时器、周历网格、树缩进和图表区域必须具有稳定尺寸，不因内容变化跳动。
- 不用紫蓝渐变、米色、深蓝灰或单一色系统治整个产品。
- 页面内文案直接表达信息和操作，不堆砌功能介绍、快捷键说明或设计说明。
- 长中文标题、英文课程名、时间、徽标和按钮在 390px 与 1440px 下不得重叠或溢出。

前端 Agent可以提出一套自己的设计系统，但需说明它如何服务“安静、清醒、可解释、长期使用”的产品个性。

## 10. 交付物

- 可运行的前端样例，使用 mock service，不依赖真实后端。
- 上述必做页面和核心流程均可操作，不只是静态截图。
- 桌面 `1440x900` 与手机 `390x844` 的关键页面截图。
- 一份简短设计说明：导航、视觉 token、组件体系、日历重叠方案、专注拆分方案和移动端适配。
- mock 数据与接口集中维护，可切换加载、空、错误、注册关闭、天气降级和活动计时状态。
- 记录所有有意偏离 PRD 或本任务书的地方及理由。

## 11. 样例验收

- 用户能够从首页开始无归属专注并在任意页面看见活动状态。
- 用户能够结束 90 分钟专注并把完整时间拆分给两个条目或未关联。
- 用户能够理解统一条目树、本周计划和自动结转之间的区别。
- 周历在桌面与手机上均能解释计划、课程和实际专注，重叠内容可操作。
- 统计界面区分直接投入、聚合投入和未关联，不产生重复总计。
- 设置页只包含真实可用的个人资料和数据管理入口，不暴露注册环境开关。
- 样例包含完整加载、空、错误、禁用和外部服务降级状态。
- 视觉方案符合根 `DESIGN.md`，同时留下足够明确的 token 和组件思想供正式实现吸收。
