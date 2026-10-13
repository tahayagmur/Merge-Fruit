import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const USER = { id: "00000000-0000-4000-8000-0000000a11ce", email: "alice@example.com" };
const supabase = { marker: "client" };

const getAuthContext = vi.fn();
vi.mock("@/lib/auth/session", () => ({ getAuthContext: () => getAuthContext(), requireUser: vi.fn() }));

const profiles = { getProfile: vi.fn(), listProfiles: vi.fn(), setWorkspaceRole: vi.fn(), updateDisplayName: vi.fn() };
vi.mock("@/lib/data/profiles", () => profiles);
const integrations = { getIntegrationView: vi.fn(), saveIntegrationConfig: vi.fn(), resetIntegrationConfig: vi.fn() };
vi.mock("@/lib/data/integrations", () => integrations);
const settings = { getSystemSettings: vi.fn(), updateSystemSettings: vi.fn() };
vi.mock("@/lib/data/settings", () => settings);
const demo = { getDemoDataStatus: vi.fn(), loadDemoData: vi.fn(), removeDemoData: vi.fn() };
vi.mock("@/lib/demo/service", () => demo);

const integrationRoute = await import("@/app/api/integrations/[key]/route");
const settingsRoute = await import("@/app/api/settings/route");
const usersRoute = await import("@/app/api/users/route");
const roleRoute = await import("@/app/api/users/[userId]/role/route");

function jsonRequest(method: string, url: string, body?: unknown) {
  return new NextRequest(url, {
    method,
    headers: { host: "hq.test", origin: "http://hq.test", "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function asRole(role: "owner" | "admin" | "member") {
  profiles.getProfile.mockResolvedValue({ id: USER.id, email: USER.email, displayName: null, role, createdAt: "" });
}

beforeEach(() => {
  vi.resetAllMocks();
  getAuthContext.mockResolvedValue({ status: "authenticated", user: USER, supabase });
});

describe("integration settings", () => {
  const params = { params: Promise.resolve({ key: "n8n" }) };

  it("are readable by members", async () => {
    asRole("member");
    integrations.getIntegrationView.mockResolvedValue({ key: "n8n", status: "not_configured" });
    const response = await integrationRoute.GET(jsonRequest("GET", "http://hq.test/api/integrations/n8n"), params);
    expect(response.status).toBe(200);
  });

  it("can only be changed by admins", async () => {
    asRole("member");
    const denied = await integrationRoute.PATCH(
      jsonRequest("PATCH", "http://hq.test/api/integrations/n8n", { enabled: true }),
      params,
    );
    expect(denied.status).toBe(403);
    expect(integrations.saveIntegrationConfig).not.toHaveBeenCalled();

    asRole("admin");
    integrations.saveIntegrationConfig.mockResolvedValue({ key: "n8n", status: "ready_to_configure" });
    const allowed = await integrationRoute.PATCH(
      jsonRequest("PATCH", "http://hq.test/api/integrations/n8n", { settings: { baseUrl: "https://x.app.n8n.cloud" } }),
      params,
    );
    expect(allowed.status).toBe(200);
    expect(integrations.saveIntegrationConfig).toHaveBeenCalledWith(supabase, "n8n", {
      settings: { baseUrl: "https://x.app.n8n.cloud" },
    });
  });

  it("rejects malformed keys", async () => {
    const response = await integrationRoute.GET(jsonRequest("GET", "http://hq.test/api/integrations/Bad!"), {
      params: Promise.resolve({ key: "Bad!" }),
    });
    expect(response.status).toBe(400);
  });
});

describe("system settings", () => {
  it("can be changed by admins only", async () => {
    asRole("member");
    const denied = await settingsRoute.PATCH(jsonRequest("PATCH", "http://hq.test/api/settings", { workspaceName: "X" }), {
      params: Promise.resolve({}),
    });
    expect(denied.status).toBe(403);

    asRole("owner");
    settings.updateSystemSettings.mockResolvedValue({ workspaceName: "X", timezone: "UTC" });
    const allowed = await settingsRoute.PATCH(jsonRequest("PATCH", "http://hq.test/api/settings", { workspaceName: "X" }), {
      params: Promise.resolve({}),
    });
    expect(allowed.status).toBe(200);
  });
});

describe("users and roles", () => {
  it("lists users for admins only", async () => {
    asRole("member");
    expect((await usersRoute.GET(jsonRequest("GET", "http://hq.test/api/users"), { params: Promise.resolve({}) })).status).toBe(403);
    asRole("admin");
    profiles.listProfiles.mockResolvedValue([]);
    expect((await usersRoute.GET(jsonRequest("GET", "http://hq.test/api/users"), { params: Promise.resolve({}) })).status).toBe(200);
  });

  it("changes roles for the owner only", async () => {
    const target = "11111111-1111-4111-8111-111111111111";
    const params = { params: Promise.resolve({ userId: target }) };
    asRole("admin");
    const denied = await roleRoute.PATCH(jsonRequest("PATCH", `http://hq.test/api/users/${target}/role`, { role: "admin" }), params);
    expect(denied.status).toBe(403);
    expect(profiles.setWorkspaceRole).not.toHaveBeenCalled();

    asRole("owner");
    profiles.setWorkspaceRole.mockResolvedValue({ id: target, role: "admin" });
    const allowed = await roleRoute.PATCH(jsonRequest("PATCH", `http://hq.test/api/users/${target}/role`, { role: "admin" }), params);
    expect(allowed.status).toBe(200);
    expect(profiles.setWorkspaceRole).toHaveBeenCalledWith(supabase, target, "admin");
  });
});
