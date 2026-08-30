import {
  AuthSession,
  CalendarPayload,
  Capabilities,
  DashboardPayload,
  Entry,
  Expense,
  ExpenseCategory,
  ExpenseCurrency,
  ExpenseOccurrencePrecision,
  ExpenseSource,
  ExpenseTag,
  FocusSegment,
  FocusSession,
  PaymentMethod,
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

export type CaptureExpenseInput = {
  /** Stable client UUID reused across retries for the same capture. */
  id: string;
  amountCents: number;
  currency?: ExpenseCurrency;
  occurredAt?: string;
  occurredOn?: string;
  occurredTimezone?: string | null;
  occurrencePrecision?: ExpenseOccurrencePrecision;
  captureMessage?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  source?: ExpenseSource;
};

export type CaptureExpenseResult = {
  expense: Expense;
  created: boolean;
};

export type UpdateExpenseInput = Partial<Pick<
  Expense,
  "amountCents" | "occurredAt" | "occurredOn" | "occurrencePrecision" | "note" | "categoryId" | "paymentMethodId" | "reviewStatus" | "recoverableCents" | "settled"
>> & {
  tagIds?: string[];
};

export type CreateExpenseDimensionInput = {
  name: string;
};

export type MergeExpenseDimensionInput = {
  targetId: string;
};

export type ApiKeyMetadata = { id: string; name: string; createdAt: string; lastUsedAt: string | null; revokedAt: string | null };
export type ApiKeyCreated = ApiKeyMetadata & { apiKey: string };

export interface ApiKeyApplicationService {
  createApiKey(name: string): ApiKeyCreated;
  listApiKeys(): ApiKeyMetadata[];
  revealApiKey(id: string): string;
  revokeApiKey(id: string): void;
}

/**
 * Separate from the existing dashboard service so the current mock adapter does
 * not accidentally claim support for persistent expense operations.
 */
export interface ExpenseApplicationService {
  createExpenseCategory(input: CreateExpenseDimensionInput): ExpenseCategory;
  getExpenseCategories(includeArchived?: boolean): ExpenseCategory[];
  renameExpenseCategory(id: string, input: CreateExpenseDimensionInput): ExpenseCategory;
  archiveExpenseCategory(id: string): ExpenseCategory;
  restoreExpenseCategory(id: string): ExpenseCategory;
  mergeExpenseCategory(id: string, input: MergeExpenseDimensionInput): ExpenseCategory;
  createExpenseTag(input: CreateExpenseDimensionInput): ExpenseTag;
  getExpenseTags(includeArchived?: boolean): ExpenseTag[];
  renameExpenseTag(id: string, input: CreateExpenseDimensionInput): ExpenseTag;
  archiveExpenseTag(id: string): ExpenseTag;
  restoreExpenseTag(id: string): ExpenseTag;
  mergeExpenseTag(id: string, input: MergeExpenseDimensionInput): ExpenseTag;
  createPaymentMethod(input: CreateExpenseDimensionInput): PaymentMethod;
  getPaymentMethods(includeArchived?: boolean): PaymentMethod[];
  renamePaymentMethod(id: string, input: CreateExpenseDimensionInput): PaymentMethod;
  archivePaymentMethod(id: string): PaymentMethod;
  restorePaymentMethod(id: string): PaymentMethod;
  mergePaymentMethod(id: string, input: MergeExpenseDimensionInput): PaymentMethod;

  captureExpense(input: CaptureExpenseInput): CaptureExpenseResult;
  getExpenses(): Expense[];
  getInboxExpenses(): Expense[];
  getExpenseById(id: string, options?: { includeDeleted?: boolean }): Expense | undefined;
  updateExpense(id: string, input: UpdateExpenseInput): Expense;
  deleteExpense(id: string): void;
}

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
  updateFocusSession(sessionId: string, segments: FocusSegment[]): FocusSession;
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
