import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const getAuthContext = vi.fn();
vi.mock("@/lib/auth/session", () => ({ getAuthContext: () => getAuthContext() }));

const { ApiError } = await import("@/lib/api/errors");
const { apiRoute, MAX_JSON_BODY_BYTES, readJson } = await import("@/lib/api/route");
const { ConfigurationError } = await import("@/lib/env");

const USER = { id: "00000000-0000-4000-8000-0000000a11ce", email: "alice@example.com" };
const context = { params: Promise.resolve({}) };

function request(method: string, init: { body?: string; headers?: Record<string, string> } = {}) {
  return new NextRequest("http://hq.test/api/things", {
    method,
    body: init.body,
    headers: { host: "hq.test", ...init.headers },
  });
}

const schema = z.strictObject({ name: z.string().min(1) });
const echo = apiRoute(async ({ request: req, user }) => {
  const body = req.method === "GET" ? null : await readJson(req, schema);
  return Response.json({ user: user.id, body });
});

beforeEach(() => {
  getAuthContext.mockReset();
  getAuthContext.mockResolvedValue({ status: "authenticated", user: USER, supabase: {} });
});

describe("apiRoute authentication", () => {
  it("returns 401 without a session", async () => {
    getAuthContext.mockResolvedValue({ status: "unauthenticated" });
    const response = await echo(request("GET"), context);
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: { code: "UNAUTHENTICATED", message: "Sign in to continue." } });
  });

  it("returns 403 for users outside the allowlist", async () => {
    getAuthContext.mockResolvedValue({ status: "forbidden", user: USER });
    const response = await echo(request("GET"), context);
    expect(response.status).toBe(403);
    expect((await response.json()).error.code).toBe("FORBIDDEN");
  });

  it("passes the verified user to the handler", async () => {
    const response = await echo(request("GET"), context);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ user: USER.id, body: null });
  });
});

describe("apiRoute request hardening", () => {
  it("rejects cross-origin mutations before touching the session", async () => {
    const response = await echo(
      request("POST", {
        body: JSON.stringify({ name: "x" }),
        headers: { origin: "https://evil.example", "content-type": "application/json" },
      }),
      context,
    );
    expect(response.status).toBe(403);
    expect(getAuthContext).not.toHaveBeenCalled();
  });

  it("rejects requests flagged cross-site by the browser", async () => {
    const response = await echo(
      request("DELETE", { headers: { "sec-fetch-site": "cross-site" } }),
      context,
    );
    expect(response.status).toBe(403);
  });

  it("accepts same-origin mutations", async () => {
    const response = await echo(
      request("POST", {
        body: JSON.stringify({ name: "x" }),
        headers: { origin: "http://hq.test", "content-type": "application/json" },
      }),
      context,
    );
    expect(response.status).toBe(200);
  });

  it("requires a JSON content type", async () => {
    const response = await echo(request("POST", { body: "name=x", headers: { "content-type": "text/plain" } }), context);
    expect(response.status).toBe(415);
    expect((await response.json()).error.code).toBe("UNSUPPORTED_MEDIA_TYPE");
  });

  it("rejects malformed JSON", async () => {
    const response = await echo(request("POST", { body: "{", headers: { "content-type": "application/json" } }), context);
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("INVALID_JSON");
  });

  it("rejects oversized bodies", async () => {
    const body = JSON.stringify({ name: "x".repeat(MAX_JSON_BODY_BYTES) });
    const response = await echo(request("POST", { body, headers: { "content-type": "application/json" } }), context);
    expect(response.status).toBe(413);
  });

  it("returns field-level validation details", async () => {
    const response = await echo(
      request("POST", { body: JSON.stringify({ name: "", extra: true }), headers: { "content-type": "application/json" } }),
      context,
    );
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.details.length).toBeGreaterThan(0);
  });
});

describe("apiRoute error handling", () => {
  it("maps ApiError to its status", async () => {
    const handler = apiRoute(async () => {
      throw ApiError.notFound("Project");
    });
    const response = await handler(request("GET"), context);
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: { code: "NOT_FOUND", message: "Project not found." } });
  });

  it("reports missing configuration as 503 without leaking details", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    getAuthContext.mockRejectedValue(new ConfigurationError(["SUPABASE_URL is missing."]));
    const response = await echo(request("GET"), context);
    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toContain("SUPABASE_URL");
  });

  it("hides unexpected errors behind a request id", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const handler = apiRoute(async () => {
      throw new Error("connection string postgres://user:secret@db");
    });
    const response = await handler(request("GET"), context);
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error.code).toBe("INTERNAL_ERROR");
    expect(body.error.requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(JSON.stringify(body)).not.toContain("secret");
  });

  it("marks responses as non-cacheable", async () => {
    getAuthContext.mockResolvedValue({ status: "unauthenticated" });
    const response = await echo(request("GET"), context);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});
