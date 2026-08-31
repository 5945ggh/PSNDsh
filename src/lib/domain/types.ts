export type ApiError = {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
};

export type Capabilities = {
  registration: {
    available: boolean;
  };
  effectiveTimezone: string;
  features: {
    weather: boolean;
    quotation: boolean;
    icsImport: boolean;
  };
};

export type UserProfile = {
  id: string;
  username: string;
  nickname: string | null;
  email: string | null;
};

export type AuthSession = {
  user: UserProfile | null;
};

export type EntryCompletionMode = "ongoing" | "completable";
export type EntryStatus = "active" | "paused" | "completed" | "archived";

export type Entry = {
  id: string;
  parentId: string | null;
  title: string;
  description: string | null;
  completionMode: EntryCompletionMode;
  status: EntryStatus;
  dueAt: string | null;
  directFocusSeconds: number;
  aggregateFocusSeconds: number;
  sortKey: string;
  deletedAt?: string | null;
};

export type WeekPlanItem = {
  entryId: string;
  source: "manual" | "rollover";
  role: "focus" | "commitment";
  plannedFocusSeconds: number | null;
  sortKey: string;
};

export type WeekPlanItemInput = Pick<WeekPlanItem, "role" | "plannedFocusSeconds">;

export type WeekPlan = {
  weekStart: string; // YYYY-MM-DD
  note: string;
  items: WeekPlanItem[];
};

export type FocusSegment = {
  id: string;
  startedAt: string;
  endedAt: string;
  entryId: string | null;
  note: string | null;
};

export type FocusSession = {
  id: string;
  startedAt: string;
  endedAt: string | null;
  captureMode: "timer" | "manual";
  note: string | null;
  outcome: string | null;
  segments: FocusSegment[];
};

export type ScheduleRecurrence = null | {
  frequency: "weekly";
  interval: number;
  weekdays: Array<"MO" | "TU" | "WE" | "TH" | "FR" | "SA" | "SU">;
  until: string | null;
};

export type ScheduleBlockKind = "course" | "plan" | "other";

export type ScheduleBlock = {
  id: string;
  kind: ScheduleBlockKind;
  title: string;
  description?: string | null;
  startedAt: string;
  endedAt: string;
  location: string | null;
  colorKey: string | null;
  recurrence: ScheduleRecurrence;
  recurrenceLabel: string | null;
  source?: "manual" | "ics" | "template";
  importId?: string | null;
  sourceUid?: string | null;
  sourceInstanceKey?: string | null;
  templateApplicationId?: string | null;
  recurrenceSourceId?: string;
};

export type ScheduleBlockInput = {
  kind: ScheduleBlockKind;
  title: string;
  description?: string | null;
  startedAt: string;
  endedAt: string;
  location: string | null;
  colorKey: string | null;
  recurrence: ScheduleRecurrence;
  sourceUid?: string | null;
  sourceInstanceKey?: string | null;
};

export type ScheduleImport = {
  id: string;
  fileName: string;
  importedAt: string;
  blockCount: number;
  sourceKey?: string | null;
  sourceName?: string | null;
  changeCount?: number;
};

export type TemplateWeekday = "MO" | "TU" | "WE" | "TH" | "FR" | "SA" | "SU";

export type ScheduleTemplateItem = {
  id: string;
  weekdays: TemplateWeekday[];
  title: string;
  description: string | null;
  kind: ScheduleBlockKind;
  location: string | null;
  colorKey: string | null;
  startTime: string;
  endTime: string;
  sortKey: string;
};

export type ScheduleTemplateInput = {
  name: string;
  description: string | null;
  items: Array<Omit<ScheduleTemplateItem, "id" | "sortKey">>;
};

export type ScheduleTemplate = {
  id: string;
  name: string;
  description: string | null;
  items: ScheduleTemplateItem[];
  createdAt: string;
  updatedAt: string;
};

export type ScheduleTemplateApplication = {
  id: string;
  templateId: string;
  templateName: string;
  fromDate: string;
  toDate: string;
  appliedAt: string;
  blockCount: number;
};

export type ScheduleTemplateBlockPreview = Pick<ScheduleBlock, "title" | "description" | "kind" | "location" | "colorKey" | "startedAt" | "endedAt"> & {
  itemId: string;
};

export type ScheduleTemplatePreview = {
  templateId: string;
  templateName: string;
  fromDate: string;
  toDate: string;
  blocks: ScheduleTemplateBlockPreview[];
};

export type UpdateScheduleBlockInput = Partial<ScheduleBlockInput>;

export type CalendarPayload = {
  scheduleBlocks: ScheduleBlock[];
  focusSessions: FocusSession[];
};

export type IcsImportRow = {
  sourceUid: string;
  title: string;
  startedAt: string;
  endedAt: string;
  location?: string | null;
  description?: string | null;
  recurrenceLabel: string | null;
  selected: boolean;
  warnings: string[];
  duplicateCount?: number;
  change?: "added" | "updated" | "unchanged" | "removed" | "cancelled";
};

export type IcsImportPreview = {
  importId: string;
  fileName: string;
  sourceKey?: string;
  sourceName?: string;
  isUpdate?: boolean;
  diff?: {
    added: number;
    updated: number;
    removed: number;
    cancelled: number;
    unchanged: number;
  };
  rows: IcsImportRow[];
  errors: Array<{
    sourceUid: string | null;
    message: string;
  }>;
};

export type IcsImportConfirmInput = {
  selectedSourceUids: string[];
};

export type WeatherStatus = "fresh" | "stale" | "unavailable";

export type DashboardPayload = {
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
    status: WeatherStatus;
    temperatureC?: number;
    summary?: string;
    observedAt?: string;
  };
  quotation: {
    text: string;
    author: string;
    work: string;
    source: "cache" | "builtin";
    sourceUrl: string;
    catalogVersion: string;
  };
};

export type StatisticsPayload = {
  totalSeconds: number;
  unassignedSeconds: number;
  daily: Array<{ date: string; seconds: number }>;
  entryBreakdown: Array<{
    entryId: string;
    directSeconds: number;
    aggregateSeconds: number;
  }>;
  roots: Array<{
    entryId: string;
    directSeconds: number;
    aggregateSeconds: number;
  }>;
};

export type UserDataExport = {
  schemaVersion: "1.0";
  exportedAt: string;
  effectiveTimezone: string;
  profile: UserProfile;
  entries: Entry[];
  weekPlans: WeekPlan[];
  focusSessions: FocusSession[];
  scheduleBlocks: ScheduleBlock[];
};

export type ExpenseCurrency = "CNY";
export type ExpenseOccurrencePrecision = "datetime" | "date";
export type ExpenseReviewStatus = "pending" | "reviewed";
export type ExpenseRecognitionStatus = "recognized";
export type ExpenseSource = "shortcut" | "manual";

export type ExpenseIconKey =
  | "utensils" | "coffee" | "shopping-cart" | "car" | "plane" | "home"
  | "briefcase" | "graduation-cap" | "heart-pulse" | "wallet" | "credit-card"
  | "banknote" | "smartphone" | "gift" | "ticket" | "fuel" | "tag" | "circle-help";

export type ExpenseCategory = {
  id: string;
  name: string;
  iconKey?: ExpenseIconKey | null;
  archivedAt: string | null;
};

export type ExpenseTag = {
  id: string;
  name: string;
  iconKey?: ExpenseIconKey | null;
  archivedAt: string | null;
};

export type PaymentMethod = {
  id: string;
  name: string;
  iconKey?: ExpenseIconKey | null;
  archivedAt: string | null;
};

export type Expense = {
  /** Client-generated UUID. It is unique within a user, not globally. */
  id: string;
  amountCents: number;
  currency: ExpenseCurrency;
  occurredAt: string | null;
  occurredOn: string | null;
  occurredTimezone: string | null;
  occurrencePrecision: ExpenseOccurrencePrecision;
  recordedAt: string;
  captureMessage: string | null;
  note: string | null;
  categoryId: string | null;
  categoryName?: string | null;
  paymentMethodId: string | null;
  paymentMethodName?: string | null;
  tags: ExpenseTag[];
  reviewStatus: ExpenseReviewStatus;
  recognitionStatus: ExpenseRecognitionStatus;
  recoverableCents: number;
  settled: boolean;
  source: ExpenseSource;
  latitude: number | null;
  longitude: number | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
};
