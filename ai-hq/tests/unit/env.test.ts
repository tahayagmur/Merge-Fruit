import { describe, expect, it } from "vitest";
import { ConfigurationError, isElevatedSupabaseKey, parseAllowedEmails, parseServerEnv } from "@/lib/env";

const PUBLISHABLE = "sb_publishable_abcdefghijklmnopqrstuvwxyz";

function jwtWithRole(role: string) {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ role, iss: "supabase" })}.signature`;
}

function issuesOf(source: Record<string, string | undefined>): string[] {
  try {
    parseServerEnv(source);
    return [];
  } catch (error) {
    expect(error).toBeInstanceOf(ConfigurationError);
    return (error as ConfigurationError).issues;
  }
}

describe("parseServerEnv", () => {
  it("accepts a local development configuration", () => {
    expect(
      parseServerEnv({
        NODE_ENV: "development",
        SUPABASE_URL: "http://127.0.0.1:54321",
        SUPABASE_PUBLISHABLE_KEY: PUBLISHABLE,
      }),
    ).toEqual({
      appEnv: "development",
      supabaseUrl: "http://127.0.0.1:54321",
      supabasePublishableKey: PUBLISHABLE,
      allowedEmails: [],
    });
  });

  it("accepts a production configuration with an allowlist", () => {
    const env = parseServerEnv({
      NODE_ENV: "production",
      APP_ENV: "production",
      SUPABASE_URL: "https://abcd.supabase.co",
      SUPABASE_PUBLISHABLE_KEY: PUBLISHABLE,
      AI_HQ_ALLOWED_EMAILS: " Owner@Example.com, ops@example.com ",
    });
    expect(env.appEnv).toBe("production");
    expect(env.allowedEmails).toEqual(["owner@example.com", "ops@example.com"]);
  });

  it("requires APP_ENV for production builds", () => {
    expect(
      issuesOf({ NODE_ENV: "production", SUPABASE_URL: "https://abcd.supabase.co", SUPABASE_PUBLISHABLE_KEY: PUBLISHABLE }),
    ).toContain("APP_ENV is required for production builds (development, staging or production).");
  });

  it("requires an allowlist in production", () => {
    expect(
      issuesOf({
        APP_ENV: "production",
        SUPABASE_URL: "https://abcd.supabase.co",
        SUPABASE_PUBLISHABLE_KEY: PUBLISHABLE,
      }),
    ).toContain("AI_HQ_ALLOWED_EMAILS must list at least one email when APP_ENV=production.");
  });

  it("rejects a local Supabase in production and plain http for remote hosts", () => {
    expect(
      issuesOf({
        APP_ENV: "production",
        SUPABASE_URL: "http://localhost:54321",
        SUPABASE_PUBLISHABLE_KEY: PUBLISHABLE,
        AI_HQ_ALLOWED_EMAILS: "owner@example.com",
      }),
    ).toContain("SUPABASE_URL points at a local Supabase instance while APP_ENV=production.");
    expect(
      issuesOf({ APP_ENV: "staging", SUPABASE_URL: "http://abcd.supabase.co", SUPABASE_PUBLISHABLE_KEY: PUBLISHABLE }),
    ).toContain("SUPABASE_URL must use https (http is only allowed for a local Supabase).");
  });

  it.each([["sb_secret_fake-for-tests"], [jwtWithRole("service_role")]])(
    "refuses an elevated key as the publishable key (%#)",
    (key) => {
      const issues = issuesOf({ SUPABASE_URL: "https://abcd.supabase.co", SUPABASE_PUBLISHABLE_KEY: key });
      expect(issues.join(" ")).toMatch(/secret\/service_role key/);
    },
  );

  it("reports every missing value at once", () => {
    expect(issuesOf({})).toEqual(["SUPABASE_URL is missing.", "SUPABASE_PUBLISHABLE_KEY is missing."]);
  });

  it("rejects malformed allowlist entries and unknown APP_ENV values", () => {
    const issues = issuesOf({
      APP_ENV: "prod",
      SUPABASE_URL: "https://abcd.supabase.co",
      SUPABASE_PUBLISHABLE_KEY: PUBLISHABLE,
      AI_HQ_ALLOWED_EMAILS: "owner@example.com, not-an-email",
    });
    expect(issues).toContain("APP_ENV must be one of development, staging, production.");
    expect(issues).toContain("AI_HQ_ALLOWED_EMAILS contains invalid entries: not-an-email.");
  });
});

describe("isElevatedSupabaseKey", () => {
  it("only flags secret and service_role keys", () => {
    expect(isElevatedSupabaseKey("sb_secret_fake")).toBe(true);
    expect(isElevatedSupabaseKey(jwtWithRole("service_role"))).toBe(true);
    expect(isElevatedSupabaseKey(jwtWithRole("anon"))).toBe(false);
    expect(isElevatedSupabaseKey(PUBLISHABLE)).toBe(false);
  });
});

describe("parseAllowedEmails", () => {
  it("normalises, de-duplicates and accepts several separators", () => {
    expect(parseAllowedEmails("A@x.io; b@x.io\nA@X.IO")).toEqual({ emails: ["a@x.io", "b@x.io"], invalid: [] });
  });
});
