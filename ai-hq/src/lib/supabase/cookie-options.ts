import type { CookieOptions, CookieOptionsWithName } from "@supabase/ssr";
import type { ServerEnv } from "@/lib/env";

/** Sessions expire after this much inactivity; every token refresh slides the window. */
export const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

/**
 * Hardened auth cookie settings. AI HQ never uses the Supabase browser client,
 * so the session cookies do not need to be readable from JavaScript:
 * - httpOnly: an XSS bug cannot exfiltrate the session tokens,
 * - secure: outside local development cookies are only sent over HTTPS,
 * - a 7-day sliding lifetime instead of the library default of 400 days.
 */
export function authCookieOptions(env: Pick<ServerEnv, "appEnv">): CookieOptionsWithName {
  return {
    path: "/",
    sameSite: "lax",
    httpOnly: true,
    secure: env.appEnv !== "development",
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}

/**
 * @supabase/ssr always writes auth cookies with its own 400-day max-age, even
 * when `cookieOptions.maxAge` is set. Apply our lifetime when the cookie is
 * actually written; deletions (max-age 0) pass through unchanged.
 */
export function withSessionLifetime(options: CookieOptions): CookieOptions {
  if (options.maxAge === 0) return options;
  return { ...options, maxAge: Math.min(options.maxAge ?? SESSION_MAX_AGE_SECONDS, SESSION_MAX_AGE_SECONDS) };
}
