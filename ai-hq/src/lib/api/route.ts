import "server-only";

import { unstable_rethrow } from "next/navigation";
import { NextResponse, type NextRequest } from "next/server";
import type { z } from "zod";
import { getAuthContext, type AuthUser } from "@/lib/auth/session";
import { ConfigurationError } from "@/lib/env";
import { logger } from "@/lib/logger";
import type { AppSupabaseClient } from "@/lib/supabase/server";
import { ApiError, type ApiErrorBody } from "./errors";

export const MAX_JSON_BODY_BYTES = 64 * 1024;
const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const NO_STORE = { "cache-control": "no-store" };

export interface ApiContext<P> {
  request: NextRequest;
  params: P;
  user: AuthUser;
  supabase: AppSupabaseClient;
}

export function jsonData<T>(data: T, status = 200) {
  return NextResponse.json({ data }, { status, headers: NO_STORE });
}

export function noContent() {
  return new NextResponse(null, { status: 204, headers: NO_STORE });
}

export function errorResponse(error: unknown): NextResponse<ApiErrorBody> {
  if (error instanceof ApiError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message, ...(error.details ? { details: error.details } : {}) } },
      { status: error.status, headers: NO_STORE },
    );
  }

  if (error instanceof ConfigurationError) {
    logger.error("api.configuration_error", { issues: error.issues });
    return NextResponse.json(
      { error: { code: "CONFIGURATION_ERROR", message: "AI HQ is not configured. See the setup guide." } },
      { status: 503, headers: NO_STORE },
    );
  }

  const requestId = crypto.randomUUID();
  logger.error("api.unexpected_error", { requestId, error });
  return NextResponse.json(
    { error: { code: "INTERNAL_ERROR", message: "Something went wrong. Try again.", requestId } },
    { status: 500, headers: NO_STORE },
  );
}

/**
 * Rejects cross-site state-changing requests. Auth cookies are SameSite=Lax
 * and bodies must be JSON, so this is defence in depth against CSRF.
 */
export function assertSameOrigin(request: Request) {
  if (request.headers.get("sec-fetch-site") === "cross-site") {
    throw new ApiError("FORBIDDEN", "Cross-site requests are not allowed.");
  }
  const origin = request.headers.get("origin");
  if (!origin) return;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  let originHost: string | undefined;
  try {
    originHost = new URL(origin).host;
  } catch {
    originHost = undefined;
  }
  if (!host || originHost !== host) {
    throw new ApiError("FORBIDDEN", "Cross-site requests are not allowed.");
  }
}

export async function readJson<S extends z.ZodType>(request: Request, schema: S): Promise<z.output<S>> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    throw new ApiError("UNSUPPORTED_MEDIA_TYPE", "Send the request body as application/json.");
  }
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (declaredLength > MAX_JSON_BODY_BYTES) {
    throw new ApiError("PAYLOAD_TOO_LARGE", "The request body is too large.");
  }
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_JSON_BODY_BYTES) {
    throw new ApiError("PAYLOAD_TOO_LARGE", "The request body is too large.");
  }

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw new ApiError("INVALID_JSON", "The request body is not valid JSON.");
  }

  const result = schema.safeParse(body);
  if (!result.success) throw ApiError.fromZod(result.error);
  return result.data;
}

export function parseWith<S extends z.ZodType>(schema: S, input: unknown, message?: string): z.output<S> {
  const result = schema.safeParse(input);
  if (!result.success) throw ApiError.fromZod(result.error, message);
  return result.data;
}

/**
 * Wraps a Route Handler with the checks every private endpoint needs:
 * same-origin check for mutations, server-side session validation, the email
 * allowlist and uniform error responses.
 */
export function apiRoute<P extends Record<string, string> = Record<string, never>>(
  handler: (context: ApiContext<P>) => Promise<Response>,
) {
  return async (request: NextRequest, context: { params: Promise<P> }): Promise<Response> => {
    try {
      if (MUTATING_METHODS.has(request.method)) assertSameOrigin(request);

      const auth = await getAuthContext();
      if (auth.status === "unauthenticated") {
        throw new ApiError("UNAUTHENTICATED", "Sign in to continue.");
      }
      if (auth.status === "forbidden") {
        throw new ApiError("FORBIDDEN", "This account is not allowed to use AI HQ.");
      }

      const params = await context.params;
      return await handler({ request, params, user: auth.user, supabase: auth.supabase });
    } catch (error) {
      // Let Next.js handle its own control-flow errors (e.g. request APIs during prerendering).
      unstable_rethrow(error);
      return errorResponse(error);
    }
  };
}
