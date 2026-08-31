import {
  AuthSession,
  Entry,
  FocusSegment,
  FocusSession,
  ExpenseCategory,
  ExpenseTag,
  PaymentMethod,
  ScheduleBlockInput,
  UpdateScheduleBlockInput,
  UserDataExport,
  UserProfile,
} from "@/lib/domain/types";
import type { ScenarioPreset } from "@/lib/mock/types";
import { ApplicationService, LoginInput, RegisterInput } from "@/lib/application/contract";
import { MockDataStore } from "./store";
import { assertValidWeekPlanItemInput } from "@/lib/domain/week-plan";
import {
  assertEntryMoveIsValid,
  assertEntryStatusIsValid,
  assertNoFocusOverlap,
  assertSegmentsPartitionSession,
  MockDomainError,
} from "./domain";

export type { LoginInput, RegisterInput } from "@/lib/application/contract";

/** Coordinates mock use cases. Domain checks belong here, not in React. */
export class MockApplicationService implements ApplicationService {
  constructor(private readonly store: MockDataStore) {}

  subscribe(listener: () => void) {
    return this.store.subscribe(listener);
  }

  getScenario() { return this.store.getScenario(); }
  setScenario(preset: ScenarioPreset) { this.store.setScenario(preset); }
  getCapabilities() { return this.store.getCapabilities(); }
  getSession(): AuthSession { return { user: this.store.getUser() }; }
  getUser() { return this.store.getUser(); }
  getEntries() { return this.store.getEntries(); }
  getEntryById(id: string) { return this.store.getEntryById(id); }
  getWeekPlan(weekStart?: string) { return this.store.getWeekPlan(weekStart); }
  getExistingWeekPlan(weekStart: string) { return this.store.getExistingWeekPlan(weekStart); }
  getActiveFocus() { return this.store.getActiveFocus(); }
  getFocusSessions() { return this.store.getFocusSessions(); }
  getExpenses() { return this.store.getExpenses(); }
  getExpenseHistoryPage(limit?: number, before?: string) { return this.store.getExpenseHistoryPage(limit, before); }
  getInboxExpenses() { return this.store.getInboxExpenses(); }
  getExpenseCategories(includeArchived = false) { return this.store.getExpenseCategories(includeArchived); }
  getExpenseTags(includeArchived = false) { return this.store.getExpenseTags(includeArchived); }
  getPaymentMethods(includeArchived = false) { return this.store.getPaymentMethods(includeArchived); }
  captureExpense(input: Parameters<MockDataStore["captureExpense"]>[0]) { return this.store.captureExpense(input); }
  updateExpense(id: string, input: Parameters<MockDataStore["updateExpense"]>[1]) { return this.store.updateExpense(id, input); }
  createExpenseCategory(input: { name: string }): ExpenseCategory { return this.store.createExpenseCategory(input); }
  renameExpenseCategory(id: string, input: { name: string }): ExpenseCategory { return this.store.renameExpenseCategory(id, input); }
  archiveExpenseCategory(id: string): ExpenseCategory { return this.store.archiveExpenseCategory(id); }
  restoreExpenseCategory(id: string): ExpenseCategory { return this.store.restoreExpenseCategory(id); }
  mergeExpenseCategory(id: string, input: { targetId: string }): ExpenseCategory { return this.store.mergeExpenseCategory(id, input); }
  createExpenseTag(input: { name: string }): ExpenseTag { return this.store.createExpenseTag(input); }
  renameExpenseTag(id: string, input: { name: string }): ExpenseTag { return this.store.renameExpenseTag(id, input); }
  archiveExpenseTag(id: string): ExpenseTag { return this.store.archiveExpenseTag(id); }
  restoreExpenseTag(id: string): ExpenseTag { return this.store.restoreExpenseTag(id); }
  mergeExpenseTag(id: string, input: { targetId: string }): ExpenseTag { return this.store.mergeExpenseTag(id, input); }
  createPaymentMethod(input: { name: string }): PaymentMethod { return this.store.createPaymentMethod(input); }
  renamePaymentMethod(id: string, input: { name: string }): PaymentMethod { return this.store.renamePaymentMethod(id, input); }
  archivePaymentMethod(id: string): PaymentMethod { return this.store.archivePaymentMethod(id); }
  restorePaymentMethod(id: string): PaymentMethod { return this.store.restorePaymentMethod(id); }
  mergePaymentMethod(id: string, input: { targetId: string }): PaymentMethod { return this.store.mergePaymentMethod(id, input); }
  getExpenseById(id: string, options: { includeDeleted?: boolean } = {}) {
    return this.store.getExpenseById(id, options.includeDeleted ?? false);
  }
  deleteExpense(id: string) { this.store.deleteExpense(id); }
  getScheduleBlocks() { return this.store.getScheduleBlocks(); }
  getScheduleImports() { return []; }
  deleteScheduleImport(id: string) { void id; throw new MockDomainError("SCHEDULE_NOT_FOUND", "导入批次不存在"); }
  getScheduleTemplates() { return []; }
  createScheduleTemplate(input: Parameters<ApplicationService["createScheduleTemplate"]>[0]): never { void input; throw new MockDomainError("REQUEST_INVALID", "模拟数据传输不支持日程模板"); }
  updateScheduleTemplate(id: string, input: Parameters<ApplicationService["updateScheduleTemplate"]>[1]): never { void id; void input; throw new MockDomainError("REQUEST_INVALID", "模拟数据传输不支持日程模板"); }
  deleteScheduleTemplate(id: string): never { void id; throw new MockDomainError("SCHEDULE_TEMPLATE_NOT_FOUND", "日程模板不存在"); }
  previewScheduleTemplate(id: string, fromDate: string, toDate: string): never { void id; void fromDate; void toDate; throw new MockDomainError("REQUEST_INVALID", "模拟数据传输不支持日程模板"); }
  applyScheduleTemplate(id: string, fromDate: string, toDate: string): never { void id; void fromDate; void toDate; throw new MockDomainError("REQUEST_INVALID", "模拟数据传输不支持日程模板"); }
  getScheduleTemplateApplications() { return []; }
  deleteScheduleTemplateApplication(id: string): never { void id; throw new MockDomainError("SCHEDULE_TEMPLATE_APPLICATION_NOT_FOUND", "模板应用批次不存在"); }
  getCalendarPayload(from?: string, to?: string) { return this.store.getCalendarPayload(from, to); }
  getIcsPreview() { return this.store.getIcsPreview(); }
  getDashboardPayload() { return this.store.getDashboardPayload(); }
  getStatisticsPayload(...args: Parameters<ApplicationService["getStatisticsPayload"]>) {
    return this.store.getStatisticsPayload(...args);
  }
  exportUserData(): UserDataExport {
    const profile = this.getUser();
    if (!profile) throw new MockDomainError("UNAUTHORIZED", "当前没有登录用户");
    return {
      schemaVersion: "1.0",
      exportedAt: new Date().toISOString(),
      effectiveTimezone: this.getCapabilities().effectiveTimezone,
      profile,
      entries: this.getEntries(),
      weekPlans: [this.getWeekPlan()],
      focusSessions: this.getFocusSessions(),
      scheduleBlocks: this.getScheduleBlocks(),
    };
  }

  register(input: RegisterInput): AuthSession {
    if (!this.getCapabilities().registration.available) {
      throw new MockDomainError("REGISTRATION_CLOSED", "当前实例不允许注册");
    }
    if (input.password !== input.passwordConfirmation) {
      throw new MockDomainError("PASSWORD_MISMATCH", "两次输入的密码不一致");
    }
    if (input.password.length < 6) {
      throw new MockDomainError("PASSWORD_TOO_WEAK", "密码至少需要 6 个字符");
    }
    if (this.store.getUserByUsername(input.username)) {
      throw new MockDomainError("USERNAME_TAKEN", "该账号已被使用");
    }
    return { user: this.store.registerUser(input.username, input.password) };
  }

  login(input: LoginInput): AuthSession {
    const user = this.store.authenticate(input.username, input.password);
    if (!user) {
      throw new MockDomainError("INVALID_CREDENTIALS", "账号或密码不正确");
    }
    return { user };
  }

  logout() { this.store.clearSession(); }

  updateUserProfile(nickname: string | null, email: string | null): UserProfile {
    const user = this.store.updateUserProfile(nickname, email);
    if (!user) throw new MockDomainError("INVALID_CREDENTIALS", "当前没有登录用户");
    return user;
  }

  addEntry(input: Parameters<MockDataStore["addEntry"]>[0]) {
    if (input.parentId && !this.store.getEntryById(input.parentId)) {
      throw new MockDomainError("ENTRY_NOT_FOUND", "父条目不存在");
    }
    return this.store.addEntry(input);
  }

  updateEntry(id: string, updates: Partial<Entry>) {
    const entry = this.store.getEntryById(id);
    if (!entry) throw new MockDomainError("ENTRY_NOT_FOUND", "条目不存在");
    const completionMode = updates.completionMode ?? entry.completionMode;
    const status = updates.status ?? entry.status;
    assertEntryStatusIsValid({ ...entry, completionMode }, status);
    if (updates.parentId !== undefined && updates.parentId !== entry.parentId) {
      assertEntryMoveIsValid(this.getEntries(), id, updates.parentId);
    }
    return this.store.updateEntry(id, updates) as Entry;
  }

  moveEntry(id: string, newParentId: string | null) {
    assertEntryMoveIsValid(this.getEntries(), id, newParentId);
    this.store.moveEntry(id, newParentId);
    return this.store.getEntryById(id) as Entry;
  }

  deleteEntry(id: string) {
    if (!this.store.getEntryById(id)) {
      throw new MockDomainError("ENTRY_NOT_FOUND", "条目不存在");
    }
    this.store.deleteEntry(id);
  }

  updateWeekPlanNote(note: string, weekStart?: string) {
    this.store.updateWeekPlanNote(note, weekStart);
  }
  addToWeekPlan(entryId: string, weekStart?: string, input?: Parameters<ApplicationService["addToWeekPlan"]>[2]) {
    const entry = this.store.getEntryById(entryId);
    if (!entry) {
      throw new MockDomainError("ENTRY_NOT_FOUND", "条目不存在");
    }
    const role = input?.role ?? (entry.completionMode === "ongoing" ? "focus" : "commitment");
    assertValidWeekPlanItemInput({ role, plannedFocusSeconds: input?.plannedFocusSeconds ?? null });
    this.store.addToWeekPlan(entryId, weekStart, input);
  }
  updateWeekPlanItem(entryId: string, input: Parameters<ApplicationService["updateWeekPlanItem"]>[1], weekStart?: string) {
    if (!this.store.getEntryById(entryId)) {
      throw new MockDomainError("ENTRY_NOT_FOUND", "条目不存在");
    }
    assertValidWeekPlanItemInput(input);
    this.store.updateWeekPlanItem(entryId, input, weekStart);
  }
  removeFromWeekPlan(entryId: string, weekStart?: string) {
    this.store.removeFromWeekPlan(entryId, weekStart);
  }

  startFocusSession(entryId?: string | null) {
    if (this.getActiveFocus()) {
      throw new MockDomainError("FOCUS_ALREADY_ACTIVE", "已有活动中的专注会话");
    }
    if (entryId && !this.store.getEntryById(entryId)) {
      throw new MockDomainError("ENTRY_NOT_FOUND", "关联条目不存在");
    }
    return this.store.startFocusSession(entryId);
  }

  stopFocusSession(
    sessionId: string,
    outcome: string | null,
    note: string | null,
    submittedSegments: FocusSegment[]
  ): FocusSession {
    const session = this.store.getFocusSessions().find((item) => item.id === sessionId);
    if (!session || session.endedAt) {
      throw new MockDomainError("FOCUS_NOT_FOUND", "活动专注会话不存在");
    }
    const endedAt = new Date().toISOString();
    const segments = submittedSegments.map((segment, index) =>
      index === submittedSegments.length - 1 ? { ...segment, endedAt } : segment
    );
    for (const segment of segments) {
      if (segment.entryId && !this.store.getEntryById(segment.entryId)) {
        throw new MockDomainError("ENTRY_NOT_FOUND", "片段关联的条目不存在");
      }
    }
    assertSegmentsPartitionSession({ startedAt: session.startedAt, endedAt }, segments);
    assertNoFocusOverlap(this.getFocusSessions(), session.startedAt, endedAt, session.id);
    return this.store.stopFocusSession(sessionId, outcome, note, segments, endedAt);
  }

  updateFocusSession(sessionId: string, segments: FocusSegment[]): FocusSession {
    const session = this.store.getFocusSessions().find((item) => item.id === sessionId);
    if (!session || !session.endedAt) {
      throw new MockDomainError("FOCUS_NOT_FOUND", "已结束的专注会话不存在");
    }
    for (const segment of segments) {
      if (segment.entryId && !this.store.getEntryById(segment.entryId)) {
        throw new MockDomainError("ENTRY_NOT_FOUND", "片段关联的条目不存在");
      }
    }
    assertSegmentsPartitionSession({ startedAt: session.startedAt, endedAt: session.endedAt }, segments);
    return this.store.updateFocusSession(sessionId, segments);
  }

  discardFocusSession(): void {
    const active = this.getActiveFocus();
    if (!active) {
      throw new MockDomainError("FOCUS_NOT_FOUND", "活动专注会话不存在");
    }
    this.store.discardFocusSession(active.id);
  }

  addManualFocusSession(input: Parameters<MockDataStore["addManualFocusSession"]>[0]) {
    if (input.entryId && !this.store.getEntryById(input.entryId)) {
      throw new MockDomainError("ENTRY_NOT_FOUND", "关联条目不存在");
    }
    assertNoFocusOverlap(this.getFocusSessions(), input.startedAt, input.endedAt);
    return this.store.addManualFocusSession(input);
  }

  addScheduleBlock(input: ScheduleBlockInput) { return this.store.addScheduleBlock(input); }
  updateScheduleBlock(id: string, input: UpdateScheduleBlockInput) {
    const current = this.store.getScheduleBlocks().find((block) => block.id === id);
    if (!current) throw new MockDomainError("SCHEDULE_NOT_FOUND", "日程不存在");
    return this.store.updateScheduleBlock(id, input);
  }
  deleteScheduleBlock(id: string) {
    if (!this.store.getScheduleBlocks().some((block) => block.id === id)) {
      throw new MockDomainError("SCHEDULE_NOT_FOUND", "日程不存在");
    }
    this.store.deleteScheduleBlock(id);
  }
  confirmIcsImport(selectedUids: string[]) { return this.store.confirmIcsImport(selectedUids); }
}
