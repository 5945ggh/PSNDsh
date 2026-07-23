export type ApplicationErrorCode =
  | "UNAUTHORIZED"
  | "ENTRY_NOT_FOUND"
  | "ENTRY_MOVE_INVALID"
  | "ENTRY_STATUS_INVALID"
  | "FOCUS_ALREADY_ACTIVE"
  | "FOCUS_NOT_FOUND"
  | "FOCUS_OVERLAP"
  | "SEGMENTS_INVALID_PARTITION"
  | "SCHEDULE_NOT_FOUND"
  | "SCHEDULE_TEMPLATE_NOT_FOUND"
  | "SCHEDULE_TEMPLATE_APPLICATION_NOT_FOUND"
  | "REGISTRATION_CLOSED"
  | "USERNAME_TAKEN"
  | "PASSWORD_TOO_WEAK"
  | "PASSWORD_MISMATCH"
  | "INVALID_CREDENTIALS"
  | "RATE_LIMITED"
  | "CSRF_INVALID"
  | "REQUEST_INVALID"
  | "ICS_PARSE_FAILED"
  | "ICS_PREVIEW_EXPIRED";

export class ApplicationError extends Error {
  constructor(
    public readonly code: ApplicationErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(`${code}: ${message}`);
    this.name = "ApplicationError";
  }
}
