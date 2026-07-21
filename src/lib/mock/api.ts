import { mockStore } from "./store";
import { LoginInput, MockApplicationService, RegisterInput } from "./service";

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
  getWeekPlan(weekStart?: string) { return this.service.getWeekPlan(weekStart); }
  updateWeekPlanNote(note: string, weekStart?: string) { return this.service.updateWeekPlanNote(note, weekStart); }
  addToWeekPlan(entryId: string, weekStart?: string) { return this.service.addToWeekPlan(entryId, weekStart); }
  removeFromWeekPlan(entryId: string, weekStart?: string) { return this.service.removeFromWeekPlan(entryId, weekStart); }
  getActiveFocus() { return this.service.getActiveFocus(); }
  getFocusSessions() { return this.service.getFocusSessions(); }
  startFocusSession(entryId?: string | null) { return this.service.startFocusSession(entryId); }
  stopFocusSession(...args: Parameters<MockApplicationService["stopFocusSession"]>) { return this.service.stopFocusSession(...args); }
  addManualFocusSession(input: Parameters<MockApplicationService["addManualFocusSession"]>[0]) { return this.service.addManualFocusSession(input); }
  getScheduleBlocks() { return this.service.getScheduleBlocks(); }
  addScheduleBlock(input: Parameters<MockApplicationService["addScheduleBlock"]>[0]) { return this.service.addScheduleBlock(input); }
  deleteScheduleBlock(id: string) { return this.service.deleteScheduleBlock(id); }
  getIcsPreview() { return this.service.getIcsPreview(); }
  confirmIcsImport(ids: string[]) { return this.service.confirmIcsImport(ids); }
  getDashboardPayload() { return this.service.getDashboardPayload(); }
  getStatisticsPayload(scale?: "day" | "week" | "month") { return this.service.getStatisticsPayload(scale); }
}

export const mockApi = new MockApiAdapter(new MockApplicationService(mockStore));
