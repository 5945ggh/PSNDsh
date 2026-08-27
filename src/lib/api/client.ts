import {
  AddEntryInput,
  LoginInput,
  ManualFocusInput,
  RegisterInput,
  StatisticsScale,
  UpdateEntryInput,
} from "@/lib/application/contract";
import {
  AuthSession,
  Capabilities,
  CalendarPayload,
  DashboardPayload,
  Entry,
  FocusSegment,
  FocusSession,
  IcsImportPreview,
  ScheduleBlock,
  ScheduleBlockInput,
  ScheduleImport,
  ScheduleTemplate,
  ScheduleTemplateApplication,
  ScheduleTemplateInput,
  ScheduleTemplatePreview,
  UpdateScheduleBlockInput,
  StatisticsPayload,
  UserProfile,
  WeekPlan,
  WeekPlanItemInput,
} from "@/lib/domain/types";

type ApiEnvelope<T> = { data: T };

type ApiFailure = {
  error: {
    code?: string;
    message?: string;
    details?: Record<string, unknown>;
  };
};

export class ApiClientError extends Error {
  readonly code: string;
  readonly details: Record<string, unknown> | undefined;
  readonly status: number;

  constructor({
    code,
    message,
    details,
    status,
  }: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    status: number;
  }) {
    super(message);
    this.name = "ApiClientError";
    this.code = code;
    this.details = details;
    this.status = status;
  }
}

export const isUnauthorizedError = (error: unknown) =>
  error instanceof ApiClientError && error.status === 401;

/**
 * The browser-facing contract. It deliberately mirrors the mock adapter while
 * making network latency and failures explicit to callers.
 */
export interface ApiAdapter {
  getCapabilities(): Promise<Capabilities>;
  getSession(): Promise<AuthSession>;
  getUser(): Promise<UserProfile | null>;
  register(input: RegisterInput): Promise<AuthSession>;
  login(input: LoginInput): Promise<AuthSession>;
  logout(): Promise<void>;
  updateUserProfile(
    nickname: string | null,
    email: string | null
  ): Promise<UserProfile>;

  getEntries(): Promise<Entry[]>;
  getEntryById(id: string): Promise<Entry>;
  addEntry(input: AddEntryInput): Promise<Entry>;
  updateEntry(id: string, updates: UpdateEntryInput): Promise<Entry>;
  moveEntry(id: string, parentId: string | null): Promise<Entry>;
  deleteEntry(id: string): Promise<void>;

  getWeekPlan(weekStart?: string): Promise<WeekPlan>;
  getExistingWeekPlan(weekStart: string): Promise<WeekPlan | null>;
  updateWeekPlanNote(note: string, weekStart?: string): Promise<WeekPlan>;
  addToWeekPlan(entryId: string, weekStart?: string, input?: Partial<WeekPlanItemInput>): Promise<WeekPlan>;
  updateWeekPlanItem(entryId: string, input: WeekPlanItemInput, weekStart?: string): Promise<WeekPlan>;
  removeFromWeekPlan(entryId: string, weekStart?: string): Promise<WeekPlan>;

  getActiveFocus(): Promise<FocusSession | null>;
  getFocusSessions(): Promise<FocusSession[]>;
  startFocusSession(entryId?: string | null): Promise<FocusSession>;
  stopFocusSession(
    sessionId: string,
    outcome: string | null,
    note: string | null,
    segments: FocusSegment[]
  ): Promise<FocusSession>;
  updateFocusSession(sessionId: string, segments: FocusSegment[]): Promise<FocusSession>;
  discardFocusSession(): Promise<void>;
  addManualFocusSession(input: ManualFocusInput): Promise<FocusSession>;

  getScheduleBlocks(): Promise<ScheduleBlock[]>;
  getScheduleImports(): Promise<ScheduleImport[]>;
  deleteScheduleImport(id: string): Promise<void>;
  getScheduleTemplates(): Promise<ScheduleTemplate[]>;
  createScheduleTemplate(input: ScheduleTemplateInput): Promise<ScheduleTemplate>;
  updateScheduleTemplate(id: string, input: ScheduleTemplateInput): Promise<ScheduleTemplate>;
  deleteScheduleTemplate(id: string): Promise<void>;
  previewScheduleTemplate(id: string, fromDate: string, toDate: string): Promise<ScheduleTemplatePreview>;
  applyScheduleTemplate(id: string, fromDate: string, toDate: string): Promise<ScheduleTemplateApplication>;
  getScheduleTemplateApplications(): Promise<ScheduleTemplateApplication[]>;
  deleteScheduleTemplateApplication(id: string): Promise<void>;
  addScheduleBlock(input: ScheduleBlockInput): Promise<ScheduleBlock>;
  updateScheduleBlock(id: string, input: UpdateScheduleBlockInput): Promise<ScheduleBlock>;
  deleteScheduleBlock(id: string): Promise<void>;
  previewIcsImport(fileName: string, content: string): Promise<IcsImportPreview>;
  confirmIcsImport(importId: string, selectedSourceUids: string[]): Promise<number>;

  getDashboardPayload(): Promise<DashboardPayload>;
  getStatisticsPayload(
    scale?: StatisticsScale,
    weekStart?: string
  ): Promise<StatisticsPayload>;
  getCalendarPayload(from?: string, to?: string): Promise<CalendarPayload>;
}

export class PersistentApiAdapter implements ApiAdapter {
  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const headers = new Headers(init?.headers);
    const method = (init?.method ?? "GET").toUpperCase();
    if (method !== "GET" && method !== "HEAD" && method !== "OPTIONS") {
      headers.set("x-pd-same-origin", "1");
    }
    if (init?.body !== undefined && !headers.has("content-type")) {
      headers.set("content-type", "application/json");
    }

    const response = await fetch(path, {
      ...init,
      credentials: "same-origin",
      headers,
    });

    if (response.status === 204) {
      return undefined as T;
    }

    let body: ApiEnvelope<T> | ApiFailure | null = null;
    try {
      body = (await response.json()) as ApiEnvelope<T> | ApiFailure;
    } catch {
      // A malformed upstream response is handled below as a useful client error.
    }

    if (!response.ok) {
      const failure = body && "error" in body ? body.error : undefined;
      throw new ApiClientError({
        code: failure?.code ?? "HTTP_ERROR",
        message: failure?.message ?? "请求失败",
        details: failure?.details,
        status: response.status,
      });
    }

    if (!body || !("data" in body)) {
      throw new ApiClientError({
        code: "INVALID_RESPONSE",
        message: "服务返回了无法识别的数据",
        status: response.status,
      });
    }

    return body.data;
  }

  getCapabilities() {
    return this.request<Capabilities>("/api/v1/capabilities");
  }

  async getSession(): Promise<AuthSession> {
    return { user: await this.getUser() };
  }

  getUser() {
    return this.request<UserProfile | null>("/api/v1/me");
  }

  register(input: RegisterInput) {
    return this.request<AuthSession>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  login(input: LoginInput) {
    return this.request<AuthSession>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  async logout() {
    await this.request<null>("/api/auth/logout", {
      method: "POST",
      body: JSON.stringify({}),
    });
  }

  updateUserProfile(nickname: string | null, email: string | null) {
    return this.request<UserProfile>("/api/v1/me", {
      method: "PATCH",
      body: JSON.stringify({ nickname, email }),
    });
  }

  getEntries() {
    return this.request<Entry[]>("/api/v1/entries");
  }

  getEntryById(id: string) {
    return this.request<Entry>(`/api/v1/entries/${id}`);
  }

  addEntry(input: AddEntryInput) {
    return this.request<Entry>("/api/v1/entries", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  updateEntry(id: string, updates: UpdateEntryInput) {
    return this.request<Entry>(`/api/v1/entries/${id}`, {
      method: "PATCH",
      body: JSON.stringify(updates),
    });
  }

  moveEntry(id: string, parentId: string | null) {
    return this.updateEntry(id, { parentId });
  }

  deleteEntry(id: string) {
    return this.request<void>(`/api/v1/entries/${id}`, { method: "DELETE" });
  }

  getWeekPlan(weekStart?: string) {
    return this.request<WeekPlan>(
      `/api/v1/week-plans/${weekStart ? encodeURIComponent(weekStart) : "current"}`
    );
  }

  getExistingWeekPlan(weekStart: string) {
    return this.request<WeekPlan | null>(
      `/api/v1/week-plans/${encodeURIComponent(weekStart)}?create=false`
    );
  }

  updateWeekPlanNote(note: string, weekStart?: string) {
    return this.request<WeekPlan>(
      `/api/v1/week-plans/${weekStart ? encodeURIComponent(weekStart) : "current"}`,
      { method: "POST", body: JSON.stringify({ action: "note", note }) }
    );
  }

  addToWeekPlan(entryId: string, weekStart?: string, input?: Partial<WeekPlanItemInput>) {
    return this.request<WeekPlan>(
      `/api/v1/week-plans/${weekStart ? encodeURIComponent(weekStart) : "current"}`,
      { method: "POST", body: JSON.stringify({ action: "add", entryId, ...input }) }
    );
  }

  updateWeekPlanItem(entryId: string, input: WeekPlanItemInput, weekStart?: string) {
    return this.request<WeekPlan>(
      `/api/v1/week-plans/${weekStart ? encodeURIComponent(weekStart) : "current"}`,
      { method: "POST", body: JSON.stringify({ action: "update", entryId, ...input }) }
    );
  }

  removeFromWeekPlan(entryId: string, weekStart?: string) {
    return this.request<WeekPlan>(
      `/api/v1/week-plans/${weekStart ? encodeURIComponent(weekStart) : "current"}`,
      { method: "POST", body: JSON.stringify({ action: "remove", entryId }) }
    );
  }

  getActiveFocus() {
    return this.request<FocusSession | null>("/api/v1/focus/current");
  }

  getFocusSessions() {
    return this.request<FocusSession[]>("/api/v1/focus/sessions");
  }

  startFocusSession(entryId?: string | null) {
    return this.request<FocusSession>("/api/v1/focus/current", {
      method: "POST",
      body: JSON.stringify({ action: "start", entryId: entryId ?? null }),
    });
  }

  stopFocusSession(
    sessionId: string,
    outcome: string | null,
    note: string | null,
    segments: FocusSegment[]
  ) {
    return this.request<FocusSession>("/api/v1/focus/current", {
      method: "POST",
      body: JSON.stringify({ action: "stop", sessionId, outcome, note, segments }),
    });
  }

  updateFocusSession(sessionId: string, segments: FocusSegment[]) {
    return this.request<FocusSession>(`/api/v1/focus/sessions/${encodeURIComponent(sessionId)}`, {
      method: "PATCH",
      body: JSON.stringify({ segments }),
    });
  }

  discardFocusSession() {
    return this.request<void>("/api/v1/focus/current", { method: "DELETE" });
  }

  addManualFocusSession(input: ManualFocusInput) {
    return this.request<FocusSession>("/api/v1/focus/sessions", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  getScheduleBlocks() {
    return this.request<ScheduleBlock[]>("/api/v1/schedule-blocks");
  }

  getScheduleImports() {
    return this.request<ScheduleImport[]>("/api/v1/schedule-blocks/imports");
  }

  deleteScheduleImport(id: string) {
    return this.request<void>(`/api/v1/schedule-blocks/imports/${encodeURIComponent(id)}`, { method: "DELETE" });
  }

  getScheduleTemplates() {
    return this.request<ScheduleTemplate[]>("/api/v1/schedule-templates");
  }

  createScheduleTemplate(input: ScheduleTemplateInput) {
    return this.request<ScheduleTemplate>("/api/v1/schedule-templates", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  updateScheduleTemplate(id: string, input: ScheduleTemplateInput) {
    return this.request<ScheduleTemplate>(`/api/v1/schedule-templates/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  }

  deleteScheduleTemplate(id: string) {
    return this.request<void>(`/api/v1/schedule-templates/${encodeURIComponent(id)}`, { method: "DELETE" });
  }

  previewScheduleTemplate(id: string, fromDate: string, toDate: string) {
    return this.request<ScheduleTemplatePreview>(`/api/v1/schedule-templates/${encodeURIComponent(id)}/preview`, {
      method: "POST",
      body: JSON.stringify({ fromDate, toDate }),
    });
  }

  applyScheduleTemplate(id: string, fromDate: string, toDate: string) {
    return this.request<ScheduleTemplateApplication>(`/api/v1/schedule-templates/${encodeURIComponent(id)}/apply`, {
      method: "POST",
      body: JSON.stringify({ fromDate, toDate }),
    });
  }

  getScheduleTemplateApplications() {
    return this.request<ScheduleTemplateApplication[]>("/api/v1/schedule-template-applications");
  }

  deleteScheduleTemplateApplication(id: string) {
    return this.request<void>(`/api/v1/schedule-template-applications/${encodeURIComponent(id)}`, { method: "DELETE" });
  }

  addScheduleBlock(input: ScheduleBlockInput) {
    return this.request<ScheduleBlock>("/api/v1/schedule-blocks", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  updateScheduleBlock(id: string, input: UpdateScheduleBlockInput) {
    return this.request<ScheduleBlock>(`/api/v1/schedule-blocks/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  }

  deleteScheduleBlock(id: string) {
    return this.request<void>(`/api/v1/schedule-blocks/${id}`, {
      method: "DELETE",
    });
  }

  previewIcsImport(fileName: string, content: string) {
    return this.request<IcsImportPreview>("/api/v1/schedule-blocks/imports/ics/preview", {
      method: "POST",
      body: JSON.stringify({ fileName, content }),
    });
  }

  confirmIcsImport(importId: string, selectedSourceUids: string[]) {
    return this.request<number>(`/api/v1/schedule-blocks/imports/ics/${encodeURIComponent(importId)}/confirm`, {
      method: "POST",
      body: JSON.stringify({ selectedSourceUids }),
    });
  }

  getStatisticsPayload(scale?: StatisticsScale, weekStart?: string) {
    const params = new URLSearchParams({ scale: scale ?? "week" });
    if (weekStart) params.set("weekStart", weekStart);
    return this.request<StatisticsPayload>(`/api/v1/statistics?${params}`);
  }

  getDashboardPayload() {
    return this.request<DashboardPayload>("/api/v1/dashboard");
  }

  getCalendarPayload(from?: string, to?: string) {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const query = params.toString();
    return this.request<CalendarPayload>(`/api/v1/calendar${query ? `?${query}` : ""}`);
  }
}
