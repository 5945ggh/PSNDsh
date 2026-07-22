import {
  AuthSession,
  Capabilities,
  DashboardPayload,
  Entry,
  FocusSegment,
  FocusSession,
  IcsImportPreview,
  ScheduleBlock,
  ScheduleBlockInput,
  StatisticsPayload,
  UserProfile,
  WeekPlan,
} from "@/types/mock";

export type RegisterInput = {
  username: string;
  password: string;
  passwordConfirmation: string;
};

export type LoginInput = Pick<RegisterInput, "username" | "password">;

export type AddEntryInput = Pick<
  Entry,
  "parentId" | "title" | "description" | "completionMode" | "dueAt"
>;

export type UpdateEntryInput = Partial<
  Pick<
    Entry,
    | "parentId"
    | "title"
    | "description"
    | "completionMode"
    | "status"
    | "dueAt"
    | "sortKey"
  >
>;

export type ManualFocusInput = {
  startedAt: string;
  endedAt: string;
  note: string | null;
  outcome: string | null;
  entryId: string | null;
};

export interface ApplicationService {
  getCapabilities(): Capabilities;
  getSession(): AuthSession;
  getUser(): UserProfile | null;
  register(input: RegisterInput): AuthSession;
  login(input: LoginInput): AuthSession;
  logout(): void;
  updateUserProfile(nickname: string | null, email: string | null): UserProfile;

  getEntries(): Entry[];
  getEntryById(id: string): Entry | undefined;
  addEntry(input: AddEntryInput): Entry;
  updateEntry(id: string, updates: UpdateEntryInput): Entry;
  moveEntry(id: string, parentId: string | null): Entry;
  deleteEntry(id: string): void;

  getWeekPlan(weekStart?: string): WeekPlan;
  updateWeekPlanNote(note: string, weekStart?: string): void;
  addToWeekPlan(entryId: string, weekStart?: string): void;
  removeFromWeekPlan(entryId: string, weekStart?: string): void;

  getActiveFocus(): FocusSession | null;
  getFocusSessions(): FocusSession[];
  startFocusSession(entryId?: string | null): FocusSession;
  stopFocusSession(
    sessionId: string,
    outcome: string | null,
    note: string | null,
    submittedSegments: FocusSegment[]
  ): FocusSession;
  addManualFocusSession(input: ManualFocusInput): FocusSession;

  getScheduleBlocks(): ScheduleBlock[];
  addScheduleBlock(input: ScheduleBlockInput): ScheduleBlock;
  deleteScheduleBlock(id: string): void;
  getIcsPreview(): IcsImportPreview;
  confirmIcsImport(selectedSourceUids: string[]): number;

  getDashboardPayload(): DashboardPayload;
  getStatisticsPayload(scale?: "day" | "week" | "month"): StatisticsPayload;
}
