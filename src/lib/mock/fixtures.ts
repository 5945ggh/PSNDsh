import {
  UserProfile,
  Entry,
  WeekPlan,
  FocusSession,
  ScheduleBlock,
  IcsImportPreview,
  Capabilities,
} from "@/types/mock";

export const MOCK_USER: UserProfile = {
  id: "usr_01",
  username: "ningcc",
  nickname: "Ning",
  email: "ningcc@example.com",
};

export const MOCK_CAPABILITIES_NORMAL: Capabilities = {
  registration: { available: true },
  effectiveTimezone: "Asia/Shanghai",
  features: {
    weather: true,
    quotation: true,
    icsImport: true,
  },
};

export const MOCK_CAPABILITIES_REG_CLOSED: Capabilities = {
  registration: { available: false },
  effectiveTimezone: "Asia/Shanghai",
  features: {
    weather: true,
    quotation: true,
    icsImport: true,
  },
};

// Standard Entries Tree (3 levels deep, realistic titles)
export const MOCK_ENTRIES_NORMAL: Entry[] = [
  // 1. ICS2 Branch
  {
    id: "entry_ics2",
    parentId: null,
    title: "ICS2",
    description: "计算机系统基础 (II) 课程与关联作业、实验",
    completionMode: "ongoing",
    status: "active",
    dueAt: null,
    directFocusSeconds: 0,
    aggregateFocusSeconds: 18900, // ~5.25h
    sortKey: "a1",
  },
  {
    id: "entry_ostep",
    parentId: "entry_ics2",
    title: "OSTEP 阅读与梳理",
    description: "Operating Systems: Three Easy Pieces 经典章节研读",
    completionMode: "completable",
    status: "active",
    dueAt: "2026-06-28T23:59:59+08:00",
    directFocusSeconds: 2700, // 45m
    aggregateFocusSeconds: 9900, // 2.75h
    sortKey: "a1-1",
  },
  {
    id: "entry_ostep_io",
    parentId: "entry_ostep",
    title: "IO & Files 36, 37, 38, 44",
    description: "文件系统接口与磁盘 I/O 驱动",
    completionMode: "completable",
    status: "active",
    dueAt: "2026-06-26T23:59:59+08:00",
    directFocusSeconds: 3600,
    aggregateFocusSeconds: 3600,
    sortKey: "a1-1-1",
  },
  {
    id: "entry_ostep_fs",
    parentId: "entry_ostep",
    title: "FS 39, 40, 41, 42",
    description: "Fast File System 与崩溃恢复机制",
    completionMode: "completable",
    status: "active",
    dueAt: "2026-06-29T23:59:59+08:00",
    directFocusSeconds: 3600,
    aggregateFocusSeconds: 3600,
    sortKey: "a1-1-2",
  },
  {
    id: "entry_hw8",
    parentId: "entry_ics2",
    title: "hw 8",
    description: "并发与信号量习题集",
    completionMode: "completable",
    status: "completed",
    dueAt: "2026-06-20T23:59:59+08:00",
    directFocusSeconds: 3600,
    aggregateFocusSeconds: 3600,
    sortKey: "a1-2",
  },
  {
    id: "entry_hw9",
    parentId: "entry_ics2",
    title: "hw 9",
    description: "虚存与 TLB 转换习题",
    completionMode: "completable",
    status: "completed",
    dueAt: "2026-06-24T23:59:59+08:00",
    directFocusSeconds: 2400,
    aggregateFocusSeconds: 2400,
    sortKey: "a1-3",
  },
  {
    id: "entry_lab4",
    parentId: "entry_ics2",
    title: "Lab 4 - LockLab",
    description: "实现自旋锁、读写锁与死锁检测逻辑",
    completionMode: "completable",
    status: "active",
    dueAt: "2026-06-27T23:59:59+08:00", // 临期
    directFocusSeconds: 0,
    aggregateFocusSeconds: 3000,
    sortKey: "a1-4",
  },
  {
    id: "entry_lab4_sub",
    parentId: "entry_lab4",
    title: "完成锁实现与测试",
    description: "通过所有锁压力测试与数据竞争检查",
    completionMode: "completable",
    status: "active",
    dueAt: "2026-06-27T18:00:00+08:00",
    directFocusSeconds: 3000,
    aggregateFocusSeconds: 3000,
    sortKey: "a1-4-1",
  },

  // 2. AI Ethics Branch
  {
    id: "entry_ai_ethics",
    parentId: null,
    title: "人工智能伦理与安全",
    description: "大模型对齐、对抗攻击与社会伦理考量",
    completionMode: "ongoing",
    status: "active",
    dueAt: null,
    directFocusSeconds: 0,
    aggregateFocusSeconds: 7200,
    sortKey: "a2",
  },
  {
    id: "entry_ai_paper",
    parentId: "entry_ai_ethics",
    title: "期末论文：基于自洽性的 LLM 安全防护边界研究",
    description: "需包含 10 篇近三年文献综述、实验对比及结论。格式遵循 IEEE Template。",
    completionMode: "completable",
    status: "active",
    dueAt: "2026-06-25T23:59:59+08:00", // 逾期
    directFocusSeconds: 7200,
    aggregateFocusSeconds: 7200,
    sortKey: "a2-1",
  },

  // 3. Japanese Language
  {
    id: "entry_japanese",
    parentId: null,
    title: "学日语",
    description: "日语 N2 听力与语法日常积累（无具体子待办也合法）",
    completionMode: "ongoing",
    status: "active",
    dueAt: null,
    directFocusSeconds: 2400,
    aggregateFocusSeconds: 2400,
    sortKey: "a3",
  },

  // 4. Other
  {
    id: "entry_other",
    parentId: null,
    title: "其他",
    description: "技术探索与日常杂项",
    completionMode: "ongoing",
    status: "active",
    dueAt: null,
    directFocusSeconds: 0,
    aggregateFocusSeconds: 5400,
    sortKey: "a4",
  },
  {
    id: "entry_github",
    parentId: "entry_other",
    title: "GitHub 探索",
    description: "开源前沿 Agent 与操作系统技术关注",
    completionMode: "ongoing",
    status: "active",
    dueAt: null,
    directFocusSeconds: 0,
    aggregateFocusSeconds: 3600,
    sortKey: "a4-1",
  },
  {
    id: "entry_openviking",
    parentId: "entry_github",
    title: "OpenViking / EverOS - 智能体记忆",
    description: "研读 Agent 长期记忆与系统调用结合方案",
    completionMode: "completable",
    status: "active",
    dueAt: null,
    directFocusSeconds: 3600,
    aggregateFocusSeconds: 3600,
    sortKey: "a4-1-1",
  },
  {
    id: "entry_beian",
    parentId: "entry_other",
    title: "公安备案",
    description: "个人域名及服务器合规备案手续",
    completionMode: "completable",
    status: "active",
    dueAt: null, // 无截止日期
    directFocusSeconds: 1800,
    aggregateFocusSeconds: 1800,
    sortKey: "a4-2",
  },
];

const WEEK_PLAN_CURRENT: WeekPlan = {
  weekStart: "2026-06-22",
  note: `## 本周重心
- [x] 攻克 ICS2 HW8/9
- [/] 推进 Lab 4 LockLab 核心代码
- [!] 必须交上人工智能伦理期末初稿！

> 提醒：周三上午听课同时记录 OSTEP 核心疑问；周末安排 2 小时日语听力。`,
  items: [
    { entryId: "entry_ics2", source: "rollover", sortKey: "w1" },
    { entryId: "entry_lab4", source: "manual", sortKey: "w2" },
    { entryId: "entry_ai_paper", source: "rollover", sortKey: "w3" },
    { entryId: "entry_japanese", source: "rollover", sortKey: "w4" },
    { entryId: "entry_openviking", source: "manual", sortKey: "w5" },
  ],
};

const WEEK_PLAN_LAST: WeekPlan = {
  weekStart: "2026-06-15",
  note: `## 上周收尾
- [x] 完成 ICS2 HW8 关键题
- [/] 整理 OSTEP IO & Files 读书笔记
- [ ] 复盘 LockLab 锁设计并补测

> 备注：这周以收尾为主，下一周继续推进论文初稿。`,
  items: [
    { entryId: "entry_ostep_io", source: "rollover", sortKey: "w1" },
    { entryId: "entry_hw8", source: "manual", sortKey: "w2" },
    { entryId: "entry_lab4_sub", source: "manual", sortKey: "w3" },
  ],
};

const WEEK_PLAN_TWO_WEEKS_AGO: WeekPlan = {
  weekStart: "2026-06-08",
  note: `## 前周记录
- [x] 复习 OSTEP 基础章节
- [ ] 启动 AI 伦理论文资料搜集
- [ ] 补齐 GitHub 探索笔记

> 这是一份更早的历史周计划，方便对比滚动结果。`,
  items: [
    { entryId: "entry_ostep", source: "rollover", sortKey: "w1" },
    { entryId: "entry_ai_ethics", source: "manual", sortKey: "w2" },
    { entryId: "entry_github", source: "manual", sortKey: "w3" },
  ],
};

export const MOCK_WEEK_PLANS_NORMAL: Record<string, WeekPlan> = {
  [WEEK_PLAN_CURRENT.weekStart]: WEEK_PLAN_CURRENT,
  [WEEK_PLAN_LAST.weekStart]: WEEK_PLAN_LAST,
  [WEEK_PLAN_TWO_WEEKS_AGO.weekStart]: WEEK_PLAN_TWO_WEEKS_AGO,
};

// Reference Current Date: Friday 2026-06-26, week starts Monday 2026-06-22
export const MOCK_WEEK_PLAN_NORMAL: WeekPlan = WEEK_PLAN_CURRENT;

// Schedule Blocks for the Week (Courses, Plans)
export const MOCK_SCHEDULE_BLOCKS_NORMAL: ScheduleBlock[] = [
  {
    id: "sch_ics2_mon",
    kind: "course",
    title: "ICS2 计算机系统基础",
    startedAt: "2026-06-22T08:00:00+08:00",
    endedAt: "2026-06-22T09:35:00+08:00",
    location: "3302 教室",
    colorKey: "blue",
    recurrence: {
      frequency: "weekly",
      interval: 1,
      weekdays: ["MO", "WE"],
      until: "2026-07-15T00:00:00+08:00",
    },
    recurrenceLabel: "每周一、三 08:00–09:35",
  },
  {
    id: "sch_ics2_wed",
    kind: "course",
    title: "ICS2 计算机系统基础",
    startedAt: "2026-06-24T08:00:00+08:00",
    endedAt: "2026-06-24T09:35:00+08:00",
    location: "3302 教室",
    colorKey: "blue",
    recurrence: {
      frequency: "weekly",
      interval: 1,
      weekdays: ["MO", "WE"],
      until: "2026-07-15T00:00:00+08:00",
    },
    recurrenceLabel: "每周一、三 08:00–09:35",
  },
  {
    id: "sch_ai_ethics_fri",
    kind: "course",
    title: "人工智能伦理与安全",
    startedAt: "2026-06-26T10:00:00+08:00",
    endedAt: "2026-06-26T11:35:00+08:00",
    location: "二教 101",
    colorKey: "purple",
    recurrence: {
      frequency: "weekly",
      interval: 1,
      weekdays: ["FR"],
      until: "2026-07-15T00:00:00+08:00",
    },
    recurrenceLabel: "每周五 10:00–11:35",
  },
  {
    id: "sch_lab_group",
    kind: "plan",
    title: "LockLab 小组讨论会",
    startedAt: "2026-06-25T15:00:00+08:00",
    endedAt: "2026-06-25T17:00:00+08:00",
    location: "图书馆研讨室 4B",
    colorKey: "amber",
    recurrence: null,
    recurrenceLabel: null,
  },
];

// Past & Active Focus Sessions
export const MOCK_FOCUS_SESSIONS_NORMAL: FocusSession[] = [
  // 1. Wednesday 08:20–09:05 (Overlaps with ICS2 course 08:00–09:35)
  {
    id: "foc_wed_course_overlap",
    startedAt: "2026-06-24T08:20:00+08:00",
    endedAt: "2026-06-24T09:05:00+08:00",
    captureMode: "timer",
    note: "上课时记录 OSTEP IO 驱动关键点",
    outcome: "整理完成 Chapter 36 笔记",
    segments: [
      {
        id: "seg_wed_1",
        startedAt: "2026-06-24T08:20:00+08:00",
        endedAt: "2026-06-24T09:05:00+08:00",
        entryId: "entry_ostep_io",
        note: "OSTEP 36 研读",
      },
    ],
  },

  // 2. Wednesday 14:00–15:30 (90 min session, split into Japanese 40m + Lab 4 50m)
  {
    id: "foc_wed_split_90m",
    startedAt: "2026-06-24T14:00:00+08:00",
    endedAt: "2026-06-24T15:30:00+08:00",
    captureMode: "timer",
    note: "下午连续深度专注",
    outcome: "完成 N2 听力 1 单元 + LockLab 锁数据结构定义",
    segments: [
      {
        id: "seg_split_1",
        startedAt: "2026-06-24T14:00:00+08:00",
        endedAt: "2026-06-24T14:40:00+08:00",
        entryId: "entry_japanese",
        note: "学日语 40 分钟",
      },
      {
        id: "seg_split_2",
        startedAt: "2026-06-24T14:40:00+08:00",
        endedAt: "2026-06-24T15:30:00+08:00",
        entryId: "entry_lab4_sub",
        note: "LockLab 自旋锁编码 50 分钟",
      },
    ],
  },

  // 3. Thursday 23:30–00:30 (Cross-day, unassigned focus)
  {
    id: "foc_thu_cross_day",
    startedAt: "2026-06-25T23:30:00+08:00",
    endedAt: "2026-06-26T00:30:00+08:00",
    captureMode: "manual",
    note: "深夜无目的代码阅读与技术探索",
    outcome: "查阅 Linux kernel 锁机制文档",
    segments: [
      {
        id: "seg_cross_1",
        startedAt: "2026-06-25T23:30:00+08:00",
        endedAt: "2026-06-26T00:30:00+08:00",
        entryId: null, // 未关联
        note: null,
      },
    ],
  },

  // 4. Earlier-month historical focus session for monthly statistics
  {
    id: "foc_early_month",
    startedAt: "2026-06-12T19:00:00+08:00",
    endedAt: "2026-06-12T20:15:00+08:00",
    captureMode: "timer",
    note: "月中补充的历史专注样本",
    outcome: "补完 OSTEP FS 相关阅读",
    segments: [
      {
        id: "seg_early_1",
        startedAt: "2026-06-12T19:00:00+08:00",
        endedAt: "2026-06-12T19:35:00+08:00",
        entryId: "entry_ostep_fs",
        note: "FS 39",
      },
      {
        id: "seg_early_2",
        startedAt: "2026-06-12T19:35:00+08:00",
        endedAt: "2026-06-12T20:15:00+08:00",
        entryId: "entry_openviking",
        note: "整理记忆系统笔记",
      },
    ],
  },

  // 4. Currently Active Focus Session (Started 25 mins ago, unassigned)
  {
    id: "foc_active_current",
    startedAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
    endedAt: null, // Active!
    captureMode: "timer",
    note: null,
    outcome: null,
    segments: [],
  },
];

// ICS Preview Fixture (Section 7.8)
export const MOCK_ICS_PREVIEW: IcsImportPreview = {
  importId: "ics_imp_20260626_01",
  fileName: "2026_spring_courses.ics",
  rows: [
    {
      sourceUid: "ics_uid_01",
      title: "ICS2 计算机系统基础",
      startedAt: "2026-06-22T08:00:00+08:00",
      endedAt: "2026-06-22T09:35:00+08:00",
      recurrenceLabel: "每周一、三",
      selected: true,
      warnings: [],
    },
    {
      sourceUid: "ics_uid_02",
      title: "人工智能伦理与安全",
      startedAt: "2026-06-26T10:00:00+08:00",
      endedAt: "2026-06-26T11:35:00+08:00",
      recurrenceLabel: "每周五",
      selected: true,
      warnings: [],
    },
    {
      sourceUid: "ics_uid_03",
      title: "高等数字图像处理 (临时调课)",
      startedAt: "2026-06-27T14:00:00+08:00",
      endedAt: "2026-06-27T17:00:00+08:00",
      recurrenceLabel: null,
      selected: true,
      warnings: ["与已有组会日程可能存在时间交叠", "无明确教室地点信息"],
    },
  ],
  errors: [
    {
      sourceUid: "ics_uid_err_01",
      message: "未知的废弃重复规则 RRULE:FREQ=MONTHLY;BYDAY=5TH (组件跳过)",
    },
  ],
};
