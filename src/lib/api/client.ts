import {
  AddEntryInput,
  LoginInput,
  ManualFocusInput,
  RegisterInput,
  UpdateEntryInput,
} from "@/lib/application/contract";
import {
  Capabilities,
  CalendarPayload,
  DashboardPayload,
  Entry,
  FocusSegment,
  FocusSession,
  ScheduleBlock,
  ScheduleBlockInput,
  StatisticsPayload,
  UserProfile,
  WeekPlan,
} from "@/types/mock";

type ApiEnvelope<T> = { data: T };

export class PersistentApiAdapter {
  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(path, { ...init, headers: { "content-type": "application/json", ...(init?.headers ?? {}) } });
    if (response.status === 204) return undefined as T;
    const body = await response.json() as ApiEnvelope<T> | { error: { message: string } };
    if (!response.ok) throw new Error("error" in body ? body.error.message : "请求失败");
    return (body as ApiEnvelope<T>).data;
  }

  getCapabilities() { return this.request<Capabilities>("/api/v1/capabilities"); }
  getUser() { return this.request<UserProfile | null>("/api/v1/me"); }
  getEntries() { return this.request<Entry[]>("/api/v1/entries"); }
  getEntryById(id: string) { return this.request<Entry>(`/api/v1/entries/${id}`); }
  addEntry(input: AddEntryInput) { return this.request<Entry>("/api/v1/entries", { method: "POST", body: JSON.stringify(input) }); }
  updateEntry(id: string, updates: UpdateEntryInput) { return this.request<Entry>(`/api/v1/entries/${id}`, { method: "PATCH", body: JSON.stringify(updates) }); }
  moveEntry(id: string, parentId: string | null) { return this.updateEntry(id, { parentId }); }
  deleteEntry(id: string) { return this.request<void>(`/api/v1/entries/${id}`, { method: "DELETE" }); }
  getWeekPlan(weekStart?: string) { return this.request<WeekPlan>(`/api/v1/week-plans/${weekStart ?? "current"}`); }
  updateWeekPlanNote(note: string, weekStart?: string) { return this.request<WeekPlan>(`/api/v1/week-plans/${weekStart ?? "current"}`, { method: "POST", body: JSON.stringify({ action: "note", note }) }); }
  addToWeekPlan(entryId: string, weekStart?: string) { return this.request<WeekPlan>(`/api/v1/week-plans/${weekStart ?? "current"}`, { method: "POST", body: JSON.stringify({ action: "add", entryId }) }); }
  removeFromWeekPlan(entryId: string, weekStart?: string) { return this.request<WeekPlan>(`/api/v1/week-plans/${weekStart ?? "current"}`, { method: "POST", body: JSON.stringify({ action: "remove", entryId }) }); }
  getActiveFocus() { return this.request<FocusSession | null>("/api/v1/focus/current"); }
  getFocusSessions() { return this.request<FocusSession[]>("/api/v1/focus/sessions"); }
  startFocusSession(entryId?: string | null) { return this.request<FocusSession>("/api/v1/focus/current", { method: "POST", body: JSON.stringify({ action: "start", entryId: entryId ?? null }) }); }
  stopFocusSession(sessionId: string, outcome: string | null, note: string | null, segments: FocusSegment[]) { return this.request<FocusSession>("/api/v1/focus/current", { method: "POST", body: JSON.stringify({ action: "stop", sessionId, outcome, note, segments }) }); }
  addManualFocusSession(input: ManualFocusInput) { return this.request<FocusSession>("/api/v1/focus/sessions", { method: "POST", body: JSON.stringify(input) }); }
  getScheduleBlocks() { return this.request<ScheduleBlock[]>("/api/v1/schedule-blocks"); }
  addScheduleBlock(input: ScheduleBlockInput) { return this.request<ScheduleBlock>("/api/v1/schedule-blocks", { method: "POST", body: JSON.stringify(input) }); }
  deleteScheduleBlock(id: string) { return this.request<void>(`/api/v1/schedule-blocks/${id}`, { method: "DELETE" }); }
  getStatisticsPayload(scale?: "day" | "week" | "month") { return this.request<StatisticsPayload>(`/api/v1/statistics?scale=${scale ?? "week"}`); }
  getDashboardPayload() { return this.request<DashboardPayload>("/api/v1/dashboard"); }
  getCalendarPayload() { return this.request<CalendarPayload>("/api/v1/calendar"); }
  register(input: RegisterInput) { return this.request<{ user: UserProfile }>("/api/auth/register", { method: "POST", body: JSON.stringify(input) }); }
  login(input: LoginInput) { return this.request<{ user: UserProfile }>("/api/auth/login", { method: "POST", body: JSON.stringify(input) }); }
  logout() { return this.request<void>("/api/auth/logout", { method: "POST", body: "{}" }); }
}
