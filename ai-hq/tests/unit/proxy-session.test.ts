import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
const getSession = vi.fn();
vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({ auth: { getUser, getSession } }),
}));

/** Unsigned test token: the proxy only reads `aal` after getUser() validated the session. */
function tokenWithAal(aal: string) {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "HS256" })}.${encode({ sub: "u1", aal })}.signature`;
}
const VERIFIED_TOTP = [{ factor_type: "totp", status: "verified" }];

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
  getSession.mockReset();
  getSession.mockResolvedValue({ data: { session: { access_token: tokenWithAal("aal1") } } });
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

describe("proxy: two-factor sign-in", () => {
  const withMfa = { data: { user: { email: "owner@example.com", factors: VERIFIED_TOTP } }, error: null };

  it("sends an aal1 session with a verified factor to the second step", async () => {
    getUser.mockResolvedValue(withMfa);
    const updateSession = await loadProxy();

    const page = await updateSession(get("/projects?status=active"));
    const location = new URL(page.headers.get("location")!);
    expect(location.pathname).toBe("/login/mfa");
    expect(location.searchParams.get("next")).toBe("/projects?status=active");

    const api = await updateSession(get("/api/projects"));
    expect(api.status).toBe(401);
    expect((await api.json()).error.code).toBe("MFA_REQUIRED");

    const login = await updateSession(get("/login?next=/automation"));
    expect(new URL(login.headers.get("location")!).pathname).toBe("/login/mfa");
    expect((await updateSession(get("/login/mfa"))).headers.get("location")).toBeNull();
  });

  it("lets an aal2 session through and away from the second step", async () => {
    getUser.mockResolvedValue(withMfa);
    getSession.mockResolvedValue({ data: { session: { access_token: tokenWithAal("aal2") } } });
    const updateSession = await loadProxy();
    expect((await updateSession(get("/projects"))).status).toBe(200);
    const mfa = await updateSession(get("/login/mfa?next=/agents"));
    expect(new URL(mfa.headers.get("location")!).pathname).toBe("/agents");
  });

  it("ignores factors that are not verified, and needs a session for the second step", async () => {
    getUser.mockResolvedValue({
      data: { user: { email: "owner@example.com", factors: [{ factor_type: "totp", status: "unverified" }] } },
      error: null,
    });
    const updateSession = await loadProxy();
    expect((await updateSession(get("/projects"))).status).toBe(200);

    getUser.mockResolvedValue({ data: { user: null }, error: null });
    const signedOut = await updateSession(get("/login/mfa"));
    expect(new URL(signedOut.headers.get("location")!).pathname).toBe("/login");
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
