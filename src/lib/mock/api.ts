import { mockStore } from "./store";
import { MockApplicationService } from "./service";
import { LoginInput, RegisterInput } from "@/lib/application/contract";

/**
 * Client-side stand-in for the documented same-origin JSON API. Components use
 * this adapter exclusively, so its implementation can later become fetch calls.
 */
export class MockApiAdapter {
  constructor(private readonly service: MockApplicationService) {}

  subscribe(listener: () => void) { return this.service.subscribe(listener); }
  getScenario() { return this.service.getScenario(); }
  setScenario(preset: Parameters<MockApplicationService["setScenario"]>[0]) { return this.service.setScenario(preset); }
  getCapabilities() { return this.service.getCapabilities(); }
  getSession() { return this.service.getSession(); }
  register(input: RegisterInput) { return this.service.register(input); }
  login(input: LoginInput) { return this.service.login(input); }
  logout() { return this.service.logout(); }
  getUser() { return this.service.getUser(); }
  updateUserProfile(nickname: string | null, email: string | null) { return this.service.updateUserProfile(nickname, email); }
  getEntries() { return this.service.getEntries(); }
  getEntryById(id: string) { return this.service.getEntryById(id); }
  addEntry(input: Parameters<MockApplicationService["addEntry"]>[0]) { return this.service.addEntry(input); }
  updateEntry(id: string, updates: Parameters<MockApplicationService["updateEntry"]>[1]) { return this.service.updateEntry(id, updates); }
  moveEntry(id: string, parentId: string | null) { return this.service.moveEntry(id, parentId); }
  deleteEntry(id: string) { return this.service.deleteEntry(id); }
  getExpenses() { return this.service.getExpenses(); }
  getExpenseHistoryPage(limit?: number, before?: string) { return this.service.getExpenseHistoryPage(limit, before); }
  getInboxExpenses() { return this.service.getInboxExpenses(); }
  getExpenseCategories(includeArchived?: boolean) { return this.service.getExpenseCategories(includeArchived); }
  getExpenseTags(includeArchived?: boolean) { return this.service.getExpenseTags(includeArchived); }
  getPaymentMethods(includeArchived?: boolean) { return this.service.getPaymentMethods(includeArchived); }
  captureExpense(...args: Parameters<MockApplicationService["captureExpense"]>) { return this.service.captureExpense(...args); }
  updateExpense(...args: Parameters<MockApplicationService["updateExpense"]>) { return this.service.updateExpense(...args); }
  createExpenseCategory(...args: Parameters<MockApplicationService["createExpenseCategory"]>) { return this.service.createExpenseCategory(...args); }
  renameExpenseCategory(...args: Parameters<MockApplicationService["renameExpenseCategory"]>) { return this.service.renameExpenseCategory(...args); }
  archiveExpenseCategory(...args: Parameters<MockApplicationService["archiveExpenseCategory"]>) { return this.service.archiveExpenseCategory(...args); }
  restoreExpenseCategory(...args: Parameters<MockApplicationService["restoreExpenseCategory"]>) { return this.service.restoreExpenseCategory(...args); }
  mergeExpenseCategory(...args: Parameters<MockApplicationService["mergeExpenseCategory"]>) { return this.service.mergeExpenseCategory(...args); }
  createExpenseTag(...args: Parameters<MockApplicationService["createExpenseTag"]>) { return this.service.createExpenseTag(...args); }
  renameExpenseTag(...args: Parameters<MockApplicationService["renameExpenseTag"]>) { return this.service.renameExpenseTag(...args); }
  archiveExpenseTag(...args: Parameters<MockApplicationService["archiveExpenseTag"]>) { return this.service.archiveExpenseTag(...args); }
  restoreExpenseTag(...args: Parameters<MockApplicationService["restoreExpenseTag"]>) { return this.service.restoreExpenseTag(...args); }
  mergeExpenseTag(...args: Parameters<MockApplicationService["mergeExpenseTag"]>) { return this.service.mergeExpenseTag(...args); }
  createPaymentMethod(...args: Parameters<MockApplicationService["createPaymentMethod"]>) { return this.service.createPaymentMethod(...args); }
  renamePaymentMethod(...args: Parameters<MockApplicationService["renamePaymentMethod"]>) { return this.service.renamePaymentMethod(...args); }
  archivePaymentMethod(...args: Parameters<MockApplicationService["archivePaymentMethod"]>) { return this.service.archivePaymentMethod(...args); }
  restorePaymentMethod(...args: Parameters<MockApplicationService["restorePaymentMethod"]>) { return this.service.restorePaymentMethod(...args); }
  mergePaymentMethod(...args: Parameters<MockApplicationService["mergePaymentMethod"]>) { return this.service.mergePaymentMethod(...args); }
  getExpenseById(...args: Parameters<MockApplicationService["getExpenseById"]>) { return this.service.getExpenseById(...args); }
  deleteExpense(...args: Parameters<MockApplicationService["deleteExpense"]>) { return this.service.deleteExpense(...args); }
  getWeekPlan(weekStart?: string) { return this.service.getWeekPlan(weekStart); }
  getExistingWeekPlan(weekStart: string) { return this.service.getExistingWeekPlan(weekStart); }
  updateWeekPlanNote(note: string, weekStart?: string) { return this.service.updateWeekPlanNote(note, weekStart); }
  addToWeekPlan(entryId: string, weekStart?: string, input?: Parameters<MockApplicationService["addToWeekPlan"]>[2]) { return this.service.addToWeekPlan(entryId, weekStart, input); }
  updateWeekPlanItem(entryId: string, input: Parameters<MockApplicationService["updateWeekPlanItem"]>[1], weekStart?: string) { return this.service.updateWeekPlanItem(entryId, input, weekStart); }
  removeFromWeekPlan(entryId: string, weekStart?: string) { return this.service.removeFromWeekPlan(entryId, weekStart); }
  getActiveFocus() { return this.service.getActiveFocus(); }
  getFocusSessions() { return this.service.getFocusSessions(); }
  startFocusSession(entryId?: string | null) { return this.service.startFocusSession(entryId); }
  stopFocusSession(...args: Parameters<MockApplicationService["stopFocusSession"]>) { return this.service.stopFocusSession(...args); }
  updateFocusSession(...args: Parameters<MockApplicationService["updateFocusSession"]>) { return this.service.updateFocusSession(...args); }
  discardFocusSession() { return this.service.discardFocusSession(); }
  addManualFocusSession(input: Parameters<MockApplicationService["addManualFocusSession"]>[0]) { return this.service.addManualFocusSession(input); }
  getScheduleBlocks() { return this.service.getScheduleBlocks(); }
  getScheduleImports() { return this.service.getScheduleImports(); }
  deleteScheduleImport(id: string) { return this.service.deleteScheduleImport(id); }
  getScheduleTemplates() { return this.service.getScheduleTemplates(); }
  createScheduleTemplate(input: Parameters<MockApplicationService["createScheduleTemplate"]>[0]) { return this.service.createScheduleTemplate(input); }
  updateScheduleTemplate(...args: Parameters<MockApplicationService["updateScheduleTemplate"]>) { return this.service.updateScheduleTemplate(...args); }
  deleteScheduleTemplate(id: string) { return this.service.deleteScheduleTemplate(id); }
  previewScheduleTemplate(...args: Parameters<MockApplicationService["previewScheduleTemplate"]>) { return this.service.previewScheduleTemplate(...args); }
  applyScheduleTemplate(...args: Parameters<MockApplicationService["applyScheduleTemplate"]>) { return this.service.applyScheduleTemplate(...args); }
  getScheduleTemplateApplications() { return this.service.getScheduleTemplateApplications(); }
  deleteScheduleTemplateApplication(id: string) { return this.service.deleteScheduleTemplateApplication(id); }
  addScheduleBlock(input: Parameters<MockApplicationService["addScheduleBlock"]>[0]) { return this.service.addScheduleBlock(input); }
  updateScheduleBlock(...args: Parameters<MockApplicationService["updateScheduleBlock"]>) { return this.service.updateScheduleBlock(...args); }
  deleteScheduleBlock(id: string) { return this.service.deleteScheduleBlock(id); }
  getIcsPreview() { return this.service.getIcsPreview(); }
  confirmIcsImport(ids: string[]) { return this.service.confirmIcsImport(ids); }
  getDashboardPayload() { return this.service.getDashboardPayload(); }
  getStatisticsPayload(...args: Parameters<MockApplicationService["getStatisticsPayload"]>) { return this.service.getStatisticsPayload(...args); }
  getCalendarPayload(from?: string, to?: string) { return this.service.getCalendarPayload(from, to); }
}

export const mockApi = new MockApiAdapter(new MockApplicationService(mockStore));
