import { ApiAdapter, PersistentApiAdapter } from "@/lib/api/client";
import { MockApiAdapter, mockApi } from "@/lib/mock/api";

export type DataTransport = "mock" | "persistent";

export type MockApiFeatures = {
  subscribe(listener: () => void): () => void;
  getScenario: MockApiAdapter["getScenario"];
  setScenario: MockApiAdapter["setScenario"];
};

const asPromise = <T>(operation: () => T) => Promise.resolve().then(operation);

/** Makes the in-memory demo obey the same asynchronous API contract as HTTP. */
class AsyncMockApiAdapter implements ApiAdapter, MockApiFeatures {
  constructor(private readonly mock: MockApiAdapter) {}

  subscribe(listener: () => void) {
    return this.mock.subscribe(listener);
  }

  getScenario() {
    return this.mock.getScenario();
  }

  setScenario(...args: Parameters<MockApiAdapter["setScenario"]>) {
    return this.mock.setScenario(...args);
  }

  getCapabilities() { return asPromise(() => this.mock.getCapabilities()); }
  getSession() { return asPromise(() => this.mock.getSession()); }
  getUser() { return asPromise(() => this.mock.getUser()); }
  register(...args: Parameters<MockApiAdapter["register"]>) { return asPromise(() => this.mock.register(...args)); }
  login(...args: Parameters<MockApiAdapter["login"]>) { return asPromise(() => this.mock.login(...args)); }
  logout() { return asPromise(() => this.mock.logout()); }
  updateUserProfile(...args: Parameters<MockApiAdapter["updateUserProfile"]>) { return asPromise(() => this.mock.updateUserProfile(...args)); }
  getEntries() { return asPromise(() => this.mock.getEntries()); }
  getEntryById(...args: Parameters<MockApiAdapter["getEntryById"]>) {
    return asPromise(() => {
      const entry = this.mock.getEntryById(...args);
      if (!entry) throw new Error("ENTRY_NOT_FOUND: 条目不存在");
      return entry;
    });
  }
  addEntry(...args: Parameters<MockApiAdapter["addEntry"]>) { return asPromise(() => this.mock.addEntry(...args)); }
  updateEntry(...args: Parameters<MockApiAdapter["updateEntry"]>) { return asPromise(() => this.mock.updateEntry(...args)); }
  moveEntry(...args: Parameters<MockApiAdapter["moveEntry"]>) { return asPromise(() => this.mock.moveEntry(...args)); }
  deleteEntry(...args: Parameters<MockApiAdapter["deleteEntry"]>) { return asPromise(() => this.mock.deleteEntry(...args)); }
  getWeekPlan(...args: Parameters<MockApiAdapter["getWeekPlan"]>) { return asPromise(() => this.mock.getWeekPlan(...args)); }
  getExistingWeekPlan(...args: Parameters<MockApiAdapter["getExistingWeekPlan"]>) {
    return asPromise(() => this.mock.getExistingWeekPlan(...args));
  }
  updateWeekPlanNote(note: string, weekStart?: string) {
    return asPromise(() => {
      this.mock.updateWeekPlanNote(note, weekStart);
      return this.mock.getWeekPlan(weekStart);
    });
  }
  addToWeekPlan(entryId: string, weekStart?: string, input?: Parameters<MockApiAdapter["addToWeekPlan"]>[2]) {
    return asPromise(() => {
      this.mock.addToWeekPlan(entryId, weekStart, input);
      return this.mock.getWeekPlan(weekStart);
    });
  }
  updateWeekPlanItem(entryId: string, input: Parameters<MockApiAdapter["updateWeekPlanItem"]>[1], weekStart?: string) {
    return asPromise(() => {
      this.mock.updateWeekPlanItem(entryId, input, weekStart);
      return this.mock.getWeekPlan(weekStart);
    });
  }
  removeFromWeekPlan(entryId: string, weekStart?: string) {
    return asPromise(() => {
      this.mock.removeFromWeekPlan(entryId, weekStart);
      return this.mock.getWeekPlan(weekStart);
    });
  }
  getActiveFocus() { return asPromise(() => this.mock.getActiveFocus()); }
  getFocusSessions() { return asPromise(() => this.mock.getFocusSessions()); }
  startFocusSession(...args: Parameters<MockApiAdapter["startFocusSession"]>) { return asPromise(() => this.mock.startFocusSession(...args)); }
  stopFocusSession(...args: Parameters<MockApiAdapter["stopFocusSession"]>) { return asPromise(() => this.mock.stopFocusSession(...args)); }
  updateFocusSession(...args: Parameters<MockApiAdapter["updateFocusSession"]>) { return asPromise(() => this.mock.updateFocusSession(...args)); }
  discardFocusSession() { return asPromise(() => this.mock.discardFocusSession()); }
  addManualFocusSession(...args: Parameters<MockApiAdapter["addManualFocusSession"]>) { return asPromise(() => this.mock.addManualFocusSession(...args)); }
  getScheduleBlocks() { return asPromise(() => this.mock.getScheduleBlocks()); }
  getScheduleImports() { return asPromise(() => this.mock.getScheduleImports()); }
  deleteScheduleImport(...args: Parameters<MockApiAdapter["deleteScheduleImport"]>) { return asPromise(() => this.mock.deleteScheduleImport(...args)); }
  getScheduleTemplates() { return asPromise(() => this.mock.getScheduleTemplates()); }
  createScheduleTemplate(...args: Parameters<MockApiAdapter["createScheduleTemplate"]>) { return asPromise(() => this.mock.createScheduleTemplate(...args)); }
  updateScheduleTemplate(...args: Parameters<MockApiAdapter["updateScheduleTemplate"]>) { return asPromise(() => this.mock.updateScheduleTemplate(...args)); }
  deleteScheduleTemplate(...args: Parameters<MockApiAdapter["deleteScheduleTemplate"]>) { return asPromise(() => this.mock.deleteScheduleTemplate(...args)); }
  previewScheduleTemplate(...args: Parameters<MockApiAdapter["previewScheduleTemplate"]>) { return asPromise(() => this.mock.previewScheduleTemplate(...args)); }
  applyScheduleTemplate(...args: Parameters<MockApiAdapter["applyScheduleTemplate"]>) { return asPromise(() => this.mock.applyScheduleTemplate(...args)); }
  getScheduleTemplateApplications() { return asPromise(() => this.mock.getScheduleTemplateApplications()); }
  deleteScheduleTemplateApplication(...args: Parameters<MockApiAdapter["deleteScheduleTemplateApplication"]>) { return asPromise(() => this.mock.deleteScheduleTemplateApplication(...args)); }
  addScheduleBlock(...args: Parameters<MockApiAdapter["addScheduleBlock"]>) { return asPromise(() => this.mock.addScheduleBlock(...args)); }
  updateScheduleBlock(...args: Parameters<MockApiAdapter["updateScheduleBlock"]>) { return asPromise(() => this.mock.updateScheduleBlock(...args)); }
  deleteScheduleBlock(...args: Parameters<MockApiAdapter["deleteScheduleBlock"]>) { return asPromise(() => this.mock.deleteScheduleBlock(...args)); }
  previewIcsImport(fileName: string) {
    return asPromise(() => ({ ...this.mock.getIcsPreview(), fileName }));
  }
  confirmIcsImport(_importId: string, selectedUids: string[]) {
    return asPromise(() => this.mock.confirmIcsImport(selectedUids));
  }
  getDashboardPayload() { return asPromise(() => this.mock.getDashboardPayload()); }
  getStatisticsPayload(...args: Parameters<MockApiAdapter["getStatisticsPayload"]>) { return asPromise(() => this.mock.getStatisticsPayload(...args)); }
  getCalendarPayload(...args: Parameters<MockApiAdapter["getCalendarPayload"]>) {
    return asPromise(() => this.mock.getCalendarPayload(...args));
  }
  getExpenses() { return asPromise(() => this.mock.getExpenses()); }
  getInboxExpenses() { return asPromise(() => this.mock.getInboxExpenses()); }
  getExpenseCategories(...args: Parameters<MockApiAdapter["getExpenseCategories"]>) { return asPromise(() => this.mock.getExpenseCategories(...args)); }
  getExpenseTags(...args: Parameters<MockApiAdapter["getExpenseTags"]>) { return asPromise(() => this.mock.getExpenseTags(...args)); }
  getPaymentMethods(...args: Parameters<MockApiAdapter["getPaymentMethods"]>) { return asPromise(() => this.mock.getPaymentMethods(...args)); }
  createExpenseCategory(...args: Parameters<MockApiAdapter["createExpenseCategory"]>) { return asPromise(() => this.mock.createExpenseCategory(...args)); }
  renameExpenseCategory(...args: Parameters<MockApiAdapter["renameExpenseCategory"]>) { return asPromise(() => this.mock.renameExpenseCategory(...args)); }
  archiveExpenseCategory(...args: Parameters<MockApiAdapter["archiveExpenseCategory"]>) { return asPromise(() => this.mock.archiveExpenseCategory(...args)); }
  restoreExpenseCategory(...args: Parameters<MockApiAdapter["restoreExpenseCategory"]>) { return asPromise(() => this.mock.restoreExpenseCategory(...args)); }
  mergeExpenseCategory(...args: Parameters<MockApiAdapter["mergeExpenseCategory"]>) { return asPromise(() => this.mock.mergeExpenseCategory(...args)); }
  createExpenseTag(...args: Parameters<MockApiAdapter["createExpenseTag"]>) { return asPromise(() => this.mock.createExpenseTag(...args)); }
  renameExpenseTag(...args: Parameters<MockApiAdapter["renameExpenseTag"]>) { return asPromise(() => this.mock.renameExpenseTag(...args)); }
  archiveExpenseTag(...args: Parameters<MockApiAdapter["archiveExpenseTag"]>) { return asPromise(() => this.mock.archiveExpenseTag(...args)); }
  restoreExpenseTag(...args: Parameters<MockApiAdapter["restoreExpenseTag"]>) { return asPromise(() => this.mock.restoreExpenseTag(...args)); }
  mergeExpenseTag(...args: Parameters<MockApiAdapter["mergeExpenseTag"]>) { return asPromise(() => this.mock.mergeExpenseTag(...args)); }
  createPaymentMethod(...args: Parameters<MockApiAdapter["createPaymentMethod"]>) { return asPromise(() => this.mock.createPaymentMethod(...args)); }
  renamePaymentMethod(...args: Parameters<MockApiAdapter["renamePaymentMethod"]>) { return asPromise(() => this.mock.renamePaymentMethod(...args)); }
  archivePaymentMethod(...args: Parameters<MockApiAdapter["archivePaymentMethod"]>) { return asPromise(() => this.mock.archivePaymentMethod(...args)); }
  restorePaymentMethod(...args: Parameters<MockApiAdapter["restorePaymentMethod"]>) { return asPromise(() => this.mock.restorePaymentMethod(...args)); }
  mergePaymentMethod(...args: Parameters<MockApiAdapter["mergePaymentMethod"]>) { return asPromise(() => this.mock.mergePaymentMethod(...args)); }
  updateExpense(...args: Parameters<MockApiAdapter["updateExpense"]>) { return asPromise(() => this.mock.updateExpense(...args)); }
  captureExpense(...args: Parameters<MockApiAdapter["captureExpense"]>) { return asPromise(() => this.mock.captureExpense(...args).expense); }
}

export const isMockApiFeatures = (
  adapter: ApiAdapter | MockApiFeatures
): adapter is ApiAdapter & MockApiFeatures => "subscribe" in adapter;

export const getDataTransport = (): DataTransport =>
  process.env.NEXT_PUBLIC_DATA_TRANSPORT === "mock" ? "mock" : "persistent";

export const createApiAdapter = (transport: DataTransport): ApiAdapter =>
  transport === "persistent"
    ? new PersistentApiAdapter()
    : new AsyncMockApiAdapter(mockApi);
