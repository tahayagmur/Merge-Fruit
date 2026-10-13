import type { ApiErrorBody, ApiErrorCode, ApiErrorDetail } from "@/lib/api/errors";

/** Error thrown by apiRequest; carries the server's error code and field details. */
export class ApiClientError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly details: ApiErrorDetail[];

  constructor(code: ApiErrorCode, message: string, status: number, details: ApiErrorDetail[] = []) {
    super(message);
    this.name = "ApiClientError";
    this.code = code;
    this.status = status;
    this.details = details;
  }

  /** Field errors keyed by the first path segment, for inline form messages. */
  fieldErrors(): Record<string, string> {
    const errors: Record<string, string> = {};
    for (const detail of this.details) {
      const key = detail.path.split(".")[0];
      errors[key] ??= detail.message;
    }
    return errors;
  }
}

type Method = "GET" | "POST" | "PATCH" | "DELETE";

/** Browser-side helper for the AI HQ JSON API. */
export async function apiRequest<T>(path: string, options: { method?: Method; body?: unknown } = {}): Promise<T> {
  const { method = "GET", body } = options;
  let response: Response;
  try {
    response = await fetch(path, {
      method,
      credentials: "same-origin",
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiClientError("UPSTREAM_UNAVAILABLE", "Network error. Check your connection and try again.", 0);
  }

  if (response.status === 204) return undefined as T;

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const error = (payload as Partial<ApiErrorBody> | null)?.error;
    if (response.status === 401 && typeof window !== "undefined") {
      // Session expired: reloading lets proxy.ts send the user to the login page.
      window.location.reload();
    }
    throw new ApiClientError(
      error?.code ?? "INTERNAL_ERROR",
      error?.message ?? `Request failed with status ${response.status}.`,
      response.status,
      error?.details ?? [],
    );
  }

  return (payload as { data: T }).data;
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiClientError) return error.message;
  return "Something went wrong. Try again.";
}
