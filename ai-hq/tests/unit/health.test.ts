import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  connection: async () => {},
}));

const ENV = {
  APP_ENV: "development",
  SUPABASE_URL: "http://127.0.0.1:54321",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test_key_123456",
};

async function load(env: Record<string, string>) {
  vi.resetModules();
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
  return {
    live: (await import("@/app/api/health/route")).GET,
    ready: (await import("@/app/api/health/ready/route")).GET,
  };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("health probes", () => {
  it("liveness stays 200 even when configuration is missing", async () => {
    const { live } = await load({ ...ENV, SUPABASE_URL: "" });
    const response = await live();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok", checks: { configuration: "invalid" } });
  });

  it("readiness checks Supabase Auth and reports only outcomes", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 200 }));
    const { ready } = await load(ENV);
    const response = await ready();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ready", checks: { configuration: "ok", auth: "ok" } });
    expect(String(fetchSpy.mock.calls[0][0])).toBe("http://127.0.0.1:54321/auth/v1/health");
  });

  it("is not ready when Auth is unreachable or configuration is invalid", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("ECONNREFUSED"));
    let { ready } = await load(ENV);
    let response = await ready();
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ status: "not_ready", checks: { configuration: "ok", auth: "unreachable" } });

    ({ ready } = await load({ ...ENV, SUPABASE_PUBLISHABLE_KEY: "" }));
    response = await ready();
    expect(await response.json()).toEqual({ status: "not_ready", checks: { configuration: "invalid", auth: "skipped" } });
  });
});
