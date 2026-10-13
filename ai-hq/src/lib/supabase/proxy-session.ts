import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isEmailAllowed, safeRedirectPath } from "@/lib/auth/access";
import type { Database } from "@/lib/database.types";
import { getServerEnvStatus } from "@/lib/env";

const PUBLIC_PATHS = new Set(["/login", "/api/health"]);

function isApiPath(pathname: string) {
  return pathname === "/api" || pathname.startsWith("/api/");
}

function apiError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

/** Copies refreshed auth cookies and no-cache headers onto a response we create ourselves. */
function withSession(target: NextResponse, source: NextResponse) {
  for (const cookie of source.cookies.getAll()) target.cookies.set(cookie);
  const cacheControl = source.headers.get("cache-control");
  if (cacheControl) target.headers.set("cache-control", cacheControl);
  return target;
}

/**
 * Runs before every matched request (see src/proxy.ts):
 * 1. refreshes the Supabase session and writes rotated cookies,
 * 2. keeps signed-out visitors away from private pages and APIs,
 * 3. rejects signed-in users that are not on the allowlist.
 *
 * Route Handlers and pages verify the session again on their own; this is the
 * first line of defence, not the only one.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  const { pathname, search } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.has(pathname);
  const isApi = isApiPath(pathname);

  const config = getServerEnvStatus();
  if (!config.ok) {
    if (isPublic) return NextResponse.next({ request });
    if (isApi) {
      return apiError(503, "CONFIGURATION_ERROR", "AI HQ is not configured. See the setup guide.");
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }
  const { env } = config;

  let response = NextResponse.next({ request });
  const supabase = createServerClient<Database>(env.supabaseUrl, env.supabasePublishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
      },
    },
  });

  // getUser() validates the access token with Supabase Auth (and refreshes it
  // when needed). Never trust getSession() alone on the server.
  let user: { email?: string | null } | null = null;
  try {
    const { data, error } = await supabase.auth.getUser();
    user = error ? null : data.user;
  } catch {
    user = null;
  }

  const allowed = user !== null && isEmailAllowed(user.email, env.allowedEmails);

  if (pathname === "/login") {
    if (allowed) {
      const next = safeRedirectPath(request.nextUrl.searchParams.get("next"));
      return withSession(NextResponse.redirect(new URL(next, request.url)), response);
    }
    return response;
  }

  if (isPublic) return response;

  if (!user) {
    if (isApi) return withSession(apiError(401, "UNAUTHENTICATED", "Sign in to continue."), response);
    const loginUrl = new URL("/login", request.url);
    if (pathname !== "/") loginUrl.searchParams.set("next", `${pathname}${search}`);
    return withSession(NextResponse.redirect(loginUrl), response);
  }

  if (!allowed) {
    if (isApi) {
      return withSession(apiError(403, "FORBIDDEN", "This account is not allowed to use AI HQ."), response);
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("error", "forbidden");
    return withSession(NextResponse.redirect(loginUrl), response);
  }

  return response;
}
