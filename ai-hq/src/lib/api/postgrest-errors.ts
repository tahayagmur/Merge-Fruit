import { ApiError } from "./errors";

/** Minimal shape of the error objects returned by supabase-js / PostgREST. */
export interface PostgrestLikeError {
  code?: string;
  message: string;
  details?: string | null;
  hint?: string | null;
}

/**
 * Translates database errors into client-safe API errors. Raw database
 * messages are never forwarded: they can reveal schema details.
 */
/** SQLSTATE used by AI HQ's own database rules; their messages are written for users. */
export const BUSINESS_RULE_CODE = "AHQ01";

export function mapPostgrestError(error: PostgrestLikeError, entity = "Record"): ApiError {
  switch (error.code) {
    case BUSINESS_RULE_CODE:
      return new ApiError("RULE_VIOLATION", error.message.slice(0, 300));
    case "PGRST116":
    case "P0002": // no_data_found raised by our functions
      return ApiError.notFound(entity);
    case "22023": // invalid_parameter_value (e.g. unknown time zone)
    case "23514": // check_violation
    case "23502": // not_null_violation
    case "22001": // string_data_right_truncation
    case "22007": // invalid_datetime_format
    case "22008": // datetime_field_overflow
    case "22P02": // invalid_text_representation
      return new ApiError("VALIDATION_ERROR", "One or more values were rejected by the database.");
    case "23503": // foreign_key_violation
      return new ApiError("CONFLICT", "A related record does not exist or is not accessible.");
    case "23505": // unique_violation
      return new ApiError("CONFLICT", `${entity} already exists.`);
    case "42501": // insufficient_privilege, including RLS violations
      return new ApiError("FORBIDDEN", "You do not have access to this resource.");
    case "PGRST301": // JWT invalid / expired
    case "PGRST302":
      return new ApiError("UNAUTHENTICATED", "Your session has expired. Sign in again.");
    default:
      return new ApiError("INTERNAL_ERROR", "The request could not be completed.");
  }
}
