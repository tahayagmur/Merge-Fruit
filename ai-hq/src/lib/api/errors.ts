import type { z } from "zod";

export const API_ERROR_STATUS = {
  VALIDATION_ERROR: 400,
  INVALID_JSON: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  PAYLOAD_TOO_LARGE: 413,
  RULE_VIOLATION: 422,
  UNSUPPORTED_MEDIA_TYPE: 415,
  INTERNAL_ERROR: 500,
  CONFIGURATION_ERROR: 503,
  UPSTREAM_UNAVAILABLE: 503,
} as const;

export type ApiErrorCode = keyof typeof API_ERROR_STATUS;

export interface ApiErrorDetail {
  path: string;
  message: string;
}

/** Shape of every error body returned by /api routes. */
export interface ApiErrorBody {
  error: {
    code: ApiErrorCode;
    message: string;
    details?: ApiErrorDetail[];
    requestId?: string;
  };
}

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly details?: ApiErrorDetail[];

  constructor(code: ApiErrorCode, message: string, details?: ApiErrorDetail[]) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = API_ERROR_STATUS[code];
    this.details = details;
  }

  static notFound(entity: string) {
    return new ApiError("NOT_FOUND", `${entity} not found.`);
  }

  static fromZod(error: z.ZodError, message = "The request contains invalid fields.") {
    return new ApiError(
      "VALIDATION_ERROR",
      message,
      error.issues.map((issue) => ({
        path: issue.path.map(String).join(".") || "(root)",
        message: issue.message,
      })),
    );
  }
}
