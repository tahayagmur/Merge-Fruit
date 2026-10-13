import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const USER = { id: "00000000-0000-4000-8000-0000000a11ce", email: "alice@example.com" };
const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const supabase = { marker: "request-scoped-client" };

const getAuthContext = vi.fn();
vi.mock("@/lib/auth/session", () => ({ getAuthContext: () => getAuthContext() }));

const data = {
  listProjects: vi.fn(),
  createProject: vi.fn(),
  getProject: vi.fn(),
  updateProject: vi.fn(),
  deleteProject: vi.fn(),
};
vi.mock("@/lib/data/projects", () => data);

const tasks = { createTask: vi.fn(), listTasks: vi.fn() };
vi.mock("@/lib/data/tasks", () => tasks);

const collection = await import("@/app/api/projects/route");
const item = await import("@/app/api/projects/[projectId]/route");
const projectTasks = await import("@/app/api/projects/[projectId]/tasks/route");
const { ApiError } = await import("@/lib/api/errors");

function jsonRequest(method: string, url: string, body?: unknown) {
  return new NextRequest(url, {
    method,
    headers: { host: "hq.test", origin: "http://hq.test", "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const params = (projectId: string) => ({ params: Promise.resolve({ projectId }) });

beforeEach(() => {
  vi.resetAllMocks();
  getAuthContext.mockResolvedValue({ status: "authenticated", user: USER, supabase });
});

describe("/api/projects", () => {
  it("creates a project owned by the session user, not by the payload", async () => {
    data.createProject.mockResolvedValue({ id: PROJECT_ID, name: "AI HQ" });
    const response = await collection.POST(jsonRequest("POST", "http://hq.test/api/projects", { name: " AI HQ " }), {
      params: Promise.resolve({}),
    });

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ data: { id: PROJECT_ID, name: "AI HQ" } });
    expect(data.createProject).toHaveBeenCalledWith(supabase, USER.id, expect.objectContaining({ name: "AI HQ" }));
  });

  it("rejects an owner_id in the payload", async () => {
    const response = await collection.POST(
      jsonRequest("POST", "http://hq.test/api/projects", { name: "x", owner_id: "someone-else" }),
      { params: Promise.resolve({}) },
    );
    expect(response.status).toBe(400);
    expect(data.createProject).not.toHaveBeenCalled();
  });

  it("validates list filters", async () => {
    const response = await collection.GET(jsonRequest("GET", "http://hq.test/api/projects?status=nope"), {
      params: Promise.resolve({}),
    });
    expect(response.status).toBe(400);
    expect(data.listProjects).not.toHaveBeenCalled();
  });

  it("does not reach the data layer without a session", async () => {
    getAuthContext.mockResolvedValue({ status: "unauthenticated" });
    const response = await collection.GET(jsonRequest("GET", "http://hq.test/api/projects"), {
      params: Promise.resolve({}),
    });
    expect(response.status).toBe(401);
    expect(data.listProjects).not.toHaveBeenCalled();
  });
});

describe("/api/projects/[projectId]", () => {
  it("rejects malformed ids before querying", async () => {
    const response = await item.GET(jsonRequest("GET", "http://hq.test/api/projects/abc"), params("abc"));
    expect(response.status).toBe(400);
    expect(data.getProject).not.toHaveBeenCalled();
  });

  it("returns 404 for projects that do not exist or belong to someone else", async () => {
    data.getProject.mockResolvedValue(null);
    const response = await item.GET(jsonRequest("GET", `http://hq.test/api/projects/${PROJECT_ID}`), params(PROJECT_ID));
    expect(response.status).toBe(404);
  });

  it("updates with validated fields only", async () => {
    data.updateProject.mockResolvedValue({ id: PROJECT_ID, status: "active" });
    const response = await item.PATCH(
      jsonRequest("PATCH", `http://hq.test/api/projects/${PROJECT_ID}`, { status: "active" }),
      params(PROJECT_ID),
    );
    expect(response.status).toBe(200);
    expect(data.updateProject).toHaveBeenCalledWith(supabase, PROJECT_ID, { status: "active" });
  });

  it("deletes and returns 204", async () => {
    data.deleteProject.mockResolvedValue(undefined);
    const response = await item.DELETE(jsonRequest("DELETE", `http://hq.test/api/projects/${PROJECT_ID}`), params(PROJECT_ID));
    expect(response.status).toBe(204);
  });

  it("surfaces data-layer not-found errors", async () => {
    data.deleteProject.mockRejectedValue(ApiError.notFound("Project"));
    const response = await item.DELETE(jsonRequest("DELETE", `http://hq.test/api/projects/${PROJECT_ID}`), params(PROJECT_ID));
    expect(response.status).toBe(404);
  });
});

describe("/api/projects/[projectId]/tasks", () => {
  it("creates a task for the session user", async () => {
    tasks.createTask.mockResolvedValue({ id: "t1", title: "Do it" });
    const response = await projectTasks.POST(
      jsonRequest("POST", `http://hq.test/api/projects/${PROJECT_ID}/tasks`, { title: "Do it", status: "in_progress" }),
      params(PROJECT_ID),
    );
    expect(response.status).toBe(201);
    expect(tasks.createTask).toHaveBeenCalledWith(
      supabase,
      USER.id,
      PROJECT_ID,
      expect.objectContaining({ title: "Do it", status: "in_progress" }),
    );
  });

  it("returns 404 when listing tasks of an invisible project", async () => {
    data.getProject.mockResolvedValue(null);
    const response = await projectTasks.GET(
      jsonRequest("GET", `http://hq.test/api/projects/${PROJECT_ID}/tasks`),
      params(PROJECT_ID),
    );
    expect(response.status).toBe(404);
    expect(tasks.listTasks).not.toHaveBeenCalled();
  });
});
