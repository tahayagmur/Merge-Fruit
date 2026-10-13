import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({ auth: { getUser } }),
}));

const ENV = {
  APP_ENV: "development",
  SUPABASE_URL: "http://127.0.0.1:54321",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test_key_123456",
  AI_HQ_ALLOWED_EMAILS: "owner@example.com",
};

async function loadProxy(env: Record<string, string | undefined> = ENV) {
  vi.resetModules();
  for (const [key, value] of Object.entries({ ...ENV, ...env })) {
    if (value === undefined) vi.stubEnv(key, "");
    else vi.stubEnv(key, value);
  }
  return (await import("@/lib/supabase/proxy-session")).updateSession;
}

const get = (path: string) => new NextRequest(`http://hq.test${path}`);

beforeEach(() => {
  getUser.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("proxy: signed-out visitors", () => {
  beforeEach(() => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
  });

  it("redirects private pages to the login page and keeps the destination", async () => {
    const updateSession = await loadProxy();
    const response = await updateSession(get("/projects?status=active"));
    expect(response.status).toBe(307);
    const location = new URL(response.headers.get("location")!);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("next")).toBe("/projects?status=active");
  });

  it("answers private APIs with 401 JSON", async () => {
    const updateSession = await loadProxy();
    const response = await updateSession(get("/api/projects"));
    expect(response.status).toBe(401);
    expect((await response.json()).error.code).toBe("UNAUTHENTICATED");
  });

  it("lets the login page and health check through", async () => {
    const updateSession = await loadProxy();
    expect((await updateSession(get("/login"))).headers.get("location")).toBeNull();
    expect((await updateSession(get("/api/health"))).status).toBe(200);
  });

  it("treats Auth server failures as signed out", async () => {
    getUser.mockRejectedValue(new Error("network down"));
    const updateSession = await loadProxy();
    expect((await updateSession(get("/api/projects"))).status).toBe(401);
  });
});

describe("proxy: signed-in users", () => {
  it("lets allowlisted users through", async () => {
    getUser.mockResolvedValue({ data: { user: { email: "owner@example.com" } }, error: null });
    const updateSession = await loadProxy();
    const response = await updateSession(get("/projects"));
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("blocks users who are not on the allowlist", async () => {
    getUser.mockResolvedValue({ data: { user: { email: "intruder@example.com" } }, error: null });
    const updateSession = await loadProxy();

    const page = await updateSession(get("/"));
    expect(new URL(page.headers.get("location")!).search).toBe("?error=forbidden");

    const api = await updateSession(get("/api/projects"));
    expect(api.status).toBe(403);
  });

  it("does not loop a blocked user away from the login page", async () => {
    getUser.mockResolvedValue({ data: { user: { email: "intruder@example.com" } }, error: null });
    const updateSession = await loadProxy();
    expect((await updateSession(get("/login?error=forbidden"))).headers.get("location")).toBeNull();
  });

  it("sends allowed users away from the login page, only to safe destinations", async () => {
    getUser.mockResolvedValue({ data: { user: { email: "owner@example.com" } }, error: null });
    const updateSession = await loadProxy();
    const safe = await updateSession(get("/login?next=/automation"));
    expect(new URL(safe.headers.get("location")!).pathname).toBe("/automation");
    const unsafe = await updateSession(get("/login?next=//evil.example"));
    expect(new URL(unsafe.headers.get("location")!).href).toBe("http://hq.test/");
  });
});

describe("proxy: missing configuration", () => {
  it("fails closed", async () => {
    const updateSession = await loadProxy({ SUPABASE_URL: undefined });
    expect((await updateSession(get("/api/projects"))).status).toBe(503);
    expect(new URL((await updateSession(get("/projects"))).headers.get("location")!).pathname).toBe("/login");
    expect(getUser).not.toHaveBeenCalled();
  });
});
