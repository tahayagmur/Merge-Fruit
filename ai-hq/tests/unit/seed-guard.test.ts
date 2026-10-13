import { describe, expect, it } from "vitest";
import { resolveSeedTarget, SeedRefusedError } from "../../scripts/lib/seed-guard";

const BASE = {
  APP_ENV: "development",
  SUPABASE_URL: "http://127.0.0.1:54321",
  SUPABASE_SECRET_KEY: "sb_secret_local-only-fake",
};

describe("resolveSeedTarget", () => {
  it("allows a local Supabase in development", () => {
    expect(resolveSeedTarget(BASE)).toEqual({
      supabaseUrl: "http://127.0.0.1:54321",
      secretKey: "sb_secret_local-only-fake",
      email: "dev@ai-hq.local",
      password: null,
    });
  });

  it.each(["production", "staging", undefined])("refuses APP_ENV=%s", (appEnv) => {
    expect(() => resolveSeedTarget({ ...BASE, APP_ENV: appEnv })).toThrow(SeedRefusedError);
  });

  it("refuses a hosted project unless it is declared as the dev project", () => {
    const remote = { ...BASE, SUPABASE_URL: "https://abcdefghijklmnop.supabase.co" };
    expect(() => resolveSeedTarget(remote)).toThrow(/DEV_SUPABASE_PROJECT_REF/);
    expect(() => resolveSeedTarget({ ...remote, DEV_SUPABASE_PROJECT_REF: "zzzzzzzzzzzzzzzz" })).toThrow(SeedRefusedError);
    expect(resolveSeedTarget({ ...remote, DEV_SUPABASE_PROJECT_REF: "abcdefghijklmnop" }).supabaseUrl).toBe(
      "https://abcdefghijklmnop.supabase.co",
    );
  });

  it("refuses custom domains it cannot identify", () => {
    expect(() =>
      resolveSeedTarget({ ...BASE, SUPABASE_URL: "https://db.example.com", DEV_SUPABASE_PROJECT_REF: "example" }),
    ).toThrow(SeedRefusedError);
  });

  it("requires the secret key and a strong optional password", () => {
    expect(() => resolveSeedTarget({ ...BASE, SUPABASE_SECRET_KEY: "" })).toThrow(/SUPABASE_SECRET_KEY/);
    expect(() => resolveSeedTarget({ ...BASE, DEV_SEED_PASSWORD: "short" })).toThrow(/12 characters/);
    expect(resolveSeedTarget({ ...BASE, DEV_SEED_EMAIL: "Me@Example.com" }).email).toBe("me@example.com");
  });
});
