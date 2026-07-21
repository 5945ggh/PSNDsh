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
  sortKey: string;
};

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
  startedAt: string;
  endedAt: string;
  location: string | null;
  colorKey: string | null;
  recurrence: ScheduleRecurrence;
  recurrenceLabel: string | null;
};

export type ScheduleBlockInput = {
  kind: ScheduleBlockKind;
  title: string;
  startedAt: string;
  endedAt: string;
  location: string | null;
  colorKey: string | null;
  recurrence: ScheduleRecurrence;
};

export type CalendarPayload = {
  scheduleBlocks: ScheduleBlock[];
  focusSessions: FocusSession[];
};

export type IcsImportRow = {
  sourceUid: string;
  title: string;
  startedAt: string;
  endedAt: string;
  recurrenceLabel: string | null;
  selected: boolean;
  warnings: string[];
};

export type IcsImportPreview = {
  importId: string;
  fileName: string;
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
  };
};

export type StatisticsPayload = {
  totalSeconds: number;
  unassignedSeconds: number;
  daily: Array<{ date: string; seconds: number }>;
  roots: Array<{
    entryId: string;
    directSeconds: number;
    aggregateSeconds: number;
  }>;
};

export type ScenarioPreset =
  | "normal"
  | "empty"
  | "reg_closed"
  | "weather_stale"
  | "weather_unavailable";
