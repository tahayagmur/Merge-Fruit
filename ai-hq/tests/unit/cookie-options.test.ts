import { describe, expect, it } from "vitest";
import { authCookieOptions, SESSION_MAX_AGE_SECONDS, withSessionLifetime } from "@/lib/supabase/cookie-options";

describe("authCookieOptions", () => {
  it("keeps session cookies away from JavaScript with a short lifetime", () => {
    expect(authCookieOptions({ appEnv: "development" })).toEqual({
      path: "/",
      sameSite: "lax",
      httpOnly: true,
      secure: false,
      maxAge: SESSION_MAX_AGE_SECONDS,
    });
    expect(SESSION_MAX_AGE_SECONDS).toBe(604_800);
  });

  it("requires HTTPS outside local development", () => {
    expect(authCookieOptions({ appEnv: "production" }).secure).toBe(true);
    expect(authCookieOptions({ appEnv: "staging" }).secure).toBe(true);
  });
});

describe("withSessionLifetime", () => {
  it("caps the library's 400-day max-age and keeps deletions intact", () => {
    expect(withSessionLifetime({ maxAge: 400 * 24 * 3600, httpOnly: true }).maxAge).toBe(SESSION_MAX_AGE_SECONDS);
    expect(withSessionLifetime({ maxAge: 60 }).maxAge).toBe(60);
    expect(withSessionLifetime({ maxAge: 0 }).maxAge).toBe(0);
    expect(withSessionLifetime({}).maxAge).toBe(SESSION_MAX_AGE_SECONDS);
  });
});
