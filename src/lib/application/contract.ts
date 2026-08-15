import {
  AuthSession,
  CalendarPayload,
  Capabilities,
  DashboardPayload,
  Entry,
  FocusSegment,
  FocusSession,
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
  UserDataExport,
  WeekPlan,
  WeekPlanItemInput,
} from "@/lib/domain/types";
import { parseWeekStart, WEEK_START_MESSAGES } from "@/lib/domain/week-plan";
import { z } from "zod";

const optionalProfileText = z.string().trim().max(80).nullable().optional();

export const profileUpdateSchema = z.object({
  nickname: optionalProfileText,
  email: z.string().trim().email("邮箱格式不正确").max(254).nullable().optional(),
}).strict();

export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;

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

export const statisticsScaleSchema = z.enum(["day", "week", "month"]);

export type StatisticsScale = z.infer<typeof statisticsScaleSchema>;

export const weekStartSchema = z.string().superRefine((value, ctx) => {
  const issue = parseWeekStart(value);
  if (issue) ctx.addIssue({ code: "custom", message: WEEK_START_MESSAGES[issue] });
});

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
  getExistingWeekPlan(weekStart: string): WeekPlan | null;
  updateWeekPlanNote(note: string, weekStart?: string): void;
  addToWeekPlan(entryId: string, weekStart?: string, input?: Partial<WeekPlanItemInput>): void;
  updateWeekPlanItem(entryId: string, input: WeekPlanItemInput, weekStart?: string): void;
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
  discardFocusSession(): void;
  addManualFocusSession(input: ManualFocusInput): FocusSession;

  getScheduleBlocks(): ScheduleBlock[];
  getScheduleImports(): ScheduleImport[];
  deleteScheduleImport(id: string): void;
  getScheduleTemplates(): ScheduleTemplate[];
  createScheduleTemplate(input: ScheduleTemplateInput): ScheduleTemplate;
  updateScheduleTemplate(id: string, input: ScheduleTemplateInput): ScheduleTemplate;
  deleteScheduleTemplate(id: string): void;
  previewScheduleTemplate(id: string, fromDate: string, toDate: string): ScheduleTemplatePreview;
  applyScheduleTemplate(id: string, fromDate: string, toDate: string): ScheduleTemplateApplication;
  getScheduleTemplateApplications(): ScheduleTemplateApplication[];
  deleteScheduleTemplateApplication(id: string): void;
  addScheduleBlock(input: ScheduleBlockInput): ScheduleBlock;
  updateScheduleBlock(id: string, input: UpdateScheduleBlockInput): ScheduleBlock;
  deleteScheduleBlock(id: string): void;
  getCalendarPayload(from?: string, to?: string): CalendarPayload;
  getDashboardPayload(): DashboardPayload;
  getStatisticsPayload(scale?: StatisticsScale, weekStart?: string): StatisticsPayload;
  exportUserData(): UserDataExport;
}
